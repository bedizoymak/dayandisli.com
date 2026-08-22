import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { assertCreateCustomerAllowed, computeCustomerCreateAvailability, CreateCustomerRejectedError, handleCreateCustomer, handleFullResync, handleResync, parseCreateCustomerRequestBody, toSafeResponse } from "./handlers.ts";
import { SyncAlreadyRunningError, type SyncResult } from "../../../server/parasut/types.ts";
import { CreateCustomerCommandHandler } from "../../../server/erp/commands/create-customer-command.ts";
import type { CreateCustomerCommandRecord } from "../../../server/erp/commands/create-customer-command.ts";
import type { ProviderCapabilities } from "../../../server/erp/providers/accounting-provider.ts";

const NOW = new Date("2026-07-16T00:00:00.000Z");
const FULL_CAPABILITIES: ProviderCapabilities = {
  accounts: true,
  contacts: { read: true, create: true, update: false, archive: false, delete: false },
  products: true,
  salesInvoices: true,
  purchaseBills: true,
  payments: true,
  dashboard: true,
  reports: true,
  syncStatus: true,
};

describe("parseCreateCustomerRequestBody", () => {
  it("accepts a well-formed body", () => {
    const parsed = parseCreateCustomerRequestBody({ input: { name: "Acme" }, idempotencyKey: "idem-1", confirmation: true });
    expect(parsed.input.name).toBe("Acme");
  });

  it("rejects when confirmation is not exactly true", () => {
    expect(() => parseCreateCustomerRequestBody({ input: { name: "Acme" }, idempotencyKey: "idem-1", confirmation: false })).toThrow(CreateCustomerRejectedError);
    expect(() => parseCreateCustomerRequestBody({ input: { name: "Acme" }, idempotencyKey: "idem-1" })).toThrow(CreateCustomerRejectedError);
  });

  it("rejects a missing idempotencyKey", () => {
    expect(() => parseCreateCustomerRequestBody({ input: { name: "Acme" }, confirmation: true })).toThrow(CreateCustomerRejectedError);
    expect(() => parseCreateCustomerRequestBody({ input: { name: "Acme" }, idempotencyKey: "  ", confirmation: true })).toThrow(CreateCustomerRejectedError);
  });

  it("rejects a missing input.name", () => {
    expect(() => parseCreateCustomerRequestBody({ input: {}, idempotencyKey: "idem-1", confirmation: true })).toThrow(CreateCustomerRejectedError);
  });

  it("rejects a non-object body", () => {
    expect(() => parseCreateCustomerRequestBody(null)).toThrow(CreateCustomerRejectedError);
    expect(() => parseCreateCustomerRequestBody("string")).toThrow(CreateCustomerRejectedError);
  });
});

describe("assertCreateCustomerAllowed", () => {
  it("passes when permission, feature flag, and capability are all satisfied", () => {
    expect(() => assertCreateCustomerAllowed({ hasPermission: true, featureFlagEnabled: true, capabilities: FULL_CAPABILITIES })).not.toThrow();
  });

  it("rejects an unauthorized user before checking anything else", () => {
    expect(() => assertCreateCustomerAllowed({ hasPermission: false, featureFlagEnabled: true, capabilities: FULL_CAPABILITIES })).toThrow(/yetkisi gereklidir/);
  });

  it("rejects when the feature flag is disabled, even for an authorized user", () => {
    expect(() => assertCreateCustomerAllowed({ hasPermission: true, featureFlagEnabled: false, capabilities: FULL_CAPABILITIES })).toThrow(/devre dışı/);
  });

  it("rejects when the provider does not support contacts.create", () => {
    const noCreateCapabilities: ProviderCapabilities = { ...FULL_CAPABILITIES, contacts: { ...FULL_CAPABILITIES.contacts, create: false } };
    expect(() => assertCreateCustomerAllowed({ hasPermission: true, featureFlagEnabled: true, capabilities: noCreateCapabilities })).toThrow(/desteklemiyor/);
  });
});

