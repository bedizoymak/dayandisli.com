// Shared ERP business-layer types. These are the ERP's OWN domain model —
// deliberately shaped for the ERP's needs, not copied from Paraşüt's JSON:API
// attribute names. Adapters (built in a later phase) translate mirror rows
// INTO these shapes; nothing downstream of this file should ever see a raw
// Paraşüt attribute key. See ERP_BUSINESS_ARCHITECTURE.md.

export interface CurrencyAmount {
  currency: string;
  amount: string;
}

// ---------------------------------------------------------------------
// Generic mirror-derived document/line shapes, reused across services.
// These are the "port" contracts a repository adapter must satisfy —
// intentionally decoupled from parasut.* column/attribute names so the
// business layer never breaks if the mirror's internal shape changes.
// ---------------------------------------------------------------------
export interface MirrorDocument {
  id: string;
  partyId: string | null;
  currency: string;
  netTotal: string;
  grossTotal: string;
  remaining: string;
  totalPaid: string;
  issueDate: string;
  dueDate: string | null;
  archived: boolean;
}

export interface MirrorPayment {
  id: string;
  documentId: string;
  date: string;
  amount: string;
  currency: string;
}

export interface MirrorLineItem {
  id: string;
  documentId: string;
  productId: string | null;
  quantity: string;
  unitPrice: string;
  netTotal: string;
  currency: string;
  /** The parent document's issue date — Paraşüt line items have no date of their own. */
  date: string;
}

export interface MirrorAccount {
  id: string;
  name: string;
  currency: string;
  balance: string;
  archived: boolean;
}

// ---------------------------------------------------------------------
// Payment-behavior building block, shared by Customer/Supplier services.
// ---------------------------------------------------------------------
export interface PaymentBehavior {
  onTimeCount: number;
  lateCount: number;
  averageDelayDays: number | null;
  /** Payments that could not be matched to a document with a due date — never silently folded into onTime/late. */
  unresolvedCount: number;
}

export interface TrendPoint {
  month: string; // YYYY-MM
  currency: string;
  total: string;
  documentCount: number;
}

// ---------------------------------------------------------------------
// Shared contact/product profile types — used by both the service layer and
// the AccountingProvider contract, so they live here rather than in a
// service file (a provider-contract file importing a service file, and vice
// versa, would be a circular dependency).
// ---------------------------------------------------------------------
export interface CustomerProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  taxNumber: string | null;
}

export interface SupplierProfile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  taxNumber: string | null;
}

export interface ProductProfile {
  id: string;
  name: string;
  code: string | null;
  currency: string;
  /** Cost basis for gross-margin calculation — Paraşüt's confirmed `buying_price`/`buying_currency` attributes. Null when unknown. */
  buyingPrice: string | null;
  buyingCurrency: string | null;
}

// ---------------------------------------------------------------------
// CustomerService result types
// ---------------------------------------------------------------------
export interface CustomerAnalyticsResult {
  customerId: string;
  turnover: CurrencyAmount[];
  outstandingBalance: CurrencyAmount[];
  lastInvoiceDate: string | null;
  lastInvoiceId: string | null;
  invoiceCount: number;
  salesTrend: TrendPoint[];
  paymentBehavior: PaymentBehavior;
  calculatedAt: string;
}

// ---------------------------------------------------------------------
// SupplierService result types
// ---------------------------------------------------------------------
export interface SupplierAnalyticsResult {
  supplierId: string;
  purchaseTotal: CurrencyAmount[];
  outstandingBalance: CurrencyAmount[];
  billCount: number;
  purchaseTrend: TrendPoint[];
  paymentBehavior: PaymentBehavior;
  /** Not computable from currently mirrored fields (no PO/receiving dates) — always null until that data exists. See ERP_BUSINESS_ARCHITECTURE.md. */
  averageLeadTimeDays: null;
  score: SupplierScore;
  calculatedAt: string;
}

export interface SupplierScore {
  /** 0-100, heuristic only — see computeSupplierScore doc comment for the exact formula and its limitations. */
  value: number;
  onTimePaymentRatio: number | null;
  overdueBillCount: number;
}

// ---------------------------------------------------------------------
// ProductService result types
// ---------------------------------------------------------------------
export interface ProductMovementEvent {
  date: string;
  direction: "in" | "out";
  quantity: string;
  documentId: string;
}

export interface ProductAnalyticsResult {
  productId: string;
  salesQuantity: string;
  purchaseQuantity: string;
  turnover: CurrencyAmount[];
  /** Null when the product has no known buying_price (cost basis) for its currency. */
  grossMargin: CurrencyAmount[] | null;
  movementHistory: ProductMovementEvent[];
  calculatedAt: string;
}

// ---------------------------------------------------------------------
// FinanceService result types
// ---------------------------------------------------------------------
export interface FinanceSummary {
  totalReceivables: CurrencyAmount[];
  totalPayables: CurrencyAmount[];
  overdueReceivables: CurrencyAmount[];
  overduePayables: CurrencyAmount[];
  overdueReceivableCount: number;
  overduePayableCount: number;
  cashPosition: CurrencyAmount[];
  monthlyReceivablesSummary: TrendPoint[];
  monthlyPayablesSummary: TrendPoint[];
  calculatedAt: string;
}

// ---------------------------------------------------------------------
// AnalyticsService result types (dashboard composition layer)
// ---------------------------------------------------------------------
export interface KpiCard {
  key: string;
  label: string;
  values: CurrencyAmount[];
}

export interface GrowthMetric {
  currency: string;
  currentPeriodTotal: string;
  previousPeriodTotal: string;
  /** Null when the previous period total is zero — percentage growth is undefined, never fabricated as 0% or Infinity. */
  growthPercent: number | null;
}

export interface FinanceDashboardResult {
  kpis: KpiCard[];
  revenueTrend: TrendPoint[];
  purchaseTrend: TrendPoint[];
  revenueGrowth: GrowthMetric[];
  /** Sales net − purchase net, labeled as an estimate (excludes overhead/COGS precision) — same honesty convention as the Paraşüt monthly VAT estimate. */
  grossProfitEstimate: CurrencyAmount[];
  finance: FinanceSummary;
  calculatedAt: string;
}
