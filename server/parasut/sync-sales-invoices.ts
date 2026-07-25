import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

// include-expanded (contact/details/payments) — each page is far heavier
// than a bare list page, and this resource's records_observed history shows
// it was the one being killed mid-invocation by the platform timeout.
// Small budget, resumed across multiple invocations by the caller.
const MAX_PAGES_PER_INVOCATION = 2;

export function syncSalesInvoices(context: SyncContext, options: { concurrencyLock?: boolean } = {}): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "sales_invoices",
    table: "sales_invoices",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/sales_invoices`,
    include: ["contact", "details", "payments"],
    // Keep the typed gross_total column (see the 20260725154949 backfill
    // migration) populated on every write, not just the one-time backfill.
    numericAttributeFields: ["gross_total"],
    concurrencyLock: options.concurrencyLock,
    maxPagesPerInvocation: MAX_PAGES_PER_INVOCATION,
  });
}