describe("computeCustomerCreateAvailability", () => {
  const BASE = { authenticated: true, companyScopeOk: true, hasPermission: true, featureFlagEnabled: true, capabilities: FULL_CAPABILITIES };

  it("is available when every gate passes", () => {
    expect(computeCustomerCreateAvailability(BASE)).toEqual({ available: true });
  });

  it("is unavailable when unauthenticated", () => {
    expect(computeCustomerCreateAvailability({ ...BASE, authenticated: false })).toEqual({ available: false });
  });

  it("is unavailable when the company scope is invalid", () => {
    expect(computeCustomerCreateAvailability({ ...BASE, companyScopeOk: false })).toEqual({ available: false });
  });

  it("is unavailable without the permission", () => {
    expect(computeCustomerCreateAvailability({ ...BASE, hasPermission: false })).toEqual({ available: false });
  });

  it("is unavailable when the feature flag is off", () => {
    expect(computeCustomerCreateAvailability({ ...BASE, featureFlagEnabled: false })).toEqual({ available: false });
  });

  it("is unavailable when the provider capability is off", () => {
    const noCreate: ProviderCapabilities = { ...FULL_CAPABILITIES, contacts: { ...FULL_CAPABILITIES.contacts, create: false } };
    expect(computeCustomerCreateAvailability({ ...BASE, capabilities: noCreate })).toEqual({ available: false });
  });

  it("never returns anything beyond the single safe boolean — no gate name, no config detail", () => {
    const result = computeCustomerCreateAvailability({ ...BASE, featureFlagEnabled: false });
    expect(Object.keys(result)).toEqual(["available"]);
  });
});

describe("toSafeResponse", () => {
  function record(overrides: Partial<CreateCustomerCommandRecord>): CreateCustomerCommandRecord {
    return {
      id: "cmd-1",
      companyId: "company-1",
      provider: "parasut",
      operation: "create_customer",
      resourceType: "contacts",
      status: "draft",
      idempotencyKey: "idem-1",
      requestedBy: "user-1",
      safePayload: { name: "Acme" },
      providerResourceId: null,
      verificationStatus: null,
      mirrorStatus: null,
      errorCode: null,
      errorMessage: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      ...overrides,
    };
  }

  it("includes mirroredParasutId only when status is mirrored_back", () => {
    const mirrored = toSafeResponse(record({ status: "mirrored_back", providerResourceId: "1010699999" }));
    expect(mirrored.mirroredParasutId).toBe("1010699999");

    const sent = toSafeResponse(record({ status: "sent", providerResourceId: "1010699999" }));
    expect(sent.mirroredParasutId).toBeUndefined();
    expect(sent.providerResourceId).toBe("1010699999");
  });

  it("never includes any field beyond the safe response shape (no raw payload, no tokens)", () => {
    const response = toSafeResponse(record({ status: "failed", errorMessage: "tax_number is invalid" }));
    expect(Object.keys(response).sort()).toEqual(["commandId", "message", "mirroredParasutId", "provider", "providerResourceId", "status"].sort());
    expect(JSON.stringify(response)).not.toMatch(/bearer|token|secret/i);
  });
});

describe("handleCreateCustomer", () => {
  it("rejects before ever calling the command handler when the guard fails", async () => {
    let called = false;
    const handler = { handle: async () => { called = true; throw new Error("should not be called"); } } as unknown as CreateCustomerCommandHandler;

    await expect(
      handleCreateCustomer(handler, "company-1", "666034", "user-1", { hasPermission: false, featureFlagEnabled: true, capabilities: FULL_CAPABILITIES }, { input: { name: "Acme" }, idempotencyKey: "idem-1", confirmation: true }),
    ).rejects.toBeInstanceOf(CreateCustomerRejectedError);
    expect(called).toBe(false);
  });

  it("calls the command handler and returns the safe response on success", async () => {
    const handler = {
      handle: async (companyId: string, providerCompanyId: string, requestedBy: string, idempotencyKey: string, input: unknown) => ({
        id: "cmd-1",
        companyId,
        provider: "parasut",
        operation: "create_customer" as const,
        resourceType: "contacts" as const,
        status: "mirrored_back" as const,
        idempotencyKey,
        requestedBy,
        safePayload: input,
        providerResourceId: "1010699999",
        verificationStatus: "verified" as const,
        mirrorStatus: "mirrored" as const,
        errorCode: null,
        errorMessage: null,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      }),
    } as unknown as CreateCustomerCommandHandler;

    const response = await handleCreateCustomer(handler, "company-1", "666034", "user-1", { hasPermission: true, featureFlagEnabled: true, capabilities: FULL_CAPABILITIES }, { input: { name: "Acme" }, idempotencyKey: "idem-1", confirmation: true });
    expect(response.status).toBe("mirrored_back");
    expect(response.mirroredParasutId).toBe("1010699999");
  });
});

