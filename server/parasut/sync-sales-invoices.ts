import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

export function syncSalesInvoices(context: SyncContext, options: { concurrencyLock?: boolean } = {}): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "sales_invoices",
    table: "sales_invoices",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/sales_invoices`,
    include: ["contact", "details", "payments"],
    concurrencyLock: options.concurrencyLock,
  });
}
