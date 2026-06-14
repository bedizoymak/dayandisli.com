import { describe, expect, it } from "vitest";
import {
  assertLocalOnlyEnvironment,
  createSyntheticPayload,
  isLocalSupabaseUrl,
  PRODUCTION_PROJECT_REF,
  verifyDatabaseCleanup,
} from "./local-safety.ts";

describe("isLocalSupabaseUrl", () => {
  it("accepts localhost", () => {
    expect(isLocalSupabaseUrl("http://localhost:54321")).toBe(true);
    expect(isLocalSupabaseUrl("https://localhost/rest/v1")).toBe(true);
  });

  it("accepts 127.0.0.1", () => {
    expect(isLocalSupabaseUrl("http://127.0.0.1:54321")).toBe(true);
  });

  it("rejects cloud and public URLs", () => {
    expect(isLocalSupabaseUrl("https://example.supabase.co")).toBe(false);
    expect(isLocalSupabaseUrl("https://example.com")).toBe(false);
    expect(isLocalSupabaseUrl("http://192.168.1.20:54321")).toBe(false);
  });

  it("rejects the production project reference", () => {
    expect(
      isLocalSupabaseUrl(`https://${PRODUCTION_PROJECT_REF}.supabase.co`),
    ).toBe(false);
    expect(
      isLocalSupabaseUrl(
        `http://localhost:54321/${PRODUCTION_PROJECT_REF}/rest/v1`,
      ),
    ).toBe(false);
  });
});

describe("assertLocalOnlyEnvironment", () => {
  const validEnvironment = {
    SUPABASE_URL: "http://127.0.0.1:54321",
    SUPABASE_ANON_KEY: "synthetic-local-anon-key",
    RUN_LOCAL_DB_TESTS: "1",
  };

  it("accepts an explicitly opted-in local environment", () => {
    expect(assertLocalOnlyEnvironment(validEnvironment)).toEqual({
      supabaseUrl: validEnvironment.SUPABASE_URL,
      supabaseAnonKey: validEnvironment.SUPABASE_ANON_KEY,
    });
  });

  it("rejects a missing opt-in", () => {
    expect(() =>
      assertLocalOnlyEnvironment({
        ...validEnvironment,
        RUN_LOCAL_DB_TESTS: undefined,
      }),
    ).toThrow("RUN_LOCAL_DB_TESTS=1");
  });

  it("rejects a missing anonymous key", () => {
    expect(() =>
      assertLocalOnlyEnvironment({
        ...validEnvironment,
        SUPABASE_ANON_KEY: " ",
      }),
    ).toThrow("SUPABASE_ANON_KEY");
  });

  it("rejects a cloud environment even with opt-in", () => {
    expect(() =>
      assertLocalOnlyEnvironment({
        ...validEnvironment,
        SUPABASE_URL: "https://example.supabase.co",
      }),
    ).toThrow("localhost or 127.0.0.1");
  });
});

describe("verifyDatabaseCleanup", () => {
  it("passes when no synthetic rows remain", () => {
    expect(() =>
      verifyDatabaseCleanup({
        parasut_sync_runs: 0,
        parasut_contacts: 0,
        parasut_sync_errors: 0,
      }),
    ).not.toThrow();
  });

  it("fails with the remaining synthetic row counts", () => {
    expect(() =>
      verifyDatabaseCleanup({
        parasut_sync_runs: 1,
        parasut_contacts: 0,
        parasut_sync_errors: 2,
      }),
    ).toThrow(
      "Synthetic database cleanup is incomplete: parasut_sync_runs=1, parasut_sync_errors=2",
    );
  });
});

describe("createSyntheticPayload", () => {
  it("creates deterministic non-personal test data", () => {
    const payload = createSyntheticPayload(7, "products");

    expect(payload).toEqual({
      marker: "dayan-local-integration",
      runId: "local-run-0007",
      resourceType: "products",
      externalId: "synthetic-products-0007",
      attributes: {
        synthetic: true,
        sequence: 7,
      },
    });
    expect(JSON.stringify(payload)).not.toMatch(
      /email|phone|address|customer|token|secret/i,
    );
  });
});

