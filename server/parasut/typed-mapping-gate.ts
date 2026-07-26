// Phase 2B write-path safety gate. Controls whether upsert-resource.ts uses
// the full field-mapping-registry-driven typed-column mapper
// (offline-mapper.ts / deriveOfflineRow) instead of the legacy
// numeric-only mapping.
//
// SAFETY INVARIANT: a default or missing configuration MUST keep this
// disabled. There is no other flag, code path, or fallback that enables
// typed mapping — this module is the single source of truth for the gate.

/**
 * Scope-confined: only resources with an EXISTING production sync wrapper
 * (server/parasut/sync-*.ts) are eligible. Adding a resource here requires
 * the corresponding sync-*.ts wrapper to already exist — this set is what
 * keeps the typed-mapping write path from reaching resources that have no
 * real synchronization boundary yet.
 * See docs/parasut/PARASUT_PROFESSIONAL_INTEGRATION_MASTER_PLAN.md §18/§19.
 */
export const TYPED_MAPPING_SCOPED_RESOURCES: ReadonlySet<string> = new Set([
  "accounts",
  "contacts",
  "products",
  "sales_invoices",
  "purchase_bills",
  "e_invoices",
  "employees",
  "sales_offers",
  "shipment_documents",
  "warehouses",
]);

export function isResourceInTypedMappingScope(resourceType: string): boolean {
  return TYPED_MAPPING_SCOPED_RESOURCES.has(resourceType);
}

/**
 * The single write-enable check. `env` is injectable for tests; in
 * production it defaults to `process.env`, which — if the variable is
 * absent, empty, or anything other than the literal string "1" — resolves
 * to disabled. This mirrors the existing production-guard convention
 * (scripts/run-parasut-sync-production.ts's RUN_PARASUT_SYNC_PRODUCTION).
 */
export function isTypedMappingEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PARASUT_TYPED_MAPPING_ENABLED === "1";
}

/** Combined check used at the exact point of row construction. */
export function shouldUseTypedMapping(
  resourceType: string,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return isTypedMappingEnabled(env) && isResourceInTypedMappingScope(resourceType);
}