describe("handleResync", () => {
  it("rejects when the caller lacks permission, without ever invoking the sync function", async () => {
    let called = false;
    await expect(
      handleResync(false, async () => {
        called = true;
        return { pages: 0, observed: 0, inserted: 0, updated: 0, unchanged: 0, errors: 0, runId: "r", resourceType: "contacts", status: "completed", hasMore: false, resumed: false, pagesThisInvocation: 0, totalPagesProcessed: 0 };
      }),
    ).rejects.toThrow(CreateCustomerRejectedError);
    expect(called).toBe(false);
  });

  it("converts a lost concurrency election (SyncAlreadyRunningError from syncCollection) into a 409, without swallowing other errors", async () => {
    await expect(
      handleResync(true, async () => {
        throw new SyncAlreadyRunningError();
      }),
    ).rejects.toMatchObject({ httpStatus: 409 });

    await expect(
      handleResync(true, async () => {
        throw new Error("some other failure");
      }),
    ).rejects.toThrow("some other failure");
  });

  it("returns the sync result's counters and reconciliation outcome on success", async () => {
    const response = await handleResync(true, async () => ({
      pages: 18,
      observed: 437,
      inserted: 0,
      updated: 1,
      unchanged: 436,
      errors: 0,
      runId: "run-1",
      resourceType: "contacts",
      status: "completed",
      reconciliation: { archivedCount: 1, skippedReason: null },
      hasMore: false,
      resumed: false,
      pagesThisInvocation: 18,
      totalPagesProcessed: 18,
    }));
    expect(response.status).toBe("completed");
    expect(response.reconciliation).toEqual({ archivedCount: 1, skippedReason: null });
    expect(response.observed).toBe(437);
    expect(response.hasMore).toBe(false);
  });

  it("surfaces continuation metadata for a bounded partial run", async () => {
    const response = await handleResync(true, async () => ({
      pages: 2,
      observed: 50,
      inserted: 10,
      updated: 5,
      unchanged: 35,
      errors: 0,
      runId: "run-2",
      resourceType: "sales_invoices",
      status: "partial",
      hasMore: true,
      resumed: true,
      pagesThisInvocation: 2,
      totalPagesProcessed: 8,
    }));
    expect(response.status).toBe("partial");
    expect(response.hasMore).toBe(true);
    expect(response.resumed).toBe(true);
    expect(response.pagesProcessedThisInvocation).toBe(2);
    expect(response.totalPagesProcessed).toBe(8);
    expect(response.resumeAfterSeconds).toBe(1);
  });
});

function fakeSyncResult(overrides: Partial<SyncResult> = {}): SyncResult {
  return {
    pages: 2,
    observed: 50,
    inserted: 0,
    updated: 0,
    unchanged: 50,
    errors: 0,
    runId: "run",
    resourceType: "sales_invoices",
    status: "completed",
    hasMore: false,
    resumed: false,
    pagesThisInvocation: 2,
    totalPagesProcessed: 2,
    ...overrides,
  };
}

