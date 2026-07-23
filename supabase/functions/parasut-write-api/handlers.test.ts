import { describe, expect, it } from "vitest";
import { assertCreateCustomerAllowed, computeCustomerCreateAvailability, CreateCustomerRejectedError, handleCreateCustomer, handleResync, parseCreateCustomerRequestBody, toSafeResponse, type ConcurrencyGuard } from "./handlers.ts";
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

const NOT_RUNNING: ConcurrencyGuard = { isResourceSyncRunning: async () => false };
const ALREADY_RUNNING: ConcurrencyGuard = { isResourceSyncRunning: async () => true };

describe("handleResync", () => {
  it("rejects when the caller lacks permission, without ever invoking the sync function or the concurrency guard", async () => {
    let called = false;
    let guardCalled = false;
    const guard: ConcurrencyGuard = { isResourceSyncRunning: async () => { guardCalled = true; return false; } };
    await expect(
      handleResync(false, guard, "company-1", "contacts", async () => {
        called = true;
        return { pages: 0, observed: 0, inserted: 0, updated: 0, unchanged: 0, errors: 0, runId: "r", resourceType: "contacts", status: "completed" };
      }),
    ).rejects.toThrow(CreateCustomerRejectedError);
    expect(called).toBe(false);
    expect(guardCalled).toBe(false);
  });

  it("rejects with a 409-style error when a sync for this resource is already running, without starting another one", async () => {
    let called = false;
    await expect(
      handleResync(true, ALREADY_RUNNING, "company-1", "contacts", async () => {
        called = true;
        return { pages: 0, observed: 0, inserted: 0, updated: 0, unchanged: 0, errors: 0, runId: "r", resourceType: "contacts", status: "completed" };
      }),
    ).rejects.toMatchObject({ httpStatus: 409 });
    expect(called).toBe(false);
  });

  it("returns the sync result's counters and reconciliation outcome on success", async () => {
    const response = await handleResync(true, NOT_RUNNING, "company-1", "contacts", async () => ({
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
    }));
    expect(response.status).toBe("completed");
    expect(response.reconciliation).toEqual({ archivedCount: 1, skippedReason: null });
    expect(response.observed).toBe(437);
  });
});
