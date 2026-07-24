import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

// Tiny resource (a handful of bank/cash accounts) — effectively always
// completes in one page. A generous budget just for defensive consistency.
const MAX_PAGES_PER_INVOCATION = 10;

export function syncAccounts(context: SyncContext, options: { concurrencyLock?: boolean } = {}): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "accounts",
    table: "accounts",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/accounts`,
    concurrencyLock: options.concurrencyLock,
    maxPagesPerInvocation: MAX_PAGES_PER_INVOCATION,
  });
}
