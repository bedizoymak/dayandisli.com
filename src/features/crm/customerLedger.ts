export interface LedgerDocumentRow { parasut_id?: unknown; attributes?: Record<string, unknown> | null; relationships?: { payments?: { data?: { id?: unknown }[] | { id?: unknown } | null } | null } | null }
export interface LedgerPaymentRow { parasut_id?: unknown; attributes?: Record<string, unknown> | null }
export interface AuthoritativeStatementRow {
  historyItemId: string; order: number; transactionId: string; transactionType: string; date: string; description: string;
  sourceDescription?: string; documentNumber?: string | null; displayDescription?: string;
  amountInTrl: number; debitAmount: number; creditAmount: number; unmatchedDebitAmount: number; unmatchedCreditAmount: number; trlBalance: number;
  linked: { checkId?: string | null; salesInvoiceId?: string | null; purchaseBillId?: string | null; openingBalanceId?: string | null };
  check?: { serialNumber?: unknown; bank?: unknown; dueDate?: unknown; paymentStatus?: unknown; remainingAmount?: unknown; cashed?: unknown; transferred?: unknown } | null;
  allocations?: { id?: unknown; payableId?: unknown; amount?: unknown; currency?: unknown; balanceImpacting: false }[];
}
export interface AuthoritativeStatement { version: 1; status: "reconciled" | "incomplete" | "unavailable"; rows: AuthoritativeStatementRow[]; diagnostics?: string[]; reconciliation?: { finalHistoryBalance: number | null; contactBalance: number | null } }
export type LedgerTransactionType = "sales_invoice" | "customer_collection" | "purchase_bill" | "supplier_payment" | "received_check" | "issued_check" | "opening_balance" | "contact_transfer" | "unknown";
export const LEDGER_TYPE_LABELS: Record<LedgerTransactionType, string> = { sales_invoice: "Satış Faturası", customer_collection: "Tahsilat", purchase_bill: "Alış Faturası", supplier_payment: "Tedarikçi Ödemesi", received_check: "Alınan Çek", issued_check: "Verilen Çek", opening_balance: "Devir Bakiyesi", contact_transfer: "Cari Virman", unknown: "Bilinmeyen Paraşüt İşlemi" };
export interface LedgerRow {
  sourceResource: "transactions"; sourceId: string; transactionId: string; historyItemId: string; contactParasutId: string;
  transactionType: LedgerTransactionType; rawTransactionType: string; date: string; dueDate: string | null; currency: string;
  originalAmount: number; amountTry: number; debit: number; credit: number; balance: number; description: string;
  relatedDocumentIds: string[]; allocations: AuthoritativeStatementRow["allocations"]; check: AuthoritativeStatementRow["check"];
  cancelled: false; balanceImpacting: true; provenance: "native";
}
function sourceText(value: unknown): string { return typeof value === "string" ? value.trim() : typeof value === "number" && Number.isFinite(value) ? String(value) : "" }
function paymentIds(document: LedgerDocumentRow): string[] { const data = document.relationships?.payments?.data; return (Array.isArray(data) ? data : data ? [data] : []).map((item) => sourceText(item.id)).filter(Boolean) }
export function buildPaymentToDocumentMap(documents: readonly LedgerDocumentRow[]): Map<string, LedgerDocumentRow> { const result = new Map<string, LedgerDocumentRow>(); for (const document of documents) for (const id of paymentIds(document)) result.set(id, document); return result }
export function filterBalanceDocuments(documents: readonly LedgerDocumentRow[]): LedgerDocumentRow[] { return documents.filter((document) => sourceText(document.attributes?.item_type) !== "cancelled") }
function normalizeType(type: string): LedgerTransactionType { if (type.startsWith("contact_transfer")) return "contact_transfer"; return ({ sales_invoice: "sales_invoice", purchase_bill: "purchase_bill", contact_credit: "customer_collection", contact_debit: "supplier_payment", check_in: "received_check", check_out: "issued_check", contact_opening_balance_debit: "opening_balance", contact_opening_balance_credit: "opening_balance" } as Record<string, LedgerTransactionType>)[type] ?? "unknown" }
// A contact_transfer is a first-class type in the verified source contract
// (transaction.contact_transfer) but its exact side isn't one of the fixed
// enum cases below; Parasut's own debit_amount/credit_amount on the
// transaction already say which side it's on, so that authoritative value is
// used directly instead of guessing — never applied to a truly unknown type.
function direction(row: AuthoritativeStatementRow, amount: number): { debit: number; credit: number } {
  const type = row.transactionType;
  if (["sales_invoice", "contact_debit", "check_out", "contact_opening_balance_debit"].includes(type)) return { debit: amount, credit: 0 };
  if (["purchase_bill", "contact_credit", "check_in", "contact_opening_balance_credit"].includes(type)) return { debit: 0, credit: amount };
  if (type.startsWith("contact_transfer")) {
    if ((Number(row.debitAmount) || 0) > 0) return { debit: amount, credit: 0 };
    if ((Number(row.creditAmount) || 0) > 0) return { debit: 0, credit: amount };
  }
  return { debit: 0, credit: 0 };
}
export function buildAuthoritativeLedgerRows(statement: AuthoritativeStatement | null | undefined, contactParasutId: string): LedgerRow[] {
  if (!statement || statement.status === "unavailable") return [];
  const seen = new Set<string>();
  return [...statement.rows].sort((a, b) => a.order - b.order).map((row) => {
    if (!row.transactionId) throw new Error("Paraşüt statement row is missing transaction id");
    if (seen.has(row.transactionId)) throw new Error(`Duplicate Paraşüt transaction id: ${row.transactionId}`); seen.add(row.transactionId);
    const amount = Math.abs(Number(row.amountInTrl) || Number(row.debitAmount) || Number(row.creditAmount) || 0);
    const normalizedType = normalizeType(row.transactionType);
    // The backend already resolves the correct human-readable description
    // (invoice/bill number, opening-balance text, or a safe fallback label —
    // never the raw Paraşüt enum) via displayDescription; the only thing
    // still assembled client-side is the check's multi-field detail line,
    // which must keep its existing exact format.
    const description = row.check
      ? [row.description, row.check.bank, row.check.serialNumber, row.check.dueDate, row.check.paymentStatus].map(sourceText).filter(Boolean).join(" · ")
      : sourceText(row.displayDescription) || sourceText(row.description) || LEDGER_TYPE_LABELS[normalizedType];
    return { sourceResource: "transactions", sourceId: row.transactionId, transactionId: row.transactionId, historyItemId: row.historyItemId, contactParasutId, transactionType: normalizedType, rawTransactionType: row.transactionType, date: row.date, dueDate: sourceText(row.check?.dueDate) || null, currency: "TRY", originalAmount: amount, amountTry: amount, ...direction(row, amount), balance: Number(row.trlBalance), description, relatedDocumentIds: Object.values(row.linked ?? {}).filter((id): id is string => typeof id === "string" && Boolean(id)), allocations: row.allocations ?? [], check: row.check ?? null, cancelled: false, balanceImpacting: true, provenance: "native" };
  });
}
export function statementWarning(statement: AuthoritativeStatement | null | undefined, rows: readonly LedgerRow[]): string | null {
  if (!statement || statement.status === "unavailable") return "Paraşüt işlem geçmişi henüz senkronize edilmedi; cari ekstre gösterilemiyor.";
  if (statement.status !== "reconciled") return `Paraşüt mutabakatı tamamlanmadı: ${(statement.diagnostics ?? []).join(", ") || "eksik veri"}`;
  const computed = rows.reduce((sum, row) => sum + row.debit - row.credit, 0); const finalHistory = statement.reconciliation?.finalHistoryBalance;
  return finalHistory !== null && finalHistory !== undefined && Math.abs(computed - finalHistory) > 0.005 ? "Hesaplanan kapanış bakiyesi Paraşüt işlem geçmişi bakiyesiyle eşleşmiyor." : null;
}
export function buildLedgerPrintRows(rows: readonly LedgerRow[]): LedgerRow[] { return rows.map((row) => ({ ...row })) }
