import { randomUUID } from "node:crypto";
import {
  advanceCheckpointMetadata,
  initializeCheckpointMetadata,
} from "./sync-checkpoint.ts";
import {
  createErrorSummary,
  createSyncSummary,
  type ErrorSummary,
  type SyncSummary,
} from "./sync-observability.ts";
import { upsertResource } from "./upsert-resource.ts";
import { computeIdsToArchive, DEFAULT_MIN_OBSERVED_RATIO, evaluateReconciliationEligibility } from "./reconciliation.ts";
import { recoverStaleRuns, type RecoveryDatabase } from "./sync-run-recovery.ts";
import { decideSyncResume, type FailedSourceRun } from "./sync-resume-policy.ts";
import type {
  JsonApiResource,
  MirrorResourceDefinition,
  ReconciliationOutcome,
  SyncContext,
  SyncCounters,
  SyncResourceOptions,
  SyncResult,
} from "./types.ts";
import { PARASUT_INTEGRATION_SCHEMA, PARASUT_MIRROR_SCHEMA, SyncAlreadyRunningError } from "./types.ts";

const RUNNING_STALE_AFTER_MS = 10 * 60 * 1000;

/**
 * Race-free single-runner enforcement without any unique constraint or
 * advisory lock (both would require a schema/migration change, forbidden
 * here). Must be called AFTER this run's own sync_runs row is already
 * inserted. Lists every currently-`running`, non-stale row for this exact
 * (company, resource_type) — including this run's own row, which by now
 * definitely exists — and picks the single deterministic winner: earliest
 * started_at, then lowest id as a tiebreak for an exact timestamp collision.
 * Correctness does not depend on which side's SELECT happens to run first:
 * a row that hasn't been inserted yet simply isn't a threat yet, and once
 * it IS inserted, comparing against the same real, already-committed
 * started_at/id values, the two sides can never both conclude they won.
 */
async function enforceSingleRunner(
  context: SyncContext,
  options: SyncResourceOptions,
  ownRunId: string,
): Promise<void> {
  const staleCutoff = new Date((context.now?.() ?? new Date()).getTime() - RUNNING_STALE_AFTER_MS).toISOString();
  const competing = await integrationDb(context)
    .from<{ id: string; started_at: string }[]>("sync_runs")
    .select("id, started_at")
    .eq("company_id", context.companyId)
    .eq("parasut_company_id", context.parasutCompanyId)
    .eq("resource_type", options.resourceType)
    .eq("status", "running")
    .gt("started_at", staleCutoff);
  if (competing.error) throw new Error(competing.error.message ?? "Concurrency election lookup failed");

  const rows = competing.data ?? [];
  let winner: { id: string; started_at: string } | null = null;
  for (const row of rows) {
    if (
      !winner ||
      row.started_at < winner.started_at ||
      (row.started_at === winner.started_at && row.id < winner.id)
    ) {
      winner = row;
    }
  }

  if (winner && winner.id !== ownRunId) {
    await integrationDb(context)
      .from("sync_runs")
      .update({ status: "failed", completed_at: (context.now?.() ?? new Date()).toISOString() })
      .eq("id", ownRunId);
    throw new SyncAlreadyRunningError();
  }
}

const INCLUDED_DEFINITIONS = new Map<string, MirrorResourceDefinition>([
  [
    "sales_invoice_details",
    {
      resourceType: "sales_invoice_details",
      table: "sales_invoice_details",
    },
  ],
  [
    "purchase_bill_details",
    {
      resourceType: "purchase_bill_details",
      table: "purchase_bill_details",
    },
  ],
  ["payments", { resourceType: "payments", table: "payments" }],
]);

function integrationDb(context: SyncContext) {
  return context.database.schema(PARASUT_INTEGRATION_SCHEMA);
}

const DEFAULT_PAGE_SIZE = 25;

async function ignoreObservabilityFailure(
  operation: (() => void | Promise<void>) | undefined,
): Promise<void> {
  if (!operation) return;
  try {
    await operation();
  } catch {
    // Observability must never change synchronization outcomes.
  }
}

async function emitSyncSummary(
  context: SyncContext,
  summary: SyncSummary,
): Promise<void> {
  await ignoreObservabilityFailure(
    context.observability?.emitSyncSummary
      ? () => context.observability?.emitSyncSummary?.(summary)
      : undefined,
  );
}

async function emitErrorSummary(
  context: SyncContext,
  summary: ErrorSummary,
): Promise<void> {
  await ignoreObservabilityFailure(
    context.observability?.emitErrorSummary
      ? () => context.observability?.emitErrorSummary?.(summary)
      : undefined,
  );
}

