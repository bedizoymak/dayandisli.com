import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

export function syncProducts(context: SyncContext): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "products",
    table: "products",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/products`,
  });
}
