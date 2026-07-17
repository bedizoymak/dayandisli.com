// ParasutAccountingProvider — the AccountingProvider implementation backed by
// the Paraşüt mirror (parasut.*). This is the ONLY file in the ERP business
// layer allowed to know that "Paraşüt" exists at all; every ERP Service only
// ever sees the generic AccountingProvider interface. See
// ACCOUNTING_PROVIDER_ARCHITECTURE.md.
//
// This class does NOT talk to Supabase/parasut.* directly — it delegates to
// a `ParasutMirrorRepository` (the "existing ERP repositories" composed into
// one port). A real, Supabase-backed implementation of that repository is a
// later phase (see ACCOUNTING_PROVIDER_ARCHITECTURE.md "Remaining Work");
// this file is complete and testable today with an in-memory fake, exactly
// like every ERP Service already is.
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

/** The "existing ERP repositories" this provider consumes internally — one port per resource family, composed. No parasut.* SQL/PostgREST calls happen in this file. */
export interface ParasutMirrorRepository {
  getAccounts(): Promise<MirrorAccount[]>;
  getCustomerProfile(customerId: string): Promise<CustomerProfile | null>;
  getSupplierProfile(supplierId: string): Promise<SupplierProfile | null>;
  getProduct(productId: string): Promise<ProductProfile | null>;
  getProductSalesLineItems(productId: string): Promise<MirrorLineItem[]>;
  getProductPurchaseLineItems(productId: string): Promise<MirrorLineItem[]>;
  getCustomerInvoices(customerId: string): Promise<MirrorDocument[]>;
  getAllReceivableDocuments(): Promise<MirrorDocument[]>;
  getSupplierBills(supplierId: string): Promise<MirrorDocument[]>;
  getAllPayableDocuments(): Promise<MirrorDocument[]>;
  getCustomerPayments(customerId: string): Promise<MirrorPayment[]>;
  getSupplierPayments(supplierId: string): Promise<MirrorPayment[]>;
  getDashboardSnapshot(): Promise<AccountingDashboardSnapshot>;
  getReportsSnapshot(): Promise<AccountingReportsSnapshot>;
  getSyncStatus(): Promise<AccountingSyncStatusSummary>;
  /** Cheap connectivity/permission check — e.g. a single scoped row-count query. Never throws; returns false on any failure. */
  ping(): Promise<boolean>;
}

const METADATA: ProviderMetadata = { id: "parasut", name: "Paraşüt", version: "1.0.0" };

// Per DAYANDISLI_PHASE_SYSTEM.md §8.5: only contacts.create is enabled this
// phase — update/archive/delete remain false until Phases 008/009 implement
// them. This is the read-only ParasutAccountingProvider's own capability
// report; ParasutCustomerWriteProvider re-declares the same "create: true"
// fact independently so the two can never silently drift apart.
const CAPABILITIES: ProviderCapabilities = {
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

export class ParasutAccountingProvider implements AccountingProvider {
  constructor(private readonly repository: ParasutMirrorRepository) {}

  getMetadata(): ProviderMetadata {
    return METADATA;
  }

  getCapabilities(): ProviderCapabilities {
    return CAPABILITIES;
  }

  async getHealthStatus(): Promise<ProviderHealthStatus> {
    const checkedAt = new Date().toISOString();
    try {
      const healthy = await this.repository.ping();
      return { healthy, message: healthy ? null : "Paraşüt mirror ping failed.", checkedAt };
    } catch {
      // Never leak the underlying error (may contain internal detail) through this contract — see ProviderHealthStatus doc comment.
      return { healthy: false, message: "Paraşüt mirror is unreachable.", checkedAt };
    }
  }

  getAccounts(): Promise<MirrorAccount[]> {
    return this.repository.getAccounts();
  }

  getCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
    return this.repository.getCustomerProfile(customerId);
  }

  getSupplierProfile(supplierId: string): Promise<SupplierProfile | null> {
    return this.repository.getSupplierProfile(supplierId);
  }

  getProduct(productId: string): Promise<ProductProfile | null> {
    return this.repository.getProduct(productId);
  }

  getProductSalesLineItems(productId: string): Promise<MirrorLineItem[]> {
    return this.repository.getProductSalesLineItems(productId);
  }

  getProductPurchaseLineItems(productId: string): Promise<MirrorLineItem[]> {
    return this.repository.getProductPurchaseLineItems(productId);
  }

  getCustomerInvoices(customerId: string): Promise<MirrorDocument[]> {
    return this.repository.getCustomerInvoices(customerId);
  }

  getAllReceivableDocuments(): Promise<MirrorDocument[]> {
    return this.repository.getAllReceivableDocuments();
  }

  getSupplierBills(supplierId: string): Promise<MirrorDocument[]> {
    return this.repository.getSupplierBills(supplierId);
  }

  getAllPayableDocuments(): Promise<MirrorDocument[]> {
    return this.repository.getAllPayableDocuments();
  }

  getCustomerPayments(customerId: string): Promise<MirrorPayment[]> {
    return this.repository.getCustomerPayments(customerId);
  }

  getSupplierPayments(supplierId: string): Promise<MirrorPayment[]> {
    return this.repository.getSupplierPayments(supplierId);
  }

  getDashboardSnapshot(): Promise<AccountingDashboardSnapshot> {
    return this.repository.getDashboardSnapshot();
  }

  getReportsSnapshot(): Promise<AccountingReportsSnapshot> {
    return this.repository.getReportsSnapshot();
  }

  getSyncStatus(): Promise<AccountingSyncStatusSummary> {
    return this.repository.getSyncStatus();
  }
}
