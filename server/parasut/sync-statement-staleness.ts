import { PARASUT_INTEGRATION_SCHEMA, PARASUT_MIRROR_SCHEMA } from "./types.ts";
import type { SyncContext } from "./types.ts";
import { syncContactTransactionHistory } from "./sync-transaction-history.ts";

const RESOURCE_TYPE = "transaction_history_items";
export const STALE_SWEEP_HOURS = 24;

function historyEndpoint(context: SyncContext, contactParasutId: string): string {
  return `/v4/${encodeURIComponent(context.parasutCompanyId)}/contacts/${encodeURIComponent(contactParasutId)}/transaction_history_items`;
}

interface ContactRow {
  parasut_id: string;
  attributes: { trl_balance?: unknown; updated_at?: unknown } | null;
}

interface HistoryClosingRow {
  statement_order: number;
  trl_balance: number | null;
}

interface SyncRunRow {
  status: string;
  created_at: string;
  completed_at: string | null;
}

export interface ContactStaleness {
  contactParasutId: string;
  /** null = transaction_history_items has never been synced for this contact — this MUST count as stale, never as "no mismatch" (a missing baseline is not evidence of agreement). */
  mirroredClosingBalance: number | null;
  paraşütBalance: number;
  /** Infinity when mirroredClosingBalance is null, so never-synced contacts always sort to the front. */
  mismatchMagnitude: number;
  /** Hours since the last run that reached status "completed" for this contact's statement endpoint; Infinity if never completed. Independent of mismatch — this is what drives the rolling backstop sweep (item 1) so balance-neutral metadata drift (description/date edits, check status changes, deletions replaced 1:1) still gets re-synced even when the closing balance never moved. */
  hoursSinceLastCompletedSync: number;
  mostRecentActivityAt: string | null;
  reason: "never_synced" | "balance_mismatch" | "sweep_due" | "fresh";
}

/**
 * Every active, non-archived contact's staleness, in priority order (item 4):
 * largest balance mismatch first (never-synced treated as an infinite
 * mismatch — item 2), then most recent Paraşüt activity, descending. Fresh
 * contacts (no mismatch, no missing baseline, synced within STALE_SWEEP_HOURS)
 * are still returned but with reason "fresh" and sort last — callers filter
 * them out, but including them keeps this function a single source of truth
 * for both the trigger logic and the admin/observability surface.
 *
 * Deliberately does NOT consult sync_runs.status beyond "was the most recent
 * completed run recent enough" — a contact whose last run is "completed" is
 * still re-evaluated for staleness every invocation via the balance check
 * and the sweep-age check (item 3: no permanent "completed = skip forever").
 */
