import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

/**
 * `concurrencyLock`: opt-in, defaults to false so the customer-creation
 * flow's contacts-only sync (ParasutContactsOnlySync) keeps its existing
 * behavior unchanged. Only the manual "Sync" button path
 * (supabase/functions/parasut-write-api/index.ts) passes true.
 */
export function syncContacts(context: SyncContext, options: { concurrencyLock?: boolean } = {}): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "contacts",
    table: "contacts",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/contacts`,
    // contacts is a proven, empirically-verified complete direct-list
    // snapshot (see resource-registry.ts) — eligible for deletion
    // reconciliation. A contact deleted in Paraşüt returns HTTP 404 (not
    // attributes.archived === true) on GET, confirmed 2026-07-23, so
    // absence-based reconciliation is the correct mechanism here.
    reconcile: true,
    concurrencyLock: options.concurrencyLock,
  });
}
