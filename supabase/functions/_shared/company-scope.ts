// Pure, dependency-free tenant/company scoping decision logic for the
// Paraşüt module. Zero imports (same rule as parasut-metrics.ts) so this file
// can be unit-tested with Vitest and imported unchanged by the Deno Edge
// Function — the exact logic that runs in production is what's tested.
//
// Uses ONLY the existing, confirmed-live `public.erp_users.accessible_company_ids`
// field (a `uuid[]`, default `{}`). No new company/tenant model is introduced.
// `default_company_id` appears in some frontend TypeScript types but does not
// exist as a column in production (verified via a live schema dump) and is
// never read here.
//
// IMPORTANT: permission bypass and tenant isolation are separate concerns.
// The `admin` role bypasses PERMISSION checks elsewhere (see
// src/features/erp/shared/permissions.ts hasPermission) — but this module
// never grants an "unrestricted" / "see every company" scope to ANY role,
// admin included. Every resolved scope is exactly one `company_id`, and an
// admin's requested company is validated against their own
// `accessible_company_ids` exactly like any other role's.

export interface ErpUserAuthzRow {
  role: string | null;
  roles: string[] | null;
  accessible_company_ids: string[] | null;
}

export type CompanyScopeResult = { ok: true; companyId: string } | { ok: false; reason: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/**
 * Normalizes a raw `accessible_company_ids` array (or a single id) into a
 * deduplicated, lowercased list of valid UUIDs. Postgres's `uuid` type is
 * itself case-insensitive, but the membership checks below run in plain
 * JavaScript (`Array.includes`), which is case-sensitive — without this
 * normalization, an uppercase-stored UUID and a lowercase-requested one that
 * are the SAME company would incorrectly fail to match, and a duplicated
 * entry (e.g. `["A", "A"]`) would incorrectly be counted as two distinct
 * accessible companies, wrongly forcing "multiple companies" rejection.
 */
function normalizeCompanyIds(ids: readonly (string | null | undefined)[] | null | undefined): string[] {
  const lowered = (ids ?? []).filter(isValidUuid).map((id) => id.toLowerCase());
  return Array.from(new Set(lowered));
}

/**
 * Resolves the single, exact `company_id` a request is allowed to read.
 * There is no "unrestricted" outcome — every `ok: true` result carries
 * exactly one company id, for every role including admin.
 *
 * - `accessible_company_ids` empty, null, or containing no valid UUIDs:
 *   rejected. There is no "see everything" fallback for any role.
 * - Duplicate entries and case differences in `accessible_company_ids` are
 *   normalized away first, so they can never change the outcome (a user
 *   with `["A", "A"]` is treated identically to a user with `["A"]`).
 * - A `requestedCompanyId` that is not a syntactically valid UUID: rejected,
 *   regardless of whether it happens to match a string in the allowed list.
 * - A `requestedCompanyId` that is a valid UUID but is NOT a member of the
 *   caller's (normalized) `accessible_company_ids`: rejected — never trusted
 *   just because the browser sent it, and this check applies identically to
 *   admin. Comparison is case-insensitive, so an uppercase-formatted request
 *   for an otherwise-authorized company still succeeds.
 * - A `requestedCompanyId` that IS a member of `accessible_company_ids`:
 *   scoped to exactly that company (returned in its normalized, lowercase
 *   form for a consistent downstream query value).
 * - No `requestedCompanyId` and the user has exactly one distinct accessible
 *   company: that one company is used automatically.
 * - No `requestedCompanyId` and the user has more than one distinct
 *   accessible company: rejected — an explicit `companyId` is required so a
 *   request never silently spans multiple companies.
 */
export function resolveCompanyScope(user: ErpUserAuthzRow, requestedCompanyId?: string | null): CompanyScopeResult {
  const accessible = normalizeCompanyIds(user.accessible_company_ids);

  if (accessible.length === 0) {
    return { ok: false, reason: "Kullanıcıya atanmış geçerli bir şirket (company_id) bulunmuyor." };
  }

  if (requestedCompanyId !== undefined && requestedCompanyId !== null && requestedCompanyId !== "") {
    if (!isValidUuid(requestedCompanyId)) {
      return { ok: false, reason: "Geçersiz şirket kimliği (UUID formatı hatalı)." };
    }
    const normalizedRequest = requestedCompanyId.toLowerCase();
    if (!accessible.includes(normalizedRequest)) {
      return { ok: false, reason: "İstenen şirket bu kullanıcı için yetkili değil." };
    }
    return { ok: true, companyId: normalizedRequest };
  }

  if (accessible.length === 1) {
    return { ok: true, companyId: accessible[0] };
  }

  return { ok: false, reason: "Birden fazla yetkili şirket bulunuyor; istek için companyId belirtilmelidir." };
}
