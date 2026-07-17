// Canonical company-identity contract for the Paraşüt sync engine.
//
// This module defines names only — it is prepared configuration, not wired
// into any executable sync path yet. No sync entry point currently imports
// this file. It exists so that whenever a new sync-runner is built (the
// prior local runner script was deleted before this session, per
// PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md §14c), it reads company
// identity from these two, and only these two, environment variables —
// preventing the two concepts below from ever being mixed.
//
// Two distinct identifiers exist and must NEVER be confused:
//
// 1. ERP_COMPANY_ID — the canonical INTERNAL tenant identifier. A UUID
//    matching a value in some authorized `public.erp_users.accessible_company_ids`
//    entry. This is what gets written to `parasut.*`'s
//    `company_id` column (see `SyncContext.companyId` in ./types.ts) and is
//    what `resolveCompanyScope` in ../../supabase/functions/_shared/company-scope.ts
//    validates a request against. It has nothing to do with Paraşüt itself —
//    it is purely this ERP's own tenant boundary.
//
// 2. PARASUT_COMPANY_ID — the EXTERNAL Paraşüt company identifier (a numeric
//    string, e.g. "666034" — already present as `PARASUT_COMPANY_ID` in this
//    repository's `.env`). This is what gets embedded in Paraşüt API request
//    URLs (see every `sync-*.ts` file's `endpoint` construction, e.g.
//    `sync-contacts.ts`) and written to the `parasut_company_id` column
//    (see `SyncContext.parasutCompanyId`). It identifies which company inside
//    the Paraşüt product the mirrored data came from — never which ERP
//    tenant is allowed to read it.
//
// Verified (read-only grep across every server/parasut/*.ts sync entry
// point, PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md, final RC pass): the
// existing code already keeps these two fully separate under the
// `companyId`/`parasutCompanyId` (camelCase) and `company_id`/
// `parasut_company_id` (column name) pairs — this module does not rename
// those, it only names the environment-variable contract a future runner
// must follow so the same separation holds at the configuration boundary
// too.
import { isValidUuid } from "../../supabase/functions/_shared/company-scope.ts";
import type { SyncContext } from "./types.ts";

export const ERP_COMPANY_ID_ENV = "ERP_COMPANY_ID";
export const PARASUT_COMPANY_ID_ENV = "PARASUT_COMPANY_ID";

/**
 * Reads and validates the two canonical environment variables a future sync
 * runner must use to build a `SyncContext`. Throws if either is missing —
 * there is no default and no fallback, exactly like the tenant-isolation
 * rule that a request with no resolvable company is rejected, never
 * silently widened. `ERP_COMPANY_ID` must be a valid UUID (reuses the same
 * `isValidUuid` check the Edge Function's tenant-isolation logic uses, so
 * the two never drift); `PARASUT_COMPANY_ID` only needs to be a non-empty
 * external identifier (it is not a UUID — see discovery captures, e.g. "666034").
 *
 * Not called anywhere yet — this function exists so the contract is
 * executable/testable in isolation before any real runner adopts it. It
 * never reads `public.companies` (doesn't exist in production, see report
 * §3/§14c), never generates a UUID, and never calls the Paraşüt API.
 */
export function readCanonicalCompanyIdentity(env: Record<string, string | undefined>): { erpCompanyId: string; parasutCompanyId: string } {
  const erpCompanyId = env[ERP_COMPANY_ID_ENV];
  const parasutCompanyId = env[PARASUT_COMPANY_ID_ENV];
  if (!erpCompanyId) throw new Error(`${ERP_COMPANY_ID_ENV} is required (internal ERP tenant id) and must not be confused with ${PARASUT_COMPANY_ID_ENV}.`);
  if (!isValidUuid(erpCompanyId)) throw new Error(`${ERP_COMPANY_ID_ENV} must be a valid UUID.`);
  if (!parasutCompanyId || !parasutCompanyId.trim()) {
    throw new Error(`${PARASUT_COMPANY_ID_ENV} is required (external Paraşüt company id) and must not be confused with ${ERP_COMPANY_ID_ENV}.`);
  }
  return { erpCompanyId, parasutCompanyId };
}

/**
 * Smallest possible production-safe factory: maps the canonical env vars to
 * the exact `SyncContext` fields a future runner needs — `ERP_COMPANY_ID` to
 * `SyncContext.companyId`, `PARASUT_COMPANY_ID` to `SyncContext.parasutCompanyId`
 * — and nothing else. It does not construct a `database`/`client`, does not
 * call the Paraşüt API, and is not called by anything yet; it exists purely
 * so a future runner has one correct, tested place to get these two fields
 * from instead of re-deriving them.
 */
export function buildCanonicalCompanyContext(env: Record<string, string | undefined>): Pick<SyncContext, "companyId" | "parasutCompanyId"> {
  const { erpCompanyId, parasutCompanyId } = readCanonicalCompanyIdentity(env);
  return { companyId: erpCompanyId, parasutCompanyId };
}
