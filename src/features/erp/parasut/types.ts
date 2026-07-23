// Typed shapes for the `parasut`/`integration` mirror tables, restricted to
// attribute keys confirmed against real captured Paraşüt API responses in
// tools/parasut/discovery/*.json (see PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md).
// Every mirror row also carries many other passthrough attributes not listed
// here — access those via `attributes` directly when needed, never assume an
// unconfirmed field exists.

export type JsonApiRelationshipRef = { data?: { id: string; type: string } | { id: string; type: string }[] | null };
export type JsonApiRelationships = Record<string, JsonApiRelationshipRef | undefined>;

export interface MirrorRowBase {
  id: string;
  parasut_id: string;
  attributes: Record<string, unknown>;
  relationships: JsonApiRelationships;
  source_created_at: string | null;
  source_updated_at: string | null;
  source_archived: boolean | null;
  synced_at: string;
  last_seen_at: string;
}

export interface ContactAttributes {
  name: string | null;
  short_name: string | null;
  email: string | null;
  phone: string | null;
  contact_type: "company" | "person" | string | null;
  account_type: "customer" | "supplier" | string | null;
  tax_number: string | null;
  tax_office: string | null;
  city: string | null;
  district: string | null;
  address: string | null;
  balance: string | null;
  trl_balance: string | null;
  usd_balance: string | null;
  eur_balance: string | null;
  gbp_balance: string | null;
  term_days: number | null;
  archived: boolean | null;
}

export interface ProductAttributes {
  code: string | null;
  name: string | null;
  unit: string | null;
  vat_rate: string | null;
  list_price: string | null;
  currency: string | null;
  buying_price: string | null;
  buying_currency: string | null;
  inventory_tracking: boolean | null;
  stock_count: string | null;
  barcode: string | null;
  archived: boolean | null;
}

export interface InvoiceLikeAttributes {
  invoice_no: string | null;
  issue_date: string | null;
  due_date: string | null;
  description: string | null;
  currency: string | null;
  net_total: string | null;
  gross_total: string | null;
  total_vat: string | null;
  total_discount: string | null;
  remaining: string | null;
  total_paid: string | null;
  payment_status: string | null;
  archived: boolean | null;
  days_overdue: number | null;
  days_till_due_date: number | null;
  is_recurred_item: boolean | null;
  printed_at: string | null;
  sharings_count: number | null;
}

export interface InvoiceDetailAttributes {
  description: string | null;
  quantity: string | null;
  unit_price: string | null;
  vat_rate: string | null;
  discount: string | null;
  discount_type: string | null;
  net_total: string | null;
  vat: string | null;
  detail_no: number | null;
}

export interface PaymentAttributes {
  date: string | null;
  due_date: string | null;
  amount: string | null;
  amount_in_trl: string | null;
  currency: string | null;
  notes: string | null;
}

export interface AccountAttributes {
  name: string | null;
  currency: string | null;
  account_type: "cash" | "bank" | "credit_card" | "credit" | string | null;
  balance: string | null;
  iban: string | null;
  bank_name: string | null;
  bank_branch: string | null;
  archived: boolean | null;
  last_used_at: string | null;
}

export interface SyncRunRow {
  id: string;
  company_id: string;
  parasut_company_id: string;
  resource_type: string;
  trigger_type: string;
  status: "running" | "completed" | "partial" | "failed";
  started_at: string;
  completed_at: string | null;
  page_count: number;
  records_observed: number;
  records_inserted: number;
  records_updated: number;
  records_unchanged: number;
  error_count: number;
  /** Operational pagination/checkpoint metadata only (endpoint, include list, resume cursor) — never contains tokens or headers, see server/parasut/sync-base.ts. */
  request_metadata?: Record<string, unknown> | null;
}

export interface SyncErrorRow {
  id: string;
  sync_run_id: string;
  resource_type: string;
  parasut_id: string | null;
  http_status: number | null;
  error_code: string | null;
  sanitized_message: string;
  retryable: boolean;
  occurred_at: string;
}

export const RESOURCE_TYPE_LABELS: Record<string, string> = {
  contacts: "Cariler",
  products: "Ürünler",
  sales_invoices: "Satış Faturaları",
  purchase_bills: "Alış Faturaları",
  accounts: "Kasa/Banka Hesapları",
};

export type ParasutListResource =
  | "customers" | "suppliers" | "products" | "sales_invoices" | "purchase_bills" | "accounts" | "payments"
  | "sales_offers" | "bank_fees" | "taxes" | "transactions"
  | "inventory_levels" | "stock_movements" | "stock_updates" | "shipment_documents" | "item_categories"
  | "employees" | "salaries"
  | "e_invoices" | "e_invoice_inboxes" | "e_archives" | "e_smms"
  | "trackable_jobs";

