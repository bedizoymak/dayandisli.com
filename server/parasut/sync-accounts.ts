import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

export function syncAccounts(context: SyncContext, options: { concurrencyLock?: boolean } = {}): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "accounts",
    table: "accounts",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/accounts`,
    concurrencyLock: options.concurrencyLock,
  });
}
