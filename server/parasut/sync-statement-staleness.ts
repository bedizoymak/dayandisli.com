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
  /** Item 3: a per-contact enforceSingleRunner election loss — expected,
   * benign contention, not a real failure. Kept separate from `failed`. */
  superseded: string[];
  failed: string[];
  pagesUsed: number;
  /** True when the observability threshold (item 5) was breached — log this
   * line with an [ALERT] prefix; there is no external paging system in this
   * repo to hook into, so a greppable structured log line is the same
   * observability convention already used everywhere else (logSafe /
   * SyncObservabilitySink), not an invented new mechanism. */
  alert: boolean;
  /** True when this invocation exited immediately because a prior
   * statement-refresh invocation was still in flight (lease held or held-
   * and-since-reaped this same call). Distinct from a per-contact
   * concurrency-lock failure (which shows up in `failed` instead): this is
   * a whole-invocation skip, logged so a stuck run is visible rather than
   * silently retried every tick. */
  skippedOverlap: boolean;
}

// A fixed time window ("skip if a running row is younger than N seconds")
// only bounds how LONG it prevents overlap, not WHETHER it does — any run
// that legitimately takes longer than the window (slow Paraşüt response, a
// large multi-page contact) becomes unprotected exactly when overlap is
// most likely and most costly. Replaced with a heartbeat lease instead:
// the holding invocation renews it after every contact it processes, so
// protection lasts as long as real progress is happening, not a fixed
// clock. A lease with no heartbeat for LEASE_ORPHAN_SECONDS is explicitly
// reaped (marked "failed" — it never got type "superseded" because it
// never lost a fair election, it just went silent — and logged) rather
// than silently expiring with no signal.
//
// A pg_advisory_lock (session-scoped, released automatically if the
// holding connection dies) was considered and rejected: this codebase's
// only Postgres access is the Supabase JS client over PostgREST/RPC, where
// each call independently checks out a pooled connection for the duration
// of that single request. There is no connection held open for the whole
// Edge Function invocation for a session-scoped lock to be tied to — an
// advisory lock acquired via one RPC call would release the instant that
// call returned, long before the invocation's real work (many further,
// separate requests) even started. That would make it a no-op, not a
// guard. The lease approach needs no persistent connection: acquisition,
// every heartbeat, and release are each their own ordinary, independently
// poolable request.
const LOCK_RESOURCE_TYPE = "statement_refresh_lock";
const LEASE_ORPHAN_SECONDS = 45;

interface LeaseRow { id: string; request_metadata: { last_heartbeat_at?: string } | null }

/**
 * Atomic acquire: the partial unique index
 * sync_runs_statement_refresh_lock_singleton (company_id,
 * parasut_company_id) WHERE resource_type = 'statement_refresh_lock' AND
 * status = 'running' makes a second concurrent insert fail with a
 * uniqueness violation — a database-enforced guarantee, not a
 * check-then-act race in application code. Orphaned leases (no heartbeat
 * within LEASE_ORPHAN_SECONDS) are reaped first so a genuinely dead
 * invocation doesn't block forever.
 */
async function acquireInvocationLease(context: SyncContext, now: Date): Promise<string | null> {
  // .maybeSingle(), not an unbounded .select() — the partial unique index
  // guarantees at most one 'running' row can exist for this
  // (company, parasut_company, resource_type) at a time, so this is
  // genuinely bounded to 0-1 rows, not merely assumed to be.
  const existing = await context.database
    .schema(PARASUT_INTEGRATION_SCHEMA)
    .from<LeaseRow>("sync_runs")
    .select("id, request_metadata")
    .eq("company_id", context.companyId)
    .eq("parasut_company_id", context.parasutCompanyId)
    .eq("resource_type", LOCK_RESOURCE_TYPE)
    .eq("status", "running")
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message ?? "Lease lookup failed");

  if (existing.data) {
    const row = existing.data;
    const heartbeat = row.request_metadata?.last_heartbeat_at;
    const ageSeconds = heartbeat ? (now.getTime() - new Date(heartbeat).getTime()) / 1000 : Infinity;
    if (ageSeconds <= LEASE_ORPHAN_SECONDS) return null; // a live lease is held elsewhere — skip this invocation entirely.
    // Orphaned: the holder went silent (crashed / killed mid-run) without releasing it. Explicit reap, not a silent timeout.
    console.warn(`[statement-refresh] reaping orphaned lease ${row.id} — no heartbeat for ${ageSeconds.toFixed(0)}s`);
    await context.database.schema(PARASUT_INTEGRATION_SCHEMA).from("sync_runs")
      .update({ status: "failed", completed_at: now.toISOString() }).eq("id", row.id);
  }

  const insertResult = await context.database
    .schema(PARASUT_INTEGRATION_SCHEMA)
    .from<{ id: string }>("sync_runs")
    .insert({
      company_id: context.companyId,
      parasut_company_id: context.parasutCompanyId,
      resource_type: LOCK_RESOURCE_TYPE,
      trigger_type: context.triggerType ?? "local_manual",
      status: "running",
      request_metadata: { last_heartbeat_at: now.toISOString() },
    })
    .select("id")
    .single();
  if (insertResult.error) {
    // Another invocation's insert won the race after our read above (the
    // unique index rejects the loser) — that is exactly the guard working,
    // not a genuine error.
    return null;
  }
  return insertResult.data?.id ?? null;
}

async function renewLease(context: SyncContext, leaseId: string, now: Date): Promise<void> {
  await context.database.schema(PARASUT_INTEGRATION_SCHEMA).from("sync_runs")
    .update({ request_metadata: { last_heartbeat_at: now.toISOString() } })
    .eq("id", leaseId).eq("status", "running");
}

async function releaseLease(context: SyncContext, leaseId: string, status: "completed" | "failed", now: Date): Promise<void> {
  await context.database.schema(PARASUT_INTEGRATION_SCHEMA).from("sync_runs")
    .update({ status, completed_at: now.toISOString() })
    .eq("id", leaseId);
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

  const leaseId = await acquireInvocationLease(context, now);
  if (!leaseId) {
    return {
      staleCount: 0, oldestStaleHours: 0, contactsTouched: [], completed: [], partial: [], superseded: [], failed: [],
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
    superseded: [],
    failed: [],
    pagesUsed: 0,
    alert: stale.length > 0 && oldestStaleHours > alertAfterHours,
    skippedOverlap: false,
  };

  let pagesUsed = 0;
  try {
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
        } else if (result.status === "superseded") summary.superseded.push(candidate.contactParasutId);
        else summary.failed.push(candidate.contactParasutId);
      } catch {
        // syncCollection already recorded the sanitized error and marked the
        // run "failed" before rethrowing — this contact's checkpoint (if any
        // pages committed) is preserved and it reappears in next invocation's
        // staleness computation regardless of this catch.
        summary.failed.push(candidate.contactParasutId);
      }

      // The heartbeat IS forward progress through the stale list — renewing
      // it here (not on a separate timer) means the lease only stays valid
      // as long as this invocation is actually doing something, and a run
      // stuck retrying a single contact for too long naturally lets the
      // next invocation reap it rather than staying falsely "protected".
      await renewLease(context, leaseId, options.now ?? new Date());

      if (pagesUsed >= maxPagesPerInvocation) break;
    }
    summary.pagesUsed = pagesUsed;
    await releaseLease(context, leaseId, "completed", options.now ?? new Date());
    return summary;
  } catch (error) {
    await releaseLease(context, leaseId, "failed", options.now ?? new Date());
    throw error;
  }
}
