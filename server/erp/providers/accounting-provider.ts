// AccountingProvider — the single contract ERP Services depend on. No ERP
// Service may import a concrete provider (ParasutAccountingProvider, a future
// LogoAccountingProvider, etc.) — only this file. See
// ACCOUNTING_PROVIDER_ARCHITECTURE.md.
import type { CurrencyAmount, CustomerProfile, MirrorAccount, MirrorDocument, MirrorLineItem, MirrorPayment, ProductProfile, SupplierProfile } from "../types.ts";

// ---------------------------------------------------------------------
// Provider metadata / lifecycle
// ---------------------------------------------------------------------
export interface ProviderMetadata {
  /** Stable machine id, e.g. "parasut", "logo". Used as the AccountingProviderRegistry lookup key. */
  id: string;
  name: string;
  version: string;
}

/** Per-resource-family read/write capability. Only `contacts` has granular write flags today (Phase 007 scope); other resource families remain read-only booleans until a later phase needs otherwise — see DAYANDISLI_PHASE_SYSTEM.md §8.5. */
export interface ContactCapabilities {
  read: boolean;
  create: boolean;
  update: boolean;
  archive: boolean;
  delete: boolean;
}

export interface ProviderCapabilities {
  accounts: boolean;
  contacts: ContactCapabilities;
  products: boolean;
  salesInvoices: boolean;
  purchaseBills: boolean;
  payments: boolean;
  dashboard: boolean;
  reports: boolean;
  syncStatus: boolean;
}

export interface ProviderHealthStatus {
  healthy: boolean;
  /** Human-readable reason when `healthy` is false — never a stack trace or raw error object (no secrets/internals leak through this contract). */
  message: string | null;
  checkedAt: string;
}

// ---------------------------------------------------------------------
// Provider-level snapshots. Deliberately raw/minimal — NOT the same as
// AnalyticsService's computed FinanceDashboardResult. A provider exposes
// what the underlying accounting system itself considers its dashboard/
// reports/sync state; the ERP Services layer is what turns that into ERP
// business intelligence. Do not conflate the two.
// ---------------------------------------------------------------------
export interface AccountingDashboardSnapshot {
  cashPosition: CurrencyAmount[];
  openReceivablesTotal: CurrencyAmount[];
  openPayablesTotal: CurrencyAmount[];
}

export interface AccountingReportsSnapshot {
  salesSummary: CurrencyAmount[];
  purchaseSummary: CurrencyAmount[];
}

export interface AccountingSyncResourceStatus {
  resource: string;
  status: "completed" | "partial" | "failed" | "running" | "never_run";
  lastRunAt: string | null;
}

export interface AccountingSyncStatusSummary {
  lastSuccessfulSyncAt: string | null;
  resourceStatuses: AccountingSyncResourceStatus[];
  errorCount: number;
}

// ---------------------------------------------------------------------
// The read-only provider contract. Deliberately has ZERO mutation methods —
// there is nothing here to accidentally call to write data. Write access is
// an entirely separate, narrowly-scoped, opt-in contract (see
// customer-write-provider.ts) that a provider implementation may
// additionally satisfy — it is never bundled into this interface, so
// "depends on AccountingProvider" can never accidentally grant write access.
// See ACCOUNTING_PROVIDER_ARCHITECTURE.md.
// ---------------------------------------------------------------------
export interface AccountingReadProvider {
  // Accounts
  getAccounts(): Promise<MirrorAccount[]>;

  // Contacts — customers and suppliers are both "contacts" with a role
  // (confirmed: every real Paraşüt contact has exactly one of these roles,
  // never both, never neither — see PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md §25).
  // A future provider without that guarantee may need to relax this later —
  // not assumed universal, just confirmed true for Paraşüt today.
  getCustomerProfile(customerId: string): Promise<CustomerProfile | null>;
  getSupplierProfile(supplierId: string): Promise<SupplierProfile | null>;

  // Products
  getProduct(productId: string): Promise<ProductProfile | null>;
  getProductSalesLineItems(productId: string): Promise<MirrorLineItem[]>;
  getProductPurchaseLineItems(productId: string): Promise<MirrorLineItem[]>;

  // Sales invoices — customer-scoped (CustomerService) and company-wide (FinanceService)
  getCustomerInvoices(customerId: string): Promise<MirrorDocument[]>;
  getAllReceivableDocuments(): Promise<MirrorDocument[]>;

  // Purchase bills — supplier-scoped (SupplierService) and company-wide (FinanceService)
  getSupplierBills(supplierId: string): Promise<MirrorDocument[]>;
  getAllPayableDocuments(): Promise<MirrorDocument[]>;

  // Payments
  getCustomerPayments(customerId: string): Promise<MirrorPayment[]>;
  getSupplierPayments(supplierId: string): Promise<MirrorPayment[]>;

  // Provider-level dashboard / reports / sync status
  getDashboardSnapshot(): Promise<AccountingDashboardSnapshot>;
  getReportsSnapshot(): Promise<AccountingReportsSnapshot>;
  getSyncStatus(): Promise<AccountingSyncStatusSummary>;
}

/** AccountingReadProvider + metadata/lifecycle. This — not AccountingReadProvider directly — is what every ERP Service depends on today. Write capability is never part of this interface (see above). */
export interface AccountingProvider extends AccountingReadProvider {
  getMetadata(): ProviderMetadata;
  getCapabilities(): ProviderCapabilities;
  getHealthStatus(): Promise<ProviderHealthStatus>;
}
