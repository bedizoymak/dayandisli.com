import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

export function syncAccounts(context: SyncContext): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "accounts",
    table: "parasut_accounts",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/accounts`,
  });
}
