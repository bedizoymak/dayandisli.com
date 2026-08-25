// Production-safe COMPANY-WIDE Paraşüt transaction-history backfill runner.
//
// Separate from run-parasut-history-backfill.ts (targeted, env-specified
// contact ids). This runner sweeps the WHOLE company generically — no
// contact allowlist exists anywhere since 2026-08-25.
//
// No new sync engine: this sequences the existing, already-proven
// server/parasut/sync-transaction-history.ts (itself built on sync-base.ts's
// retry/backoff, resume-policy, tenant-scope, and concurrency-lock
// infrastructure) across every active, non-archived contact, discovered
// dynamically from Supabase — never a hardcoded contact list. GET-only
// toward Paraşüt (ParaşütClient has no write-capable method). Writes only
// the authoritative mirror/history rows that syncContactTransactionHistory
// already writes (parasut.transaction_history_items and its linked
// transactions/checks/opening_balances/payments records via upsertResource)
// — no schema change, no new tables, no financial/ordering/description
// logic touched.
//
// "Already checkpointed as complete" and "partially completed pagination
// checkpoint" both reuse the EXISTING per-(company, resource_type, endpoint)
// resumability already built into sync-base.ts's findLatestResumableRun/
// decideSyncResume — endpoint is contact-specific
// (".../contacts/{id}/transaction_history_items"), so that mechanism already
// disambiguates one contact's in-progress checkpoint from another's with no
// new column needed. This runner adds only the missing piece on top: which
// contacts to visit, in what order, and when to stop — by reading the
// existing sync_runs table's most recent status per contact endpoint.
import { buildProductionSyncContext } from "./run-parasut-sync-production.ts";
import { syncContactTransactionHistory } from "../server/parasut/sync-transaction-history.ts";
import { PARASUT_INTEGRATION_SCHEMA } from "../server/parasut/types.ts";
import type { SyncContext } from "../server/parasut/types.ts";
import { pathToFileURL } from "node:url";

const APPROVED_PROJECT_REF = "meauutjsnnggzcigyvfp";
const RESOURCE_TYPE = "transaction_history_items";
const DEFAULT_MAX_PAGES_PER_INVOCATION = 20;
const DEFAULT_MAX_CONTACTS_PER_INVOCATION = 15;

function historyEndpoint(context: SyncContext, contactParasutId: string): string {
  return `/v4/${encodeURIComponent(context.parasutCompanyId)}/contacts/${encodeURIComponent(contactParasutId)}/transaction_history_items`;
}

/**
 * All four explicit production guards required for this runner, on top of
 * buildProductionSyncContext's own project-ref/RUN_PARASUT_SYNC_PRODUCTION/
 * approved-identifier checks. Any missing or mismatched value refuses
 * execution — dry-run mode is exempt (see runCompanyBackfill) since it
 * performs no writes and issues no Paraşüt requests.
 */
function assertCompanyBackfillGuards(env: Record<string, string | undefined>): void {
  if (env.RUN_PARASUT_HISTORY_COMPANY_BACKFILL !== "1") {
    throw new Error("Refusing to run: RUN_PARASUT_HISTORY_COMPANY_BACKFILL=1 execution guard is not set.");
  }
  if (env.PARASUT_HISTORY_COMPANY_CONFIRM !== APPROVED_PROJECT_REF) {
    throw new Error(`Refusing to run: PARASUT_HISTORY_COMPANY_CONFIRM must exactly equal ${APPROVED_PROJECT_REF}.`);
  }
}

interface ContactRow { parasut_id: string }

/** Active, non-archived contact IDs, read dynamically from Supabase — never hardcoded. Deterministic order (ascending parasut_id) so batches are reproducible across invocations. */
async function fetchActiveContactIds(context: SyncContext): Promise<string[]> {
  const result = await context.database
    .schema(PARASUT_INTEGRATION_SCHEMA)
    .from<ContactRow[]>("contacts")
    .select("parasut_id")
    .eq("company_id", context.companyId)
    .eq("parasut_company_id", context.parasutCompanyId)
    .eq("source_archived", false);
  if (result.error) throw new Error(result.error.message ?? "Active contact lookup failed");
  return (result.data ?? []).map((row) => row.parasut_id).sort();
}

