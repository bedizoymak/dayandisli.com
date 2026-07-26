import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

// Verified live (2026-07-23 discovery run, resource-registry.ts): 1,626 rows
// across 66 pages — the largest confirmed-populated resource among the
// previously-unwrapped set. No include-expansion; bounded defensively given
// the page count. `reconcile` intentionally left unset (false) — deletion
// semantics for this resource have not been empirically confirmed the way
// they were for contacts (see sync-contacts.ts), so absence-based archival
// is not yet safe to enable here.
const MAX_PAGES_PER_INVOCATION = 10;

export function syncEInvoices(context: SyncContext, options: { concurrencyLock?: boolean } = {}): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "e_invoices",
    table: "e_invoices",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/e_invoices`,
    concurrencyLock: options.concurrencyLock,
    maxPagesPerInvocation: MAX_PAGES_PER_INVOCATION,
  });
}