export type GenericParasutRow = MirrorRowBase & {
  attributes: Record<string, unknown>;
};

// ---------------------------------------------------------------------
// parasut-api edge function response shapes
// ---------------------------------------------------------------------

export interface CurrencyTotal {
  currency: string;
  total: string;
}

export interface OpenDocumentSummary {
  totalDue: CurrencyTotal[];
  overdue: CurrencyTotal[];
  unscheduled: CurrencyTotal[];
  recurringCount: number;
  overdueCount: number;
  unscheduledCount: number;
}

export interface UnsentSummary {
  count: number;
  currencyTotals: CurrencyTotal[];
}

export interface VatEstimate {
  currency: string;
  outputVat: string;
  inputVat: string;
  netVat: string;
}

export interface TimelineEntry {
  kind: "receivable" | "payable";
  parasutId: string;
  documentNo: string | null;
  partyName: string | null;
  dueDate: string;
  amount: string;
  currency: string;
  daysFromToday: number;
  overdue: boolean;
}

export interface ResourceAvailabilityEntry {
  resourceType: string;
  latestRun: SyncRunRow | null;
}

export interface DashboardResponse {
  collectionsSummary: OpenDocumentSummary;
  paymentsSummary: OpenDocumentSummary;
  unsentSummary: UnsentSummary;
  vatEstimate: VatEstimate[];
  accounts: (MirrorRowBase & { attributes: AccountAttributes })[];
  timeline: TimelineEntry[];
  recentActivity: {
    invoices: (MirrorRowBase & { attributes: InvoiceLikeAttributes })[];
    bills: (MirrorRowBase & { attributes: InvoiceLikeAttributes })[];
    syncRuns: SyncRunRow[];
    syncErrors: SyncErrorRow[];
  };
  resourceAvailability: ResourceAvailabilityEntry[];
}

export interface ListResponse<TRow = MirrorRowBase> {
  rows: TRow[];
  total: number;
  page: number;
  pageSize: number;
}

export interface InvoiceLikeDetailResponse {
  header: MirrorRowBase & { attributes: InvoiceLikeAttributes };
  contact: (MirrorRowBase & { attributes: ContactAttributes }) | null;
  details: ((MirrorRowBase & { attributes: InvoiceDetailAttributes }) & { productName: string | null })[];
  payments: (MirrorRowBase & { attributes: PaymentAttributes })[];
}

export interface ContactDetailResponse {
  contact: MirrorRowBase & { attributes: ContactAttributes };
  recentDocuments: (MirrorRowBase & { attributes: InvoiceLikeAttributes })[];
}

export interface SimpleDetailResponse<TAttributes> {
  record: MirrorRowBase & { attributes: TAttributes };
}

export interface SyncRunDetailResponse {
  run: SyncRunRow;
  errors: SyncErrorRow[];
}

export interface SyncStatusResponse {
  runs: SyncRunRow[];
  runTotal: number;
  page: number;
  pageSize: number;
  errors: SyncErrorRow[];
  errorTotal: number;
  latestRunPerResource: ResourceAvailabilityEntry[];
}

export interface ListQueryParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: { field?: string; direction?: "asc" | "desc" };
  filters?: {
    archived?: boolean;
    currency?: string;
    dueFrom?: string;
    dueTo?: string;
    onlyOpen?: boolean;
    kind?: "collection" | "payment";
    status?: string;
  };
}

export type InvoiceListRow = Omit<MirrorRowBase, "attributes"> & {
  attributes: InvoiceLikeAttributes;
  partyName: string | null;
};

export interface DocumentSummaryRow {
  currency: string;
  count: number;
  net: string;
  vat: string;
  gross: string;
}

export interface AgingBucket {
  bucket: string;
  totals: CurrencyTotal[];
  count: number;
}

export interface MonthlyTrendEntry {
  month: string;
  currency: string;
  count: number;
  total: string;
}

export interface ReportsResponse {
  salesSummary: DocumentSummaryRow[];
  collectionSummary: CurrencyTotal[];
  purchaseSummary: DocumentSummaryRow[];
  paymentSummary: CurrencyTotal[];
  incomeExpenseComparison: { sales: MonthlyTrendEntry[]; purchases: MonthlyTrendEntry[] };
  receivablesAging: AgingBucket[];
  payablesAging: AgingBucket[];
  customerBalances: (MirrorRowBase & { attributes: ContactAttributes })[];
  supplierBalances: (MirrorRowBase & { attributes: ContactAttributes })[];
  monthlyInvoiceTrend: MonthlyTrendEntry[];
}

export type PaymentListRow = Omit<MirrorRowBase, "attributes"> & {
  attributes: PaymentAttributes;
  documentNo: string | null;
  partyName: string | null;
  kind: "collection" | "payment";
};