describe("handleFullResync", () => {
  it("rejects when the caller lacks permission, without invoking any resource", async () => {
    let called = false;
    await expect(
      handleFullResync(false, [{ resource: "contacts", runSync: async () => { called = true; return fakeSyncResult(); } }]),
    ).rejects.toThrow(CreateCustomerRejectedError);
    expect(called).toBe(false);
  });

  it("21. resumes a bounded resource across multiple chunks within one invocation until hasMore is false", async () => {
    let calls = 0;
    const runSync = async () => {
      calls += 1;
      return calls < 3 ? fakeSyncResult({ hasMore: true, status: "partial" }) : fakeSyncResult({ hasMore: false, status: "completed" });
    };
    const response = await handleFullResync(true, [{ resource: "sales_invoices", runSync }]);
    expect(calls).toBe(3);
    expect(response.resources[0]).toMatchObject({ status: "completed", chunks: 3, hasMore: false });
    expect(response.status).toBe("completed");
  });

  it("22. accumulates inserted/updated/unchanged/errors counters across every chunk, not just the last one", async () => {
    let calls = 0;
    const results = [
      fakeSyncResult({ hasMore: true, status: "partial", inserted: 5, updated: 1, unchanged: 10 }),
      fakeSyncResult({ hasMore: false, status: "completed", inserted: 2, updated: 0, unchanged: 20 }),
    ];
    const response = await handleFullResync(true, [{ resource: "contacts", runSync: async () => results[calls++] }]);
    expect(response.resources[0]).toMatchObject({ inserted: 7, updated: 1, unchanged: 30 });
  });

  it("23. stops a resource's chunk loop on a failed chunk and marks it failed, but continues to the next resource", async () => {
    const failing = async () => fakeSyncResult({ status: "failed", hasMore: true, errors: 1 });
    const ok = async () => fakeSyncResult({ status: "completed", hasMore: false });
    const response = await handleFullResync(true, [
      { resource: "contacts", runSync: failing },
      { resource: "sales_invoices", runSync: ok },
    ]);
    expect(response.resources[0]).toMatchObject({ resource: "contacts", status: "failed" });
    expect(response.resources[1]).toMatchObject({ resource: "sales_invoices", status: "completed" });
    expect(response.status).toBe("partial");
  });

  it("24. stops the ENTIRE sequence immediately on a concurrency conflict, never starting a later resource", async () => {
    let salesInvoicesCalled = false;
    const response = await handleFullResync(true, [
      { resource: "contacts", runSync: async () => { throw new SyncAlreadyRunningError(); } },
      { resource: "sales_invoices", runSync: async () => { salesInvoicesCalled = true; return fakeSyncResult(); } },
    ]);
    expect(salesInvoicesCalled).toBe(false);
    expect(response.status).toBe("conflict");
    expect(response.conflictResource).toBe("contacts");
  });

  it("25. stops resuming a resource once the chunk safety limit is reached, reporting it partial with hasMore true", async () => {
    let calls = 0;
    const runSync = async () => { calls += 1; return fakeSyncResult({ hasMore: true, status: "partial" }); };
    const response = await handleFullResync(true, [{ resource: "purchase_bills", runSync }], { maxChunksPerResource: 3 });
    expect(calls).toBe(3);
    expect(response.resources[0]).toMatchObject({ status: "partial", chunks: 3, hasMore: true });
  });

  it("25b. stops starting new chunks once the elapsed-time safety limit is reached", async () => {
    let calls = 0;
    let now = new Date("2026-08-22T00:00:00.000Z");
    const runSync = async () => {
      calls += 1;
      now = new Date(now.getTime() + 40_000); // each chunk advances the clock 40s
      return fakeSyncResult({ hasMore: true, status: "partial" });
    };
    const response = await handleFullResync(true, [{ resource: "purchase_bills", runSync }], {
      maxElapsedMs: 90_000,
      now: () => now,
    });
    expect(calls).toBeLessThanOrEqual(3); // 90s budget / 40s per chunk
    expect(response.resources[0].status).toBe("partial");
    expect(response.resources[0].hasMore).toBe(true);
  });

  it("26. never reports a resource (or the overall run) as completed while any chunk still has more pages", async () => {
    const runSync = async () => fakeSyncResult({ hasMore: true, status: "partial" });
    const response = await handleFullResync(true, [{ resource: "checks", runSync }], { maxChunksPerResource: 1 });
    expect(response.resources[0].status).not.toBe("completed");
    expect(response.status).not.toBe("completed");
  });

  it("records start/completion timestamps for the whole run", async () => {
    const now = new Date("2026-08-22T10:00:00.000Z");
    const response = await handleFullResync(true, [{ resource: "contacts", runSync: async () => fakeSyncResult() }], { now: () => now });
    expect(response.startedAt).toBe("2026-08-22T10:00:00.000Z");
    expect(response.completedAt).toBe("2026-08-22T10:00:00.000Z");
  });
});

describe("parasut-write-api checks resync wiring", () => {
  it("routes checks through the existing GET-only syncChecks wrapper", () => {
    const source = readFileSync("supabase/functions/parasut-write-api/index.ts", "utf8");

    expect(source).toContain('import { syncChecks } from "../../../server/parasut/sync-checks.ts"');
    expect(source).toMatch(/checks:\s*\{\s*resourceType:\s*"checks",\s*run:\s*syncChecks\s*\}/);
    expect(source).toContain("mapping.run(context, { concurrencyLock: true })");
  });

  it("full-resync reuses SYNCABLE_RESOURCES' existing runners (checks included) — no second sync engine", () => {
    const source = readFileSync("supabase/functions/parasut-write-api/index.ts", "utf8");

    const fullResyncIndex = source.indexOf('if (action === "full-resync")');
    expect(fullResyncIndex).toBeGreaterThan(-1);
    const fullResyncBlock = source.slice(fullResyncIndex, fullResyncIndex + 900);
    expect(fullResyncBlock).toContain('if (!access.isAdmin) return json({ error: "Bu işlem için ERP yöneticisi yetkisi gereklidir." }, 403);');
    expect(source).toContain('FULL_RESYNC_RESOURCE_ORDER = ["customers", "sales_invoices", "purchase_bills", "checks"]');
    expect(source).toContain("SYNCABLE_RESOURCES[resource].run(context, { concurrencyLock: true })");
    expect(source).toContain("handleFullResync(access.isAdmin, resources)");
  });
});
