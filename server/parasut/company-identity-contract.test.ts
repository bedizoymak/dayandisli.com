import { describe, expect, it } from "vitest";
import { buildCanonicalCompanyContext, ERP_COMPANY_ID_ENV, PARASUT_COMPANY_ID_ENV, readCanonicalCompanyIdentity } from "./company-identity-contract.ts";

const VALID_ERP_UUID = "54b50745-89e0-4b97-adb6-4f2426fa2a2f";

describe("canonical company identity contract", () => {
  it("reads both identifiers from their exact, distinct environment variable names", () => {
    const result = readCanonicalCompanyIdentity({ ERP_COMPANY_ID: VALID_ERP_UUID, PARASUT_COMPANY_ID: "666034" });
    expect(result).toEqual({ erpCompanyId: VALID_ERP_UUID, parasutCompanyId: "666034" });
  });

  it("rejects when ERP_COMPANY_ID is missing, never falling back to PARASUT_COMPANY_ID", () => {
    expect(() => readCanonicalCompanyIdentity({ PARASUT_COMPANY_ID: "666034" })).toThrow(ERP_COMPANY_ID_ENV);
  });

  it("rejects when PARASUT_COMPANY_ID is missing, never falling back to ERP_COMPANY_ID", () => {
    expect(() => readCanonicalCompanyIdentity({ ERP_COMPANY_ID: VALID_ERP_UUID })).toThrow(PARASUT_COMPANY_ID_ENV);
  });

  it("rejects when both are missing", () => {
    expect(() => readCanonicalCompanyIdentity({})).toThrow();
  });

  it("rejects a non-UUID ERP_COMPANY_ID — it must be the internal ERP tenant UUID, not a Paraşüt-style numeric id", () => {
    expect(() => readCanonicalCompanyIdentity({ ERP_COMPANY_ID: "666034", PARASUT_COMPANY_ID: "666034" })).toThrow(ERP_COMPANY_ID_ENV);
  });

  it("rejects a blank/whitespace-only PARASUT_COMPANY_ID", () => {
    expect(() => readCanonicalCompanyIdentity({ ERP_COMPANY_ID: VALID_ERP_UUID, PARASUT_COMPANY_ID: "   " })).toThrow(PARASUT_COMPANY_ID_ENV);
  });

  it("accepts a non-UUID PARASUT_COMPANY_ID, since the external Paraşüt id is not a UUID", () => {
    const result = readCanonicalCompanyIdentity({ ERP_COMPANY_ID: VALID_ERP_UUID, PARASUT_COMPANY_ID: "666034" });
    expect(result.parasutCompanyId).toBe("666034");
  });
});

describe("buildCanonicalCompanyContext", () => {
  it("maps ERP_COMPANY_ID -> companyId and PARASUT_COMPANY_ID -> parasutCompanyId, and nothing else", () => {
    const context = buildCanonicalCompanyContext({ ERP_COMPANY_ID: VALID_ERP_UUID, PARASUT_COMPANY_ID: "666034" });
    expect(context).toEqual({ companyId: VALID_ERP_UUID, parasutCompanyId: "666034" });
  });

  it("fails fast with no defaults when either variable is absent", () => {
    expect(() => buildCanonicalCompanyContext({ ERP_COMPANY_ID: VALID_ERP_UUID })).toThrow(PARASUT_COMPANY_ID_ENV);
    expect(() => buildCanonicalCompanyContext({ PARASUT_COMPANY_ID: "666034" })).toThrow(ERP_COMPANY_ID_ENV);
  });
});
