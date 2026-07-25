import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

/**
 * `concurrencyLock`: opt-in, defaults to false so the customer-creation
 * flow's contacts-only sync (ParasutContactsOnlySync) keeps its existing
 * behavior unchanged. Only the manual "Sync" button path
 * (supabase/functions/parasut-write-api/index.ts) passes true.
 */
// No include-expansion, and this resource has a proven, consistent track
// record of completing in 18 pages / ~435 records in one invocation. Bound
// it anyway for defensive safety margin — costs nothing when the resource
// is small, protects if it ever grows.
const MAX_PAGES_PER_INVOCATION = 20;

export function syncContacts(context: SyncContext, options: { concurrencyLock?: boolean } = {}): Promise<SyncResult> {
  return syncCollection(context, {
    resourceType: "contacts",
    table: "contacts",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/contacts`,
    // Keep the typed balance columns (see the 20260725151238 backfill
    // migration) populated on every write, not just the one-time backfill.
    numericAttributeFields: ["trl_balance", "usd_balance", "eur_balance", "gbp_balance"],
    maxPagesPerInvocation: MAX_PAGES_PER_INVOCATION,
    // contacts is a proven, empirically-verified complete direct-list
    // snapshot (see resource-registry.ts) — eligible for deletion
    // reconciliation. A contact deleted in Paraşüt returns HTTP 404 (not
    // attributes.archived === true) on GET, confirmed 2026-07-23, so
    // absence-based reconciliation is the correct mechanism here.
    reconcile: true,
    concurrencyLock: options.concurrencyLock,
  });
}
