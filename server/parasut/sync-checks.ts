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
    // Deliberately NOT `reconcile: true`. Unlike contacts/purchase_bills,
    // checks has no attribute confirming archived/cancelled state, and its
    // completeness as a direct-list snapshot has not been empirically
    // proven the way resource-registry.ts requires (an observed run
    // against production spanning enough invocations to see the full 40-row
    // set end-to-end, checked against a raw API count taken at the same
    // moment). Enabling reconciliation without that proof risks archiving
    // real, still-open cheques on a false "absent" signal. Leave off until
    // that evidence exists — see the implementation report.
  });
}
