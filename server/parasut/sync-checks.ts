import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

// Verified live 2026-08-10/11: GET /v4/{company_id}/checks, total_count = 40
// — small enough to complete in a single invocation (same reasoning as
// sync-contacts.ts's bound: proven small, bounded anyway for defensive
// safety margin).
const MAX_PAGES_PER_INVOCATION = 20;

export function syncChecks(context: SyncContext, options: { concurrencyLock?: boolean } = {}): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "checks",
    table: "checks",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/checks`,
    // Without `include`, Paraşüt's checks response carries only a `meta: {}`
    // stub for issued_by/given_to (confirmed live 2026-08-22: every synced
    // check had a fully populated attributes block but a relationships block
    // with no `data` on either key) — so no check could ever be
    // automatically linked to the customer/supplier who issued or received
    // it. Requesting both relationships explicitly (same pattern already
    // used by sync-sales-invoices.ts/sync-purchase-bills.ts) lets
    // checks-api's partyFromMirror() resolve the party without requiring a
    // manual per-check ERP link for every historical cheque.
    include: ["issued_by", "given_to"],
    numericAttributeFields: ["net_total", "remaining", "remaining_in_trl", "days_overdue", "days_till_due_date"],
    maxPagesPerInvocation: MAX_PAGES_PER_INVOCATION,
    concurrencyLock: options.concurrencyLock,
    // Deletion reconciliation ENABLED (2026-08-25). The original withhold —
    // "completeness as a direct-list snapshot not empirically proven" — is
    // now discharged by three independent evidence points:
    //   1. Live API meta.total_count for /checks was 40 at enablement time
    //      (verified live 2026-08-10/11, per this file's own header note).
    //   2. The parent's own /cekler UI listed exactly 40 records while the
    //      mirror held 43 (docs/2.0 blueprint Part 3, P3.1 arithmetic).
    //   3. Direct single-resource GETs returned HTTP 404 for exactly the
    //      three mirrored-but-absent ids and nothing else was missing —
    //      absence-from-list IS the parent's deletion signal for checks
    //      (docs/2.0 backend truth audit §A: PARENT-DELETED BUT STILL
    //      MIRRORED ×3, CONFIRMED).
    // Safety posture unchanged: reconcileMissingResources archives by
    // UPDATE ... SET source_archived = true ONLY (never DELETE), runs solely
    // after a completed error-free page loop, is company/tenant-scoped,
    // refuses truncated or suspiciously-shrunk snapshots (min observed ratio
    // + surviving-overlap double guard), and is resume-chain safe via
    // last_seen_at >= chainStartedAt. ERP-origin instruments are unaffected:
    // they live in the separate overlay table, never in parasut.checks.
    reconcile: true,
  });
}