interface SyncRunRow { request_metadata: { endpoint?: string } | null; status: string; created_at: string }

/**
 * Latest sync_runs status per contact endpoint for resource_type
 * transaction_history_items, fetched in one bounded query (this project's
 * minimal DB contract has no .in()/.order()/.limit(), matching the same
 * pattern already used by findLatestResumableRun in sync-base.ts) and
 * reduced client-side to the newest row per endpoint by created_at.
 * "completed" means fully checkpointed done and safely skippable; anything
 * else (no row, "partial", "failed", stale "running") means still eligible
 * — syncContactTransactionHistory's own resume logic decides start-page.
 */
async function fetchLatestStatusByContact(context: SyncContext, contactIds: readonly string[]): Promise<Map<string, string>> {
  const result = await context.database
    .schema(PARASUT_INTEGRATION_SCHEMA)
    .from<SyncRunRow[]>("sync_runs")
    .select("request_metadata, status, created_at")
    .eq("company_id", context.companyId)
    .eq("parasut_company_id", context.parasutCompanyId)
    .eq("resource_type", RESOURCE_TYPE);
  if (result.error) throw new Error(result.error.message ?? "Sync-run status lookup failed");

  const endpointToContact = new Map(contactIds.map((id) => [historyEndpoint(context, id), id]));
  const latestByContact = new Map<string, { status: string; createdAt: string }>();
  for (const row of result.data ?? []) {
    const endpoint = row.request_metadata?.endpoint;
    const contactId = endpoint ? endpointToContact.get(endpoint) : undefined;
    if (!contactId) continue; // a run for a contact outside today's active set, or with no recorded endpoint — irrelevant here
    const existing = latestByContact.get(contactId);
    if (!existing || row.created_at > existing.createdAt) {
      latestByContact.set(contactId, { status: row.status, createdAt: row.created_at });
    }
  }
  return new Map([...latestByContact].map(([id, v]) => [id, v.status]));
}

interface Plan {
  totalActiveContacts: number;
  alreadyComplete: string[];
  remaining: string[];
  checkpointState: { neverStarted: number; partial: number; failed: number };
}

async function buildPlan(context: SyncContext): Promise<Plan> {
  const contactIds = await fetchActiveContactIds(context);
  const statusByContact = await fetchLatestStatusByContact(context, contactIds);
  const alreadyComplete: string[] = [];
  const remaining: string[] = [];
  const checkpointState = { neverStarted: 0, partial: 0, failed: 0 };
  for (const id of contactIds) {
    const status = statusByContact.get(id);
    if (status === "completed") {
      alreadyComplete.push(id);
    } else {
      remaining.push(id);
      if (status === "partial") checkpointState.partial++;
      else if (status === "failed") checkpointState.failed++;
      else checkpointState.neverStarted++; // includes a stale "running" row — treated as still eligible; syncCollection's own recoverStaleRuns/resume logic handles it safely.
    }
  }
  return { totalActiveContacts: contactIds.length, alreadyComplete, remaining, checkpointState };
}

export interface CompanyBackfillOptions {
  maxPagesPerInvocation?: number;
  maxContactsPerInvocation?: number;
  dryRun?: boolean;
}

export interface DryRunReport {
  mode: "dry-run";
  totalActiveContacts: number;
  alreadyComplete: number;
  remaining: number;
  nextBatchContactIds: string[];
  pageBudget: number;
  contactBudget: number;
  estimatedRequests: { measuredBasis: string; estimate: string };
  checkpointState: Plan["checkpointState"];
}

export interface LiveRunSummary {
  mode: "live";
  completed: string[];
  skippedAlreadyComplete: number;
  partial: string[];
  failed: string[];
  totalPagesThisInvocation: number;
  totalRequestsThisInvocation: number;
  contactsTouchedThisInvocation: number;
}

