import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

// Verified live (resource-registry.ts): 6 rows — single-page resource.
// `reconcile` intentionally left unset (false); deletion semantics have not
// been empirically confirmed for this resource (only contacts qualifies —
// see sync-contacts.ts).
const MAX_PAGES_PER_INVOCATION = 4;

export function syncEmployees(context: SyncContext, options: { concurrencyLock?: boolean } = {}): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "employees",
    table: "employees",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/employees`,
    concurrencyLock: options.concurrencyLock,
    maxPagesPerInvocation: MAX_PAGES_PER_INVOCATION,
  });
}
