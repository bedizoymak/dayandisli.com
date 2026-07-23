import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

export function syncPurchaseBills(context: SyncContext, options: { concurrencyLock?: boolean } = {}): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "purchase_bills",
    table: "purchase_bills",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/purchase_bills`,
    include: ["supplier", "spender", "details", "payments"],
    concurrencyLock: options.concurrencyLock,
  });
}