export async function computeContactStaleness(context: SyncContext, now: Date = new Date()): Promise<ContactStaleness[]> {
  const contactsResult = await context.database
    .schema(PARASUT_INTEGRATION_SCHEMA)
    .from<ContactRow[]>("contacts")
    .select("parasut_id, attributes")
    .eq("company_id", context.companyId)
    .eq("parasut_company_id", context.parasutCompanyId)
    .eq("source_archived", false);
  if (contactsResult.error) throw new Error(contactsResult.error.message ?? "Active contact lookup failed");
  const contacts = contactsResult.data ?? [];

  // Deliberately scoped per contact (contact_parasut_id.eq), NOT one
  // unbounded company-wide fetch. transaction_history_items and sync_runs
  // both grow past PostgREST's default ~1000-row response cap as more
  // contacts get synced, and an unbounded, unordered query silently
  // truncates instead of erroring — whichever contacts land outside the cut
  // (order unspecified) look permanently "never synced" even after a
  // successful sync, so they get repeatedly re-picked at top priority while
  // the real backlog starves. Confirmed live: 1184 rows in
  // transaction_history_items, 5 specific contacts re-synced 28 times each
  // in 36 minutes while 363 others were touched once or never. Each
  // per-contact query below returns only that contact's own (small) row
  // set, so it can never be truncated regardless of total table size.
  const closingBalanceByContact = new Map<string, number>();
  const lastCompletedAtByContact = new Map<string, string>();
  await Promise.all(contacts.map(async (contact) => {
    const [closingResult, runsResult] = await Promise.all([
      context.database
        .schema(PARASUT_MIRROR_SCHEMA)
        .from<HistoryClosingRow[]>("transaction_history_items")
        .select("statement_order, trl_balance")
        .eq("company_id", context.companyId)
        .eq("parasut_company_id", context.parasutCompanyId)
        .eq("contact_parasut_id", contact.parasut_id),
      context.database
        .schema(PARASUT_INTEGRATION_SCHEMA)
        .from<SyncRunRow[]>("sync_runs")
        .select("status, created_at, completed_at")
        .eq("company_id", context.companyId)
        .eq("parasut_company_id", context.parasutCompanyId)
        .eq("resource_type", RESOURCE_TYPE)
        .eq("request_metadata->>endpoint", historyEndpoint(context, contact.parasut_id)),
    ]);
    if (closingResult.error) throw new Error(closingResult.error.message ?? "Transaction history lookup failed");
    if (runsResult.error) throw new Error(runsResult.error.message ?? "Sync-run lookup failed");

    let latestOrder = -Infinity;
    for (const row of closingResult.data ?? []) {
      if (row.statement_order >= latestOrder) {
        latestOrder = row.statement_order;
        closingBalanceByContact.set(contact.parasut_id, Number(row.trl_balance ?? 0));
      }
    }
    let latestCompletedAt = "";
    for (const row of runsResult.data ?? []) {
      if (row.status !== "completed") continue;
      const completedAt = row.completed_at ?? row.created_at;
      if (completedAt > latestCompletedAt) latestCompletedAt = completedAt;
    }
    if (latestCompletedAt) lastCompletedAtByContact.set(contact.parasut_id, latestCompletedAt);
  }));

  const results: ContactStaleness[] = contacts.map((contact) => {
    const paraşütBalance = Number(contact.attributes?.trl_balance ?? 0);
    const mirroredClosingBalance = closingBalanceByContact.has(contact.parasut_id)
      ? (closingBalanceByContact.get(contact.parasut_id) as number)
      : null;
    const mismatchMagnitude = mirroredClosingBalance === null
      ? Infinity
      : Math.abs(paraşütBalance - mirroredClosingBalance);

    const lastCompletedAt = lastCompletedAtByContact.get(contact.parasut_id);
    const hoursSinceLastCompletedSync = lastCompletedAt
      ? (now.getTime() - new Date(lastCompletedAt).getTime()) / 3_600_000
      : Infinity;

    const mostRecentActivityAt = typeof contact.attributes?.updated_at === "string" ? contact.attributes.updated_at : null;

    let reason: ContactStaleness["reason"] = "fresh";
    if (mirroredClosingBalance === null) reason = "never_synced";
    else if (mismatchMagnitude > 0.005) reason = "balance_mismatch";
    else if (hoursSinceLastCompletedSync > STALE_SWEEP_HOURS) reason = "sweep_due";

    return { contactParasutId: contact.parasut_id, mirroredClosingBalance, paraşütBalance, mismatchMagnitude, hoursSinceLastCompletedSync, mostRecentActivityAt, reason };
  });

  results.sort((a, b) => {
    if (a.mismatchMagnitude !== b.mismatchMagnitude) return b.mismatchMagnitude - a.mismatchMagnitude;
    const aActivity = a.mostRecentActivityAt ?? "";
    const bActivity = b.mostRecentActivityAt ?? "";
    return bActivity.localeCompare(aActivity);
  });

  return results;
}

export function staleOnly(all: ContactStaleness[]): ContactStaleness[] {
  return all.filter((c) => c.reason !== "fresh");
}

const DEFAULT_MAX_PAGES_PER_INVOCATION = 20;
const DEFAULT_MAX_CONTACTS_PER_INVOCATION = 10;
/** Item 5: a distinct, alert-worthy threshold — one full sweep interval past
 * the sweep guarantee itself, so a transient backlog (e.g. a slow day) never
 * pages anyone, but a genuinely stuck pipeline (the exact class of bug that
 * caused P0) does. */
export const DEFAULT_ALERT_AFTER_HOURS = STALE_SWEEP_HOURS * 2;

export interface StatementRefreshOptions {
  maxPagesPerInvocation?: number;
  maxContactsPerInvocation?: number;
  alertAfterHours?: number;
  now?: Date;
}

export interface StatementRefreshSummary {
  staleCount: number;
  oldestStaleHours: number;
  contactsTouched: string[];
  completed: string[];
  partial: string[];
  failed: string[];
  pagesUsed: number;
  /** True when the observability threshold (item 5) was breached — log this
   * line with an [ALERT] prefix; there is no external paging system in this
   * repo to hook into, so a greppable structured log line is the same
   * observability convention already used everywhere else (logSafe /
   * SyncObservabilitySink), not an invented new mechanism. */
  alert: boolean;
  /** True when this invocation exited immediately because a prior
   * statement-refresh invocation was still in flight — see
   * INVOCATION_OVERLAP_GUARD_SECONDS. Distinct from a per-contact
   * concurrency-lock failure (which shows up in `failed` instead): this is
   * a whole-invocation skip, logged so a stuck run is visible rather than
   * silently retried every tick. */
  skippedOverlap: boolean;
}

interface RunningMarkerRow { created_at: string }

