import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildProductionSyncContext } from "./run-parasut-sync-production.ts";

const VALID_ERP_COMPANY_ID = "54b50745-89e0-4b97-adb6-4f2426fa2a2f";
const VALID_PARASUT_COMPANY_ID = "666034";
const VALID_ENV = {
  RUN_PARASUT_SYNC_PRODUCTION: "1",
  ERP_COMPANY_ID: VALID_ERP_COMPANY_ID,
  PARASUT_COMPANY_ID: VALID_PARASUT_COMPANY_ID,
  PARASUT_CLIENT_ID: "client-id",
  PARASUT_CLIENT_SECRET: "client-secret",
  PARASUT_USERNAME: "user@example.com",
  PARASUT_PASSWORD: "secret-password",
  SUPABASE_URL: "https://meauutjsnnggzcigyvfp.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

const originalEnv = { ...process.env };

describe("buildProductionSyncContext", () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("refuses to run when the production guard is missing", () => {
    expect(() => buildProductionSyncContext({ ...VALID_ENV, RUN_PARASUT_SYNC_PRODUCTION: undefined })).toThrow(
      "RUN_PARASUT_SYNC_PRODUCTION",
    );
  });

  it("fails when ERP_COMPANY_ID is missing", () => {
    expect(() => buildProductionSyncContext({ ...VALID_ENV, ERP_COMPANY_ID: undefined })).toThrow("ERP_COMPANY_ID");
  });

  it("fails when PARASUT_COMPANY_ID is missing", () => {
    expect(() => buildProductionSyncContext({ ...VALID_ENV, PARASUT_COMPANY_ID: undefined })).toThrow(
      "PARASUT_COMPANY_ID",
    );
  });

  it("rejects an invalid ERP_COMPANY_ID UUID", () => {
    expect(() => buildProductionSyncContext({ ...VALID_ENV, ERP_COMPANY_ID: "not-a-uuid" })).toThrow();
  });

  it("rejects identifiers that were swapped", () => {
    expect(() =>
      buildProductionSyncContext({
        ...VALID_ENV,
        ERP_COMPANY_ID: VALID_PARASUT_COMPANY_ID,
        PARASUT_COMPANY_ID: VALID_ERP_COMPANY_ID,
      }),
    ).toThrow();
  });

  it("rejects a company id that does not match the approved value", () => {
    expect(() =>
      buildProductionSyncContext({ ...VALID_ENV, ERP_COMPANY_ID: "11111111-1111-4111-8111-111111111111" }),
    ).toThrow("ERP_COMPANY_ID mismatch");
  });

  it("rejects the wrong Supabase project", () => {
    expect(() =>
      buildProductionSyncContext({ ...VALID_ENV, SUPABASE_URL: "https://someotherproject.supabase.co" }),
    ).toThrow("Supabase target mismatch");
  });

  it("builds a context using the expected company identifiers, mapped correctly", () => {
    const { context } = buildProductionSyncContext(VALID_ENV);
    expect(context.companyId).toBe(VALID_ERP_COMPANY_ID);
    expect(context.parasutCompanyId).toBe(VALID_PARASUT_COMPANY_ID);
  });

  it("never includes credentials in the thrown error for a missing variable", () => {
    try {
      buildProductionSyncContext({ ...VALID_ENV, PARASUT_CLIENT_SECRET: undefined });
      throw new Error("expected to throw");
    } catch (error) {
      expect((error as Error).message).not.toContain(VALID_ENV.PARASUT_CLIENT_SECRET);
      expect((error as Error).message).toContain("PARASUT_CLIENT_SECRET");
    }
  });
});
