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
// D-B hard guarantee: the backend already never returns a raw Paraşüt
// transaction_type enum as the customer-facing description, but this is a
// second, independent guard on the shared row model itself (consumed by
// both screen and print) so a raw enum can never render as visible text
// even if a future backend regression reintroduces one — the transaction
// type itself stays available via `transactionType`/`rawTransactionType`,
// only the display text is guarded.
const RAW_PARASUT_TRANSACTION_TYPE_ENUMS = new Set([
  "sales_invoice", "purchase_bill", "reimbursement_purchase_bill",
  "contact_credit", "contact_debit",
  "contact_opening_balance_debit", "contact_opening_balance_credit",
  "check_in", "check_out", "unknown",
]);
function guardAgainstRawEnum(description: string, normalizedType: LedgerTransactionType): string {
  return RAW_PARASUT_TRANSACTION_TYPE_ENUMS.has(description) ? LEDGER_TYPE_LABELS[normalizedType] : description;
}
// Generic Paraşüt check payment-status label mapping for customer-facing
// text only — row.check.paymentStatus itself stays the untranslated raw
// value from Paraşüt.
const CHECK_PAYMENT_STATUS_LABELS: Record<string, string> = { paid: "Ödendi", unpaid: "Ödenmedi" };
function checkPaymentStatusLabel(status: unknown): string {
  const raw = sourceText(status);
  return CHECK_PAYMENT_STATUS_LABELS[raw] ?? raw;
}
// The displayed debit/credit for each row is derived exclusively from the
// delta between consecutive authoritative trlBalance values in statement
// order (previous = 0 for the first row), never from the transaction's own
// type or raw debit/credit sides — this is the single source of truth for
// the balance movement shown on screen and in print.
function movementFromBalanceDelta(previousBalance: number, currentBalance: number): { debit: number; credit: number } {
  const delta = currentBalance - previousBalance;
  if (delta > 0) return { debit: delta, credit: 0 };
  if (delta < 0) return { debit: 0, credit: Math.abs(delta) };
  return { debit: 0, credit: 0 };
}
export function buildAuthoritativeLedgerRows(statement: AuthoritativeStatement | null | undefined, contactParasutId: string): LedgerRow[] {
  if (!statement || statement.status === "unavailable") return [];
  const seen = new Set<string>();
  const sorted = [...statement.rows].sort((a, b) => a.order - b.order);
  return sorted.map((row, index) => {
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
      ? [sourceText(row.description), sourceText(row.check.bank), sourceText(row.check.serialNumber), sourceText(row.check.dueDate), checkPaymentStatusLabel(row.check.paymentStatus)].filter(Boolean).join(" · ")
      : guardAgainstRawEnum(sourceText(row.displayDescription) || sourceText(row.description) || LEDGER_TYPE_LABELS[normalizedType], normalizedType);
    const previousBalance = index === 0 ? 0 : Number(sorted[index - 1].trlBalance);
    const currentBalance = Number(row.trlBalance);
    return { sourceResource: "transactions", sourceId: row.transactionId, transactionId: row.transactionId, historyItemId: row.historyItemId, contactParasutId, transactionType: normalizedType, rawTransactionType: row.transactionType, date: row.date, dueDate: sourceText(row.check?.dueDate) || null, currency: "TRY", originalAmount: amount, amountTry: amount, ...movementFromBalanceDelta(previousBalance, currentBalance), balance: currentBalance, description, relatedDocumentIds: Object.values(row.linked ?? {}).filter((id): id is string => typeof id === "string" && Boolean(id)), allocations: row.allocations ?? [], check: row.check ?? null, cancelled: false, balanceImpacting: true, provenance: "native" };
  });
}
export function statementWarning(statement: AuthoritativeStatement | null | undefined, rows: readonly LedgerRow[]): string | null {
  if (!statement || statement.status === "unavailable") return "Paraşüt işlem geçmişi henüz senkronize edilmedi; cari ekstre gösterilemiyor.";
  if (statement.status !== "reconciled") return `Paraşüt mutabakatı tamamlanmadı: ${(statement.diagnostics ?? []).join(", ") || "eksik veri"}`;
  const computed = rows.reduce((sum, row) => sum + row.debit - row.credit, 0); const finalHistory = statement.reconciliation?.finalHistoryBalance;
  return finalHistory !== null && finalHistory !== undefined && Math.abs(computed - finalHistory) > 0.005 ? "Hesaplanan kapanış bakiyesi Paraşüt işlem geçmişi bakiyesiyle eşleşmiyor." : null;
}
export function buildLedgerPrintRows(rows: readonly LedgerRow[]): LedgerRow[] { return rows.map((row) => ({ ...row })) }