/**
 * Slightly longer than the 60s cron interval so a run that's merely running
 * a few seconds past its own tick isn't treated as stuck, but short enough
 * that a genuinely wedged run stops blocking every subsequent tick once its
 * row is reclaimed by sync-base.ts's existing recoverStaleRuns (10 minutes).
 * This is a whole-INVOCATION guard, layered on top of (not a replacement
 * for) syncContactTransactionHistory's existing per-CONTACT
 * enforceSingleRunner lock — that one stops two invocations from both
 * writing the same contact; this one stops a second invocation from
 * starting its own Paraşüt request burst at all while one is still using
 * up the shared 10-req/~10s budget.
 */
const INVOCATION_OVERLAP_GUARD_SECONDS = 90;

async function isAnotherInvocationInFlight(context: SyncContext, now: Date): Promise<boolean> {
  const cutoff = new Date(now.getTime() - INVOCATION_OVERLAP_GUARD_SECONDS * 1000).toISOString();
  const result = await context.database
    .schema(PARASUT_INTEGRATION_SCHEMA)
    .from<RunningMarkerRow[]>("sync_runs")
    .select("created_at")
    .eq("company_id", context.companyId)
    .eq("parasut_company_id", context.parasutCompanyId)
    .eq("resource_type", RESOURCE_TYPE)
    .eq("status", "running")
    .gt("created_at", cutoff);
  if (result.error) throw new Error(result.error.message ?? "Overlap-guard lookup failed");
  return (result.data ?? []).length > 0;
}

/**
 * Item 3: staleness is recomputed fresh every invocation from live balance
 * comparison + sync age (computeContactStaleness) — a contact is never
 * permanently excluded because a prior run reached "completed". Item 4:
 * budget-bounded, sequential, stops cleanly when either budget is exhausted;
 * a contact whose own page budget runs out mid-traversal is left "partial"
 * (its checkpoint is preserved by syncCollection) and simply reappears next
 * invocation via the same staleness computation — no separate resume
 * bookkeeping needed here.
 */
export async function refreshStaleStatements(
  context: SyncContext,
  options: StatementRefreshOptions = {},
): Promise<StatementRefreshSummary> {
  const maxPagesPerInvocation = options.maxPagesPerInvocation ?? DEFAULT_MAX_PAGES_PER_INVOCATION;
  const maxContactsPerInvocation = options.maxContactsPerInvocation ?? DEFAULT_MAX_CONTACTS_PER_INVOCATION;
  const alertAfterHours = options.alertAfterHours ?? DEFAULT_ALERT_AFTER_HOURS;
  const now = options.now ?? new Date();

  if (await isAnotherInvocationInFlight(context, now)) {
    return {
      staleCount: 0, oldestStaleHours: 0, contactsTouched: [], completed: [], partial: [], failed: [],
      pagesUsed: 0, alert: false, skippedOverlap: true,
    };
  }

  const all = await computeContactStaleness(context, now);
  const stale = staleOnly(all);
  const oldestStaleHours = stale.reduce((max, c) => {
    const age = Number.isFinite(c.hoursSinceLastCompletedSync) ? c.hoursSinceLastCompletedSync : Number.MAX_SAFE_INTEGER;
    return Math.max(max, age);
  }, 0);

  const summary: StatementRefreshSummary = {
    staleCount: stale.length,
    oldestStaleHours,
    contactsTouched: [],
    completed: [],
    partial: [],
    failed: [],
    pagesUsed: 0,
    alert: stale.length > 0 && oldestStaleHours > alertAfterHours,
    skippedOverlap: false,
  };

  let pagesUsed = 0;
  for (const candidate of stale) {
    if (summary.contactsTouched.length >= maxContactsPerInvocation) break;
    const budgetLeft = maxPagesPerInvocation - pagesUsed;
    if (budgetLeft <= 0) break;

    summary.contactsTouched.push(candidate.contactParasutId);
    try {
      const result = await syncContactTransactionHistory(context, candidate.contactParasutId, {
        concurrencyLock: true,
        maxPagesPerInvocation: budgetLeft,
      });
      pagesUsed += result.pagesThisInvocation;
      if (result.status === "completed") summary.completed.push(candidate.contactParasutId);
      else if (result.status === "partial") {
        summary.partial.push(candidate.contactParasutId);
        break; // budget exhausted mid-contact — stop cleanly, resume next tick.
      } else summary.failed.push(candidate.contactParasutId);
    } catch {
      // syncCollection already recorded the sanitized error and marked the
      // run "failed" before rethrowing — this contact's checkpoint (if any
      // pages committed) is preserved and it reappears in next invocation's
      // staleness computation regardless of this catch.
      summary.failed.push(candidate.contactParasutId);
    }

    if (pagesUsed >= maxPagesPerInvocation) break;
  }
  summary.pagesUsed = pagesUsed;

  return summary;
}
