import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

export function syncPurchaseBills(context: SyncContext): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "purchase_bills",
    table: "parasut_purchase_bills",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/purchase_bills`,
    include: ["spender", "details", "payments"],
  });
}
