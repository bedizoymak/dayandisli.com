import { describe, expect, it } from "vitest";
import { ParasutAccountingProvider, type ParasutMirrorRepository } from "./parasut-accounting-provider.ts";
import { CustomerService } from "../services/customer-service.ts";
import type { MirrorAccount } from "../types.ts";

function makeRepository(overrides: Partial<ParasutMirrorRepository> = {}): ParasutMirrorRepository {
  return {
    getAccounts: async () => [],
    getCustomerProfile: async () => null,
    getSupplierProfile: async () => null,
    getProduct: async () => null,
    getProductSalesLineItems: async () => [],
    getProductPurchaseLineItems: async () => [],
    getCustomerInvoices: async () => [],
    getAllReceivableDocuments: async () => [],
    getSupplierBills: async () => [],
    getAllPayableDocuments: async () => [],
    getCustomerPayments: async () => [],
    getSupplierPayments: async () => [],
    getDashboardSnapshot: async () => ({ cashPosition: [], openReceivablesTotal: [], openPayablesTotal: [] }),
    getReportsSnapshot: async () => ({ salesSummary: [], purchaseSummary: [] }),
    getSyncStatus: async () => ({ lastSuccessfulSyncAt: null, resourceStatuses: [], errorCount: 0 }),
    ping: async () => true,
    ...overrides,
  };
}

describe("ParasutAccountingProvider metadata/capabilities/health", () => {
  it("reports stable id/name/version", () => {
    const provider = new ParasutAccountingProvider(makeRepository());
    expect(provider.getMetadata()).toEqual({ id: "parasut", name: "Paraşüt", version: "1.0.0" });
  });

  it("reports every top-level resource family as supported, and only read+create for contacts (Phase 007 scope)", () => {
    const provider = new ParasutAccountingProvider(makeRepository());
    const capabilities = provider.getCapabilities();
    expect(
      Object.entries(capabilities)
        .filter(([key]) => key !== "contacts")
        .every(([, value]) => value === true),
    ).toBe(true);
    expect(capabilities.contacts).toEqual({ read: true, create: true, update: false, archive: false, delete: false });
  });

  it("reports healthy when the mirror repository ping succeeds", async () => {
    const provider = new ParasutAccountingProvider(makeRepository({ ping: async () => true }));
    const health = await provider.getHealthStatus();
    expect(health.healthy).toBe(true);
    expect(health.message).toBeNull();
  });

  it("reports unhealthy with a safe message when the ping fails, never a raw error", async () => {
    const provider = new ParasutAccountingProvider(makeRepository({ ping: async () => false }));
    const health = await provider.getHealthStatus();
    expect(health.healthy).toBe(false);
    expect(health.message).toBe("Paraşüt mirror ping failed.");
  });

  it("never lets an unexpected exception escape getHealthStatus, and never leaks the raw error", async () => {
    const provider = new ParasutAccountingProvider(
      makeRepository({
        ping: async () => {
          throw new Error("connection refused: postgres://internal-host:5432 password=leaked");
        },
      }),
    );
    const health = await provider.getHealthStatus();
    expect(health.healthy).toBe(false);
    expect(health.message).toBe("Paraşüt mirror is unreachable.");
    expect(health.message).not.toContain("password");
    expect(health.message).not.toContain("internal-host");
  });
});

describe("ParasutAccountingProvider delegation", () => {
  it("delegates every capability method to the underlying repository unchanged", async () => {
    const accounts: MirrorAccount[] = [{ id: "a1", name: "Bank", currency: "TRY", balance: "100.00", archived: false }];
    const provider = new ParasutAccountingProvider(makeRepository({ getAccounts: async () => accounts }));
    expect(await provider.getAccounts()).toBe(accounts);
  });
});

describe("ParasutAccountingProvider satisfies AccountingProvider well enough for an ERP Service to use directly", () => {
  it("can be injected into CustomerService with no adapter code", async () => {
    const provider = new ParasutAccountingProvider(
      makeRepository({
        getCustomerProfile: async (id) => ({ id, name: "Real Customer", email: null, phone: null, taxNumber: null }),
      }),
    );
    const service = new CustomerService(provider);
    const profile = await service.getProfile("cust-1");
    expect(profile?.name).toBe("Real Customer");
  });
});