export async function runCompanyBackfill(
  env: Record<string, string | undefined> = process.env,
  options: CompanyBackfillOptions = {},
): Promise<DryRunReport | LiveRunSummary> {
  const dryRun = options.dryRun ?? false;
  const maxPagesPerInvocation = options.maxPagesPerInvocation ?? DEFAULT_MAX_PAGES_PER_INVOCATION;
  const maxContactsPerInvocation = options.maxContactsPerInvocation ?? DEFAULT_MAX_CONTACTS_PER_INVOCATION;
  if (!Number.isInteger(maxPagesPerInvocation) || maxPagesPerInvocation < 1) throw new Error("maxPagesPerInvocation must be a positive integer");
  if (!Number.isInteger(maxContactsPerInvocation) || maxContactsPerInvocation < 1) throw new Error("maxContactsPerInvocation must be a positive integer");

  // Dry-run performs no writes and issues no Paraşüt requests, so it is
  // exempt from the live-execution guards (RUN_PARASUT_HISTORY_COMPANY_
  // BACKFILL / PARASUT_HISTORY_COMPANY_CONFIRM) — but still requires the
  // same production Supabase target as any other production tooling, via
  // buildProductionSyncContext's own checks.
  if (!dryRun) assertCompanyBackfillGuards(env);

  const { context } = buildProductionSyncContext(env);
  const plan = await buildPlan(context);

  if (dryRun) {
    // Measured basis from the original acceptance backfill: ~2 page requests
    // per contact; every contact beyond the sample is a genuine unknown
    // until visited (discovery is generic, never allowlist-driven).
    const measuredBasis = "~2 page requests per contact measured during the original acceptance backfill";
    const low = plan.remaining.length * 1; // floor: at least 1 discovery request per contact
    const high = plan.remaining.length * 3; // rough ceiling using observed average + margin
    return {
      mode: "dry-run",
      totalActiveContacts: plan.totalActiveContacts,
      alreadyComplete: plan.alreadyComplete.length,
      remaining: plan.remaining.length,
      nextBatchContactIds: plan.remaining.slice(0, maxContactsPerInvocation),
      pageBudget: maxPagesPerInvocation,
      contactBudget: maxContactsPerInvocation,
      estimatedRequests: { measuredBasis, estimate: `${low}-${high} (unmeasured — true count only known once Paraşüt is actually called)` },
      checkpointState: plan.checkpointState,
    };
  }

  const summary: LiveRunSummary = {
    mode: "live",
    completed: [],
    skippedAlreadyComplete: plan.alreadyComplete.length,
    partial: [],
    failed: [],
    totalPagesThisInvocation: 0,
    totalRequestsThisInvocation: 0,
    contactsTouchedThisInvocation: 0,
  };

  let pagesUsed = 0;
  for (const contactId of plan.remaining) {
    if (summary.contactsTouchedThisInvocation >= maxContactsPerInvocation) break;
    const budgetLeft = maxPagesPerInvocation - pagesUsed;
    if (budgetLeft <= 0) break;

    summary.contactsTouchedThisInvocation++;
    try {
      const result = await syncContactTransactionHistory(context, contactId, {
        concurrencyLock: true,
        maxPagesPerInvocation: budgetLeft,
      });
      pagesUsed += result.pagesThisInvocation;
      summary.totalPagesThisInvocation += result.pagesThisInvocation;
      summary.totalRequestsThisInvocation += result.pagesThisInvocation;
      if (result.status === "completed") summary.completed.push(contactId);
      else if (result.status === "partial") {
        summary.partial.push(contactId);
        break; // page budget was consumed mid-contact — stop cleanly, resume next invocation.
      } else summary.failed.push(contactId);
    } catch {
      // syncCollection already recorded the sanitized error into sync_errors
      // and marked the run "failed" before rethrowing — this contact's
      // checkpoint (if any pages committed) is preserved for resume.
      summary.failed.push(contactId);
    }

    if (pagesUsed >= maxPagesPerInvocation) break;
  }

  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const dryRun = process.argv.includes("--dry-run");
  const maxPagesArg = process.argv.find((arg) => arg.startsWith("--max-pages="));
  const maxContactsArg = process.argv.find((arg) => arg.startsWith("--max-contacts="));
  runCompanyBackfill(process.env, {
    dryRun,
    maxPagesPerInvocation: maxPagesArg ? Number(maxPagesArg.split("=")[1]) : undefined,
    maxContactsPerInvocation: maxContactsArg ? Number(maxContactsArg.split("=")[1]) : undefined,
  })
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      if (report.mode === "live" && report.failed.length > 0) process.exitCode = 1;
    })
    .catch((error) => {
      console.error((error as Error).message);
      process.exitCode = 1;
    });
}