function safeError(error: unknown): {
  code: string | null;
  message: string;
  retryable: boolean;
} {
  const message = error instanceof Error ? error.message : "Unexpected synchronization error";
  return {
    code: error instanceof Error ? error.name : null,
    message: message.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]").slice(0, 1000),
    retryable: /429|timeout|network|fetch|50[0234]/i.test(message),
  };
}

async function createRun(
  context: SyncContext,
  options: SyncResourceOptions,
  chainStartedAt: Date,
): Promise<{ runId: string; requestMetadata: Record<string, unknown> }> {
  const runId = randomUUID();
  const requestMetadata = {
    ...initializeCheckpointMetadata(
      {
        endpoint: options.endpoint,
        include: options.include ?? [],
      },
      runId,
      {
        resourceType: options.resourceType,
        endpoint: options.endpoint,
        include: options.include ?? [],
        pageSize: DEFAULT_PAGE_SIZE,
      },
    ),
    chain_started_at: chainStartedAt.toISOString(),
  };
  const result = await integrationDb(context)
    .from<{ id: string }>("sync_runs")
    .insert({
      id: runId,
      company_id: context.companyId,
      parasut_company_id: context.parasutCompanyId,
      resource_type: options.resourceType,
      trigger_type: "local_manual",
      status: "running",
      request_metadata: requestMetadata,
    })
    .select("id")
    .single();
  if (result.error || !result.data) {
    throw new Error(result.error?.message ?? "Sync run creation failed");
  }
  return { runId: result.data.id, requestMetadata };
}

interface LatestRunRow {
  id: string;
  status: string;
  request_metadata: Record<string, unknown>;
  created_at: string;
}

interface LatestRunQuery {
  select(columns: string): LatestRunQuery;
  eq(column: string, value: unknown): LatestRunQuery;
  then<T>(resolve: (value: { data: LatestRunRow[] | null; error: { message?: string } | null }) => T): Promise<T>;
}
interface LatestRunDatabase {
  schema(name: string): LatestRunDatabase;
  from(table: string): LatestRunQuery;
}

/**
 * Most recent resumable ("failed" or "partial") run for this exact
 * (company, resource) — the candidate source for decideSyncResume, which
 * re-validates status, identity, and request fingerprint before trusting
 * it, so a false positive here is always caught downstream and safely
 * falls back to "restart". No .order()/.limit() in this project's minimal
 * DB contract, so both statuses are fetched (each resource has very few
 * historical runs) and compared client-side.
 */
async function findLatestResumableRun(
  context: SyncContext,
  resourceType: string,
): Promise<FailedSourceRun | null> {
  const db = integrationDb(context) as unknown as LatestRunDatabase;
  const columns = "id,status,request_metadata,created_at";
  const [failed, partial] = await Promise.all([
    db.from("sync_runs").select(columns).eq("company_id", context.companyId).eq("parasut_company_id", context.parasutCompanyId).eq("resource_type", resourceType).eq("status", "failed"),
    db.from("sync_runs").select(columns).eq("company_id", context.companyId).eq("parasut_company_id", context.parasutCompanyId).eq("resource_type", resourceType).eq("status", "partial"),
  ]);
  if (failed.error) throw new Error(failed.error.message ?? "Latest sync-run lookup failed");
  if (partial.error) throw new Error(partial.error.message ?? "Latest sync-run lookup failed");

  const candidates = [...(failed.data ?? []), ...(partial.data ?? [])];
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));
  const latest = candidates[0];
  return {
    id: latest.id,
    companyId: context.companyId,
    parasutCompanyId: context.parasutCompanyId,
    resourceType,
    status: latest.status as FailedSourceRun["status"],
    requestMetadata: latest.request_metadata ?? {},
  };
}

async function persistCheckpoint(
  context: SyncContext,
  runId: string,
  requestMetadata: Record<string, unknown>,
): Promise<void> {
  const result = await integrationDb(context)
    .from("sync_runs")
    .update({ request_metadata: requestMetadata })
    .eq("id", runId)
    .eq("status", "running");
  if (result.error) {
    throw new Error(result.error.message ?? "Sync checkpoint persistence failed");
  }
}

async function recordError(
  context: SyncContext,
  runId: string,
  resourceType: string,
  error: unknown,
  parasutId: string | null = null,
): Promise<void> {
  const safe = safeError(error);
  const result = await integrationDb(context).from("sync_errors").insert({
    sync_run_id: runId,
    company_id: context.companyId,
    parasut_company_id: context.parasutCompanyId,
    resource_type: resourceType,
    parasut_id: parasutId,
    error_code: safe.code,
    sanitized_message: safe.message,
    retryable: safe.retryable,
  });
  if (result.error) {
    throw new Error(result.error.message ?? "Sync error recording failed");
  }
  await emitErrorSummary(context, createErrorSummary(safe));
}

