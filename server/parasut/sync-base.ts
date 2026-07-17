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
import type {
  JsonApiResource,
  MirrorResourceDefinition,
  SyncContext,
  SyncCounters,
  SyncResourceOptions,
  SyncResult,
} from "./types.ts";
import { PARASUT_INTEGRATION_SCHEMA } from "./types.ts";

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
): Promise<{ runId: string; requestMetadata: Record<string, unknown> }> {
  const runId = randomUUID();
  const requestMetadata = initializeCheckpointMetadata(
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
  );
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
  const createdRun = await createRun(context, options);
  const runId = createdRun.runId;
  let requestMetadata = createdRun.requestMetadata;
  let checkpointBlocked = false;
  const definition: MirrorResourceDefinition = {
    resourceType: options.resourceType,
    table: options.table,
  };

  try {
    for await (const page of context.client.getPaginated(
      options.endpoint,
      options.include,
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
    return { ...counters, runId, resourceType: options.resourceType, status };
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
