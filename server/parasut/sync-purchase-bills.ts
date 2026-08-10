import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

// See sync-sales-invoices.ts's MAX_PAGES_PER_INVOCATION comment — same
// include-expansion problem, same fix.
const MAX_PAGES_PER_INVOCATION = 2;

export function syncPurchaseBills(context: SyncContext, options: { concurrencyLock?: boolean } = {}): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "purchase_bills",
    table: "purchase_bills",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/purchase_bills`,
    include: ["supplier", "spender", "details", "payments"],
    concurrencyLock: options.concurrencyLock,
    maxPagesPerInvocation: MAX_PAGES_PER_INVOCATION,
    // purchase_bills is a direct-list resource with the same proven-complete
    // crawl shape as contacts (see sync-contacts.ts's reconcile comment) —
    // a purchase bill deleted in Paraşüt is simply omitted from GET
    // /purchase_bills, not returned with attributes.archived === true, so
    // absence-based reconciliation is the correct mechanism here too.
    reconcile: true,
  });
}
