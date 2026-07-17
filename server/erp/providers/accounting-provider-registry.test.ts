import { describe, expect, it } from "vitest";
import { AccountingProviderRegistry, UnknownProviderError } from "./accounting-provider-registry.ts";
import { LogoAccountingProvider } from "./logo-accounting-provider.ts";
import { ParasutAccountingProvider, type ParasutMirrorRepository } from "./parasut-accounting-provider.ts";

function makeParasutProvider(): ParasutAccountingProvider {
  const repository: ParasutMirrorRepository = {
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
  };
  return new ParasutAccountingProvider(repository);
}

describe("AccountingProviderRegistry", () => {
  it("registers and resolves a provider by its metadata id", () => {
    const registry = new AccountingProviderRegistry();
    const provider = makeParasutProvider();
    registry.register(provider);
    expect(registry.resolve("parasut")).toBe(provider);
  });

  it("throws UnknownProviderError rather than returning undefined for an unregistered id", () => {
    const registry = new AccountingProviderRegistry();
    expect(() => registry.resolve("logo")).toThrow(UnknownProviderError);
  });

  it("supports multiple registered providers simultaneously", () => {
    const registry = new AccountingProviderRegistry();
    registry.register(makeParasutProvider());
    registry.register(new LogoAccountingProvider());

    expect(registry.has("parasut")).toBe(true);
    expect(registry.has("logo")).toBe(true);
    expect(registry.listMetadata().map((meta) => meta.id)).toEqual(["logo", "parasut"]);
  });

  it("returns capabilities for a specific provider without resolving it manually", () => {
    const registry = new AccountingProviderRegistry();
    registry.register(makeParasutProvider());
    expect(registry.getCapabilities("parasut").dashboard).toBe(true);
  });
});