async function completeRun(
  context: SyncContext,
  runId: string,
  counters: SyncCounters,
  status: SyncResult["status"],
): Promise<void> {
  const completedAt = (context.now?.() ?? new Date()).toISOString();
  const result = await integrationDb(context)
    .from("sync_runs")
    .update({
      status,
      completed_at: completedAt,
      page_count: counters.pages,
      records_observed: counters.observed,
      records_inserted: counters.inserted,
      records_updated: counters.updated,
      records_unchanged: counters.unchanged,
      error_count: counters.errors,
    })
    .eq("id", runId);
  if (result.error) throw new Error(result.error.message ?? "Sync run completion failed");
}

function countOutcome(
  counters: SyncCounters,
  outcome: "inserted" | "updated" | "unchanged",
): void {
  counters[outcome]++;
}

function mirrorDb(context: SyncContext) {
  return context.database.schema(PARASUT_MIRROR_SCHEMA);
}

/**
 * Deletion reconciliation (see reconciliation.ts for the guard/diff logic
 * itself) — runs only for resources that opted in via `options.reconcile`,
 * and only after `syncCollection`'s own page loop finished without error.
 * Scoped to the exact (company_id, parasut_company_id, resource_type) of
 * this run — never touches another tenant or another resource's rows.
 * Archives by UPDATE ... SET source_archived = true only; never DELETE.
 *
 * `chainStartedAt` (not an in-memory Set built during this invocation's own
 * loop) is what makes this safe for a run that resumed across multiple
 * Edge Function invocations: a resumed run's *this-invocation* page loop
 * never re-walks the pages an earlier invocation already committed, so an
 * in-memory "observed" set here would incorrectly look incomplete and
 * archive rows that were genuinely seen earlier in the same logical run.
 * upsertResource unconditionally stamps last_seen_at on every touch
 * (insert or update), so "last_seen_at >= chainStartedAt" is a durable,
 * cross-invocation-safe substitute — every row genuinely observed anywhere
 * in this logical run (this invocation or an earlier one in the same
 * resume chain) satisfies it, and only rows the whole chain never touched
 * do not.
 */
async function reconcileMissingResources(
  context: SyncContext,
  options: SyncResourceOptions,
  chainStartedAt: Date,
  counters: SyncCounters,
): Promise<ReconciliationOutcome> {
  const existing = await mirrorDb(context)
    .from<{ parasut_id: string; source_archived: boolean | null; last_seen_at: string }[]>(options.table)
    .select("parasut_id, source_archived, last_seen_at")
    .eq("company_id", context.companyId)
    .eq("parasut_company_id", context.parasutCompanyId)
    .eq("resource_type", options.resourceType);
  if (existing.error) throw new Error(existing.error.message ?? "Reconciliation lookup failed");

  const rows = existing.data ?? [];
  const previouslyActiveIds = rows
    .filter((row) => row.source_archived !== true)
    .map((row) => row.parasut_id);
  const chainStartedAtIso = chainStartedAt.toISOString();
  const observedIds = new Set(
    rows.filter((row) => row.last_seen_at >= chainStartedAtIso).map((row) => row.parasut_id),
  );

  const decision = evaluateReconciliationEligibility({
    loopCompletedWithoutError: true,
    errorCount: counters.errors,
    pagesFetched: counters.pages,
    observedCount: observedIds.size,
    previouslyActiveCount: previouslyActiveIds.length,
  });

  if (decision.skip) {
    return { archivedCount: 0, skippedReason: decision.reason };
  }

  const idsToArchive = computeIdsToArchive(previouslyActiveIds, observedIds);

  // Defense-in-depth beyond evaluateReconciliationEligibility's raw-count
  // ratio check: that check compares observedIds.size (this run's total)
  // against previouslyActiveIds.length, which can look healthy even if the
  // ACTUAL overlap between the two sets is poor (e.g. this run somehow
  // observed a similar count of ids that mostly don't match the mirror's
  // existing ones). Re-check using the real post-diff numbers before ever
  // touching the database.
  if (previouslyActiveIds.length > 0) {
    const survivingRatio = (previouslyActiveIds.length - idsToArchive.length) / previouslyActiveIds.length;
    if (survivingRatio < DEFAULT_MIN_OBSERVED_RATIO) {
      return { archivedCount: 0, skippedReason: "suspiciously_low_overlap" };
    }
  }

  for (const parasutId of idsToArchive) {
    const result = await mirrorDb(context)
      .from(options.table)
      .update({ source_archived: true })
      .eq("company_id", context.companyId)
      .eq("parasut_company_id", context.parasutCompanyId)
      .eq("resource_type", options.resourceType)
      .eq("parasut_id", parasutId);
    if (result.error) throw new Error(result.error.message ?? "Reconciliation archive-update failed");
  }

  return { archivedCount: idsToArchive.length, skippedReason: null };
}

