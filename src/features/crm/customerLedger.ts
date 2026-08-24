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
export interface AuthoritativeStatement { version: 1; status: "reconciled" | "incomplete" | "unavailable"; rows: AuthoritativeStatementRow[]; diagnostics?: string[]; reconciliation?: { finalHistoryBalance: number | null; contactBalance: number | null }; lastSyncedAt?: string | null }
export type LedgerTransactionType = "sales_invoice" | "customer_collection" | "purchase_bill" | "supplier_payment" | "received_check" | "issued_check" | "opening_balance" | "contact_transfer" | "unknown";
export const LEDGER_TYPE_LABELS: Record<LedgerTransactionType, string> = { sales_invoice: "Satış Faturası", customer_collection: "Tahsilat", purchase_bill: "Alış Faturası", supplier_payment: "Tedarikçi Ödemesi", received_check: "Alınan Çek", issued_check: "Verilen Çek", opening_balance: "Devir Bakiyesi", contact_transfer: "Cari Virman", unknown: "Bilinmeyen Paraşüt İşlemi" };
export interface LedgerRow {
  sourceResource: "transactions"; sourceId: string; transactionId: string; historyItemId: string; contactParasutId: string;
  transactionType: LedgerTransactionType; rawTransactionType: string; date: string; dueDate: string | null; currency: string;
  originalAmount: number; amountTry: number; debit: number; credit: number; balance: number; description: string;
  /** True when rawTransactionType has no entry in the mandatory side map — a visible integrity error, never silently guessed (contract rule 8). */
  unmapped: boolean;
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
// Ledger rebuild contract hard rule 7/8: statement side is determined ONLY
// by transactions.transaction_type via this fixed map — never inferred
// from debit_amount/credit_amount (both can be populated on the same row;
// confirmed live e.g. a contact_debit row with identical non-null
// debit_amount and credit_amount) and never derived from the trlBalance
// delta. The contract's own mandatory map covers 6 types; check_out and
// contact_opening_balance_credit are real, currently-live types it doesn't
// mention — both resolved from observed evidence (not guessed), documented
// in CLAUDE_CODE_CUSTOMER_LEDGER_REBUILD_REPORT.md: check_out matches the
// same positive-balance-delta direction as every other confirmed debit
// type across two independent live examples; contact_opening_balance_credit
// produced a negative delta from a confirmed first-ever history row,
// matching its own name as the credit counterpart of
// contact_opening_balance_debit. Any type outside this map is a visible,
// unmapped integrity error — never a guess, never a silent zero.
const DEBIT_TRANSACTION_TYPES = new Set(["sales_invoice", "contact_debit", "contact_opening_balance_debit", "check_out"]);
const CREDIT_TRANSACTION_TYPES = new Set(["check_in", "contact_credit", "purchase_bill", "contact_opening_balance_credit"]);
function movementFromTransactionType(rawTransactionType: string, amount: number): { debit: number; credit: number; unmapped: boolean } {
  if (DEBIT_TRANSACTION_TYPES.has(rawTransactionType)) return { debit: amount, credit: 0, unmapped: false };
  if (CREDIT_TRANSACTION_TYPES.has(rawTransactionType)) return { debit: 0, credit: amount, unmapped: false };
  return { debit: 0, credit: 0, unmapped: true };
}
export function buildAuthoritativeLedgerRows(statement: AuthoritativeStatement | null | undefined, contactParasutId: string): LedgerRow[] {
  if (!statement || statement.status === "unavailable") return [];
  const seen = new Set<string>();
  const sorted = [...statement.rows].sort((a, b) => a.order - b.order);
  return sorted.map((row, index) => {
    if (!row.transactionId) throw new Error("Paraşüt statement row is missing transaction id");
    if (seen.has(row.transactionId)) throw new Error(`Duplicate Paraşüt transaction id: ${row.transactionId}`); seen.add(row.transactionId);
    // Contract rule 7: transactions.amount_in_trl is THE statement amount —
    // read directly, never derived from debit_amount/credit_amount (both
    // can be populated on the same row; those fields are informational only).
    const amount = Math.abs(Number(row.amountInTrl) || 0);
    const normalizedType = normalizeType(row.transactionType);
    const movement = movementFromTransactionType(row.transactionType, amount);
    // The backend already resolves the correct human-readable description
    // (invoice/bill number, opening-balance text, or a safe fallback label —
    // never the raw Paraşüt enum) via displayDescription; the only thing
    // still assembled client-side is the check's multi-field detail line,
    // which must keep its existing exact format.
    const baseDescription = row.check
      ? [sourceText(row.description), sourceText(row.check.bank), sourceText(row.check.serialNumber), sourceText(row.check.dueDate), checkPaymentStatusLabel(row.check.paymentStatus)].filter(Boolean).join(" · ")
      : guardAgainstRawEnum(sourceText(row.displayDescription) || sourceText(row.description) || LEDGER_TYPE_LABELS[normalizedType], normalizedType);
    // Contract rule 8: an unmapped transaction_type must be a visible
    // integrity error, never a silent zero-amount row and never a guess.
    const description = movement.unmapped
      ? `⚠ Eşlenmemiş işlem türü (${row.transactionType}) — tutar doğrulanamadı`
      : baseDescription;
    const currentBalance = Number(row.trlBalance);
    return { sourceResource: "transactions", sourceId: row.transactionId, transactionId: row.transactionId, historyItemId: row.historyItemId, contactParasutId, transactionType: normalizedType, rawTransactionType: row.transactionType, date: row.date, dueDate: sourceText(row.check?.dueDate) || null, currency: "TRY", originalAmount: amount, amountTry: amount, debit: movement.debit, credit: movement.credit, unmapped: movement.unmapped, balance: currentBalance, description, relatedDocumentIds: Object.values(row.linked ?? {}).filter((id): id is string => typeof id === "string" && Boolean(id)), allocations: row.allocations ?? [], check: row.check ?? null, cancelled: false, balanceImpacting: true, provenance: "native" };
  });
}
// P0 (2026-08-24 production QA): a customer statement is authoritative only
// when the latest mirrored trl_balance equals the contact's current
// trl_balance within tolerance. When it doesn't (contact_balance_mismatch),
// the ledger is known-stale relative to Paraşüt — never render a
// complete-looking statement with incorrect totals; show this exact
// integrity state and block printing (see CustomerDetailPage.tsx's
// printLedger, gated on this same warning).
const STALE_LEDGER_WARNING = "Cari hareketler güncel değil; Paraşüt senkronizasyonu bekleniyor.";
export function statementWarning(statement: AuthoritativeStatement | null | undefined, rows: readonly LedgerRow[]): string | null {
  if (!statement || statement.status === "unavailable") return "Cari hareketler henüz senkronize edilmedi.";
  if ((statement.diagnostics ?? []).includes("contact_balance_mismatch")) return STALE_LEDGER_WARNING;
  if (statement.status !== "reconciled") return `Paraşüt mutabakatı tamamlanmadı: ${(statement.diagnostics ?? []).join(", ") || "eksik veri"}`;
  const unmapped = rows.filter((row) => row.unmapped);
  if (unmapped.length > 0) {
    return `Eşlenmemiş işlem türü tespit edildi (${unmapped.map((row) => row.rawTransactionType).join(", ")}) — tutarlar doğrulanamadı.`;
  }
  const computed = rows.reduce((sum, row) => sum + row.debit - row.credit, 0); const finalHistory = statement.reconciliation?.finalHistoryBalance;
  return finalHistory !== null && finalHistory !== undefined && Math.abs(computed - finalHistory) > 0.005 ? "Hesaplanan kapanış bakiyesi Paraşüt işlem geçmişi bakiyesiyle eşleşmiyor." : null;
}
export function buildLedgerPrintRows(rows: readonly LedgerRow[]): LedgerRow[] { return rows.map((row) => ({ ...row })) }
