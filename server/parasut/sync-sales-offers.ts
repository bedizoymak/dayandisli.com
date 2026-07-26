import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

// Verified live (resource-registry.ts): 1 row — single-page resource.
// `reconcile` intentionally left unset (false); deletion semantics have not
// been empirically confirmed for this resource (only contacts qualifies —
// see sync-contacts.ts).
const MAX_PAGES_PER_INVOCATION = 4;

export function syncSalesOffers(context: SyncContext, options: { concurrencyLock?: boolean } = {}): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "sales_offers",
    table: "sales_offers",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/sales_offers`,
    concurrencyLock: options.concurrencyLock,
    maxPagesPerInvocation: MAX_PAGES_PER_INVOCATION,
  });
}