async function storeIncluded(
  context: SyncContext,
  resources: JsonApiResource[],
  counters: SyncCounters,
): Promise<void> {
  for (const resource of resources) {
    const definition = INCLUDED_DEFINITIONS.get(resource.type);
    if (!definition) continue;

    counters.observed++;
    const result = await upsertResource(context.database, definition, resource, {
      companyId: context.companyId,
      parasutCompanyId: context.parasutCompanyId,
      now: context.now?.(),
    });
    countOutcome(counters, result.outcome);
  }
}

export async function syncCollection(
  context: SyncContext,
  options: SyncResourceOptions,
): Promise<SyncResult> {
  const startedAt = context.now?.() ?? new Date();
  const counters: SyncCounters = {
    pages: 0,
    observed: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
  };

  // Self-healing: a run stuck in "running" (killed mid-invocation by the
  // platform's execution timeout) must never permanently block every future
  // attempt for this tenant via enforceSingleRunner's election. This is
  // company-wide (not resource-scoped — recoverStaleRuns has no resourceType
  // filter), which is fine: it only ever touches rows already stale past the
  // heartbeat threshold, for any resource, and is safe to call on every
  // invocation. Best-effort: a database double that doesn't implement the
  // extra filter methods this uses (.is/.lt) must never break the sync
  // itself — recovery/resume are enhancements over the core fix
  // (maxPagesPerInvocation), not prerequisites for it.
  try {
    await recoverStaleRuns(context.database as unknown as RecoveryDatabase, {
      companyId: context.companyId,
      parasutCompanyId: context.parasutCompanyId,
      now: context.now?.(),
    });
  } catch {
    // Swallowed deliberately — see comment above.
  }

  const requestIdentity = {
    companyId: context.companyId,
    parasutCompanyId: context.parasutCompanyId,
    resourceType: options.resourceType,
    endpoint: options.endpoint,
    include: options.include ?? [],
    pageSize: DEFAULT_PAGE_SIZE,
  };
  let sourceRun: FailedSourceRun | null = null;
  try {
    sourceRun = await findLatestResumableRun(context, options.resourceType);
  } catch {
    // Same best-effort reasoning as recoverStaleRuns above — falls through
    // to decideSyncResume(null), which always restarts from page 1.
  }
  const resumeDecision = decideSyncResume({
    sourceRun,
    request: requestIdentity,
    acceptPageDriftRisk: true,
  });
  const pagesBeforeThisInvocation = resumeDecision.newRunMetadata.last_completed_page;
  // The true start of this *logical* run chain — carried forward unchanged
  // across every resumed invocation so reconcileMissingResources can tell
  // "observed somewhere in this whole chain" from "observed before this
  // chain even started", regardless of how many bounded invocations it took.
  const sourceChainStartedAt = sourceRun?.requestMetadata?.chain_started_at;
  const chainStartedAt =
    resumeDecision.strategy === "resume" && typeof sourceChainStartedAt === "string"
      ? new Date(sourceChainStartedAt)
      : startedAt;

  const createdRun = await createRun(context, options, chainStartedAt);
  const runId = createdRun.runId;
  let requestMetadata = createdRun.requestMetadata;
  if (resumeDecision.strategy === "resume") {
    // Seed this new run's own checkpoint from the source run's last
    // committed page so a crash between here and the first page persist
    // still resumes correctly on the *next* attempt too.
    requestMetadata = advanceCheckpointMetadata(requestMetadata, pagesBeforeThisInvocation);
    await persistCheckpoint(context, runId, requestMetadata);
  }

  let checkpointBlocked = false;
  const definition: MirrorResourceDefinition = {
    resourceType: options.resourceType,
    table: options.table,
  };
  const pageBudget = options.maxPagesPerInvocation ?? Infinity;
  let pagesThisInvocation = 0;
  let hasMore = false;

  const buildResult = (status: SyncResult["status"], reconciliation?: ReconciliationOutcome): SyncResult => ({
    ...counters,
    runId,
    resourceType: options.resourceType,
    status,
    hasMore,
    resumed: resumeDecision.strategy === "resume",
    pagesThisInvocation,
    totalPagesProcessed: pagesBeforeThisInvocation + pagesThisInvocation,
    ...(reconciliation ? { reconciliation } : {}),
  });

  try {
    if (options.concurrencyLock) {
      await enforceSingleRunner(context, options, runId);
    }

    for await (const page of context.client.getPaginated(
      options.endpoint,
      options.include,
      resumeDecision.startPage,
    )) {
      counters.pages++;
      const errorsBeforePage = counters.errors;
      const parentResources = Array.isArray(page.document.data)
        ? page.document.data
        : [];
      const included = page.document.included ?? [];

      for (const resource of parentResources) {
        counters.observed++;
        try {
          const result = await upsertResource(
            context.database,
            definition,
            resource,
            {
              companyId: context.companyId,
              parasutCompanyId: context.parasutCompanyId,
              included,
              now: context.now?.(),
            },
          );
          countOutcome(counters, result.outcome);
        } catch (error) {
          counters.errors++;
          await recordError(context, runId, resource.type, error, resource.id);
        }
      }

      try {
        await storeIncluded(context, included, counters);
      } catch (error) {
        counters.errors++;
        await recordError(context, runId, options.resourceType, error);
      }

      if (counters.errors > errorsBeforePage) checkpointBlocked = true;

      if (!checkpointBlocked) {
        const nextRequestMetadata = advanceCheckpointMetadata(
          requestMetadata,
          page.pageNumber,
        );
        await persistCheckpoint(context, runId, nextRequestMetadata);
        requestMetadata = nextRequestMetadata;
      }

      pagesThisInvocation++;
      if (pagesThisInvocation >= pageBudget) {
        // Can't know for certain this was the resource's actual last page —
        // erring toward "assume more" is always safe (reconciliation stays
        // gated off; the next invocation just discovers a short/empty page
        // and finishes for real) whereas erring toward "assume done" is not.
        hasMore = true;
        break;
      }
    }

    if (hasMore) {
      await completeRun(context, runId, counters, "partial");
      const completedAt = context.now?.() ?? new Date();
      const resume = requestMetadata.resume as Record<string, unknown> | undefined;
      await emitSyncSummary(
        context,
        createSyncSummary({
          ...counters,
          runId,
          resourceType: options.resourceType,
          status: "partial",
          startedAt,
          completedAt,
          lastCompletedPage:
            typeof resume?.last_completed_page === "number"
              ? resume.last_completed_page
              : 0,
        }),
      );
      // Never reconcile on a bounded, incomplete traversal.
      return buildResult("partial");
    }

    const status = counters.errors > 0 ? "partial" : "completed";
    await completeRun(context, runId, counters, status);
    const completedAt = context.now?.() ?? new Date();
    const resume = requestMetadata.resume as Record<string, unknown> | undefined;
    await emitSyncSummary(
      context,
      createSyncSummary({
        ...counters,
        runId,
        resourceType: options.resourceType,
        status,
        startedAt,
        completedAt,
        lastCompletedPage:
          typeof resume?.last_completed_page === "number"
            ? resume.last_completed_page
            : 0,
      }),
    );

    // Reconciliation only ever runs for a run that finished as "completed"
    // with a genuinely full traversal (never "partial", never hasMore).
    // chainStartedAt (not this invocation's own pages) is what
    // reconcileMissingResources uses to determine "observed" — see its own
    // doc comment — so this is correct even when the completing invocation
    // only walked the tail end of a resource that an earlier invocation in
    // the same resume chain started.
    let reconciliation: ReconciliationOutcome | undefined;
    if (options.reconcile) {
      if (status === "completed") {
        reconciliation = await reconcileMissingResources(context, options, chainStartedAt, counters);
      } else {
        reconciliation = { archivedCount: 0, skippedReason: "sync_run_had_errors" };
      }
    }

    return buildResult(status, reconciliation);
  } catch (error) {
    counters.errors++;
    await recordError(context, runId, options.resourceType, error);
    await completeRun(context, runId, counters, "failed");
    const completedAt = context.now?.() ?? new Date();
    const resume = requestMetadata.resume as Record<string, unknown> | undefined;
    await emitSyncSummary(
      context,
      createSyncSummary({
        ...counters,
        runId,
        resourceType: options.resourceType,
        status: "failed",
        startedAt,
        completedAt,
        lastCompletedPage:
          typeof resume?.last_completed_page === "number"
            ? resume.last_completed_page
            : 0,
      }),
    );
    throw error;
  }
}
