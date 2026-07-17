import { describe, expect, it } from "vitest";
import { isValidUuid, resolveCompanyScope, type ErpUserAuthzRow } from "./company-scope.ts";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const NOT_MINE = "99999999-9999-4999-8999-999999999999";

function user(overrides: Partial<ErpUserAuthzRow> = {}): ErpUserAuthzRow {
  return { role: "viewer", roles: [], accessible_company_ids: [], ...overrides };
}

describe("isValidUuid", () => {
  it("accepts a well-formed v4 UUID", () => {
    expect(isValidUuid(COMPANY_A)).toBe(true);
  });

  it("rejects non-UUID strings, including SQL-injection-shaped input", () => {
    expect(isValidUuid("not-a-uuid")).toBe(false);
    expect(isValidUuid("11111111-1111-4111-8111-11111111111")).toBe(false); // too short
    expect(isValidUuid("'; drop table parasut.contacts; --")).toBe(false);
    expect(isValidUuid(123)).toBe(false);
    expect(isValidUuid(null)).toBe(false);
    expect(isValidUuid(undefined)).toBe(false);
  });
});

describe("resolveCompanyScope — no unrestricted outcome for any role", () => {
  it("rejects a non-admin user with no accessible companies — no fallback", () => {
    expect(resolveCompanyScope(user({ accessible_company_ids: [] })).ok).toBe(false);
  });

  it("rejects an admin user with no accessible companies — admin gets NO bypass of tenant isolation", () => {
    const result = resolveCompanyScope(user({ role: "admin", accessible_company_ids: [] }));
    expect(result.ok).toBe(false);
  });

  it("rejects a null accessible_company_ids field for both admin and non-admin", () => {
    expect(resolveCompanyScope(user({ role: "admin", accessible_company_ids: null })).ok).toBe(false);
    expect(resolveCompanyScope(user({ role: "viewer", accessible_company_ids: null })).ok).toBe(false);
  });

  it("filters out non-UUID garbage in accessible_company_ids before counting", () => {
    const result = resolveCompanyScope(user({ accessible_company_ids: ["not-a-uuid", ""] }));
    expect(result.ok).toBe(false);
  });

  it("never returns an unrestricted/null-filter result — every ok:true result carries exactly one companyId string", () => {
    const result = resolveCompanyScope(user({ role: "admin", accessible_company_ids: [COMPANY_A] }));
    expect(result).toEqual({ ok: true, companyId: COMPANY_A });
    if (result.ok) {
      expect(typeof result.companyId).toBe("string");
    }
  });
});

describe("resolveCompanyScope — single accessible company auto-selected", () => {
  it("auto-selects the one accessible company when no companyId is requested", () => {
    expect(resolveCompanyScope(user({ accessible_company_ids: [COMPANY_A] }))).toEqual({ ok: true, companyId: COMPANY_A });
  });

  it("auto-selects for admin too — same rule, no special case", () => {
    expect(resolveCompanyScope(user({ role: "admin", accessible_company_ids: [COMPANY_A] }))).toEqual({ ok: true, companyId: COMPANY_A });
  });
});

describe("resolveCompanyScope — multiple accessible companies require an explicit companyId", () => {
  it("rejects when the user has multiple accessible companies and no companyId was requested", () => {
    const result = resolveCompanyScope(user({ accessible_company_ids: [COMPANY_A, COMPANY_B] }));
    expect(result.ok).toBe(false);
  });

  it("scopes to exactly the requested company when it is a member of the user's accessible set", () => {
    expect(resolveCompanyScope(user({ accessible_company_ids: [COMPANY_A, COMPANY_B] }), COMPANY_B)).toEqual({ ok: true, companyId: COMPANY_B });
  });
});

describe("resolveCompanyScope — browser-supplied companyId is always validated, never trusted", () => {
  it("rejects a syntactically invalid companyId even if it happens to be in accessible_company_ids-shaped data", () => {
    const result = resolveCompanyScope(user({ accessible_company_ids: [COMPANY_A] }), "not-a-uuid");
    expect(result.ok).toBe(false);
  });

  it("rejects a well-formed UUID that is not in the user's accessible set — for a regular (finance) role", () => {
    const result = resolveCompanyScope(user({ role: "finance", accessible_company_ids: [COMPANY_A] }), NOT_MINE);
    expect(result.ok).toBe(false);
  });

  it("rejects a well-formed UUID that is not in the user's accessible set — for admin too, same validation applies", () => {
    const result = resolveCompanyScope(user({ role: "admin", accessible_company_ids: [COMPANY_A] }), NOT_MINE);
    expect(result.ok).toBe(false);
  });

  it("admin requesting a company outside their accessible set is rejected even when they have OTHER accessible companies", () => {
    const result = resolveCompanyScope(user({ role: "admin", accessible_company_ids: [COMPANY_A, COMPANY_B] }), NOT_MINE);
    expect(result.ok).toBe(false);
  });
});

describe("cross-company isolation regression guard", () => {
  it("a user authorized only for company A resolving with no explicit request never yields company B", () => {
    const result = resolveCompanyScope(user({ accessible_company_ids: [COMPANY_A] }));
    if (!result.ok) throw new Error("expected ok");
    expect(result.companyId).toBe(COMPANY_A);
    expect(result.companyId).not.toBe(COMPANY_B);
  });

  it("recognizes admin via roles[] even when the primary role column is something else, but still enforces membership", () => {
    const result = resolveCompanyScope(user({ role: "finance", roles: ["finance", "admin"], accessible_company_ids: [COMPANY_A] }), COMPANY_B);
    expect(result.ok).toBe(false);
  });
});

describe("resolveCompanyScope — normalization: case and duplicates never change the outcome", () => {
  it("accepts an uppercase UUID stored in accessible_company_ids, auto-selecting it as the single company", () => {
    const result = resolveCompanyScope(user({ accessible_company_ids: [COMPANY_A.toUpperCase()] }));
    expect(result).toEqual({ ok: true, companyId: COMPANY_A });
  });

  it("matches an uppercase requested companyId against a lowercase-stored accessible id", () => {
    const result = resolveCompanyScope(user({ accessible_company_ids: [COMPANY_A] }), COMPANY_A.toUpperCase());
    expect(result).toEqual({ ok: true, companyId: COMPANY_A });
  });

  it("matches a lowercase requested companyId against an uppercase-stored accessible id", () => {
    const result = resolveCompanyScope(user({ accessible_company_ids: [COMPANY_A.toUpperCase()] }), COMPANY_A);
    expect(result).toEqual({ ok: true, companyId: COMPANY_A });
  });

  it("treats duplicate entries (even mixed-case duplicates) as a single accessible company, not multiple", () => {
    const result = resolveCompanyScope(user({ accessible_company_ids: [COMPANY_A, COMPANY_A, COMPANY_A.toUpperCase()] }));
    expect(result).toEqual({ ok: true, companyId: COMPANY_A });
  });

  it("still rejects with multiple distinct companies even if some entries are duplicated", () => {
    const result = resolveCompanyScope(user({ accessible_company_ids: [COMPANY_A, COMPANY_A, COMPANY_B] }));
    expect(result.ok).toBe(false);
  });

  it("this exact behavior applies identically to admin — no special-cased normalization bypass", () => {
    const result = resolveCompanyScope(user({ role: "admin", accessible_company_ids: [COMPANY_A.toUpperCase(), COMPANY_A] }));
    expect(result).toEqual({ ok: true, companyId: COMPANY_A });
  });
});
