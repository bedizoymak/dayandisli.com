import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

// No include-expansion, but 2,484 rows / ~100 pages is still large enough to
// bound defensively (this resource also had an orphaned "running" row —
// see docs/PARASUT_SYNC_ENGINE.md).
const MAX_PAGES_PER_INVOCATION = 8;

export function syncProducts(context: SyncContext, options: { concurrencyLock?: boolean } = {}): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "products",
    table: "products",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/products`,
    concurrencyLock: options.concurrencyLock,
    maxPagesPerInvocation: MAX_PAGES_PER_INVOCATION,
  });
}
