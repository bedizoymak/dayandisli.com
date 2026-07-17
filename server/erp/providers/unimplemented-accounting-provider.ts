// Shared base for future-provider skeletons (Logo, Mikro, Netsis, SAP
// Business One, Luca, ETA). Every capability throws a clear, typed error
// rather than silently returning empty data — a caller must never mistake
// "not implemented yet" for "this company genuinely has zero accounts."
// See ACCOUNTING_PROVIDER_ARCHITECTURE.md "Future Providers".
import type { CustomerProfile, MirrorAccount, MirrorDocument, MirrorLineItem, MirrorPayment, ProductProfile, SupplierProfile } from "../types.ts";
import type {
  AccountingDashboardSnapshot,
  AccountingProvider,
  AccountingReportsSnapshot,
  AccountingSyncStatusSummary,
  ProviderCapabilities,
  ProviderHealthStatus,
  ProviderMetadata,
} from "./accounting-provider.ts";

export class ProviderNotImplementedError extends Error {
  constructor(providerId: string, capability: string) {
    super(`${providerId} accounting provider does not implement "${capability}" yet.`);
    this.name = "ProviderNotImplementedError";
  }
}

const NO_CAPABILITIES: ProviderCapabilities = {
  accounts: false,
  contacts: { read: false, create: false, update: false, archive: false, delete: false },
  products: false,
  salesInvoices: false,
  purchaseBills: false,
  payments: false,
  dashboard: false,
  reports: false,
  syncStatus: false,
};

export abstract class UnimplementedAccountingProvider implements AccountingProvider {
  protected constructor(private readonly metadata: ProviderMetadata) {}

  /** Returns a rejected promise rather than throwing synchronously — every AccountingProvider method is async, and a synchronous throw here would bypass normal Promise-based error handling (e.g. `.catch()`, `await ... catch`) that callers correctly expect for every other provider. */
  private notImplemented<T>(capability: string): Promise<T> {
    return Promise.reject(new ProviderNotImplementedError(this.metadata.id, capability));
  }

  getMetadata(): ProviderMetadata {
    return this.metadata;
  }

  getCapabilities(): ProviderCapabilities {
    return NO_CAPABILITIES;
  }

  async getHealthStatus(): Promise<ProviderHealthStatus> {
    return { healthy: false, message: `${this.metadata.name} provider is not implemented yet.`, checkedAt: new Date().toISOString() };
  }

  getAccounts(): Promise<MirrorAccount[]> {
    return this.notImplemented("getAccounts");
  }

  getCustomerProfile(_customerId: string): Promise<CustomerProfile | null> {
    return this.notImplemented("getCustomerProfile");
  }

  getSupplierProfile(_supplierId: string): Promise<SupplierProfile | null> {
    return this.notImplemented("getSupplierProfile");
  }

  getProduct(_productId: string): Promise<ProductProfile | null> {
    return this.notImplemented("getProduct");
  }

  getProductSalesLineItems(_productId: string): Promise<MirrorLineItem[]> {
    return this.notImplemented("getProductSalesLineItems");
  }

  getProductPurchaseLineItems(_productId: string): Promise<MirrorLineItem[]> {
    return this.notImplemented("getProductPurchaseLineItems");
  }

  getCustomerInvoices(_customerId: string): Promise<MirrorDocument[]> {
    return this.notImplemented("getCustomerInvoices");
  }

  getAllReceivableDocuments(): Promise<MirrorDocument[]> {
    return this.notImplemented("getAllReceivableDocuments");
  }

  getSupplierBills(_supplierId: string): Promise<MirrorDocument[]> {
    return this.notImplemented("getSupplierBills");
  }

  getAllPayableDocuments(): Promise<MirrorDocument[]> {
    return this.notImplemented("getAllPayableDocuments");
  }

  getCustomerPayments(_customerId: string): Promise<MirrorPayment[]> {
    return this.notImplemented("getCustomerPayments");
  }

  getSupplierPayments(_supplierId: string): Promise<MirrorPayment[]> {
    return this.notImplemented("getSupplierPayments");
  }

  getDashboardSnapshot(): Promise<AccountingDashboardSnapshot> {
    return this.notImplemented("getDashboardSnapshot");
  }

  getReportsSnapshot(): Promise<AccountingReportsSnapshot> {
    return this.notImplemented("getReportsSnapshot");
  }

  getSyncStatus(): Promise<AccountingSyncStatusSummary> {
    return this.notImplemented("getSyncStatus");
  }
}
