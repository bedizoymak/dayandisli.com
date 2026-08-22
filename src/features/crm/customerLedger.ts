// Pure, framework-free construction of a contact's unified account-statement
// ledger — the single normalized source shared by CustomerDetailPage's
// on-screen "Cari Hareketler" table and its printed "Cari Hesap Ekstresi"
// PDF (see buildLedgerPrintHtml in CustomerDetailPage.tsx, which renders
// exactly the rows this module returns).
//
// ACCOUNTING DIRECTIONS (see ACCOUNT_STATEMENT_AND_PARASUT_SYNC_AUDIT.md §5
// for the full derivation and live-data proof): this is a real unified
// current-account (cari hesap) ledger, not a signed-by-cashflow-direction
// one. Every document that increases what the contact owes THIS company is
// a debit; every document that increases what THIS company owes the
// contact is a credit:
//   Sales invoice            -> Debit   (they now owe us more)
//   Customer collection      -> Credit  (they paid down what they owe)
//   Received check           -> Credit  (same as a collection — a check IS
//                                        the collection event)
//   Purchase bill             -> Credit  (we now owe them more)
//   Supplier payment          -> Debit   (we paid down what we owe them)
//   Issued check               -> Debit   (same as a supplier payment)
//   Opening debit balance      -> Debit
//   Opening credit balance     -> Credit
// An earlier pass of this module had purchase_bill/supplier_payment
// reversed. That reversal happened to leave the FINAL balance numerically
// unchanged (both totals were short by the identical amount, so the error
// cancelled in the subtraction) while the totals, and every purchase/
// supplier-payment row, were wrong — see the audit report's explanation of
// why final-balance equality alone does not prove a ledger is correct.
//
// ROOT CAUSES FIXED (see the audit report for full evidence):
//  1. Tax-inclusive amount: this Paraşüt account's live API returns
//     `gross_total` as the PRE-tax amount and `net_total` as the payable,
//     tax-inclusive amount — the reverse of the usual net/gross naming.
//     Confirmed per-invoice: gross_total === before_taxes_total, and
//     net_total === gross_total + total_vat === total_paid.
//  2. Dual-role contacts: the same Paraşüt contact can be the `supplier` on
//     a purchase_bill even when its own account_type attribute is
//     "customer" — omitting those bills/payments understated both total
//     debit and total credit.
//  3. Checks were treated as purely informational and never counted —
//     incompatible with the authoritative Paraşüt statement, which counts
//     a received/issued check as its own real financial event.
//  4. Opening balances are not enumerable via any Paraşüt API resource in
//     this integration's scope (confirmed: `transactions` returns HTTP 404
//     live). Where the complete known ledger proves a residual against the
//     contact's authoritative `trl_balance`, this module derives ONE
//     explicit, clearly-labelled adjustment row — never fabricated to force
//     an arbitrary match (see deriveOpeningBalanceRow's doc comment).

export interface LedgerDocumentRow {
  parasut_id?: unknown;
  attributes?: Record<string, unknown> | null;
  relationships?: { payments?: { data?: { id?: unknown }[] | { id?: unknown } | null } | null } | null;
}

export interface LedgerPaymentRow {
  parasut_id?: unknown;
  attributes?: Record<string, unknown> | null;
}

export type LedgerCheckSettlementStatus = "open" | "paid" | "cancelled" | "returned";

/** Raw input for one Paraşüt (or ERP-local) check — the caller (CustomerDetailPage)
 * is responsible for resolving party/direction (via checks-api's existing
 * issued_by/given_to-based partyFromMirror), this module only turns an
 * already-resolved check into a ledger row. */
export interface LedgerCheckInput {
  /** Already-globally-unique id, e.g. "parasut:1000608751" or "erp:<uuid>" — see checksApi's UnifiedCheck.id. */
  id: string;
  direction: "received" | "issued";
  date: string;
  dueDate: string | null;
  currency: string;
  /** The check's own face value in its own currency — never the sum of any invoice-payment fragments. Null when genuinely unknown (never treated as 0). */
  originalAmount: number | null;
  /** TRY-equivalent of originalAmount. For TRY/TRL checks this equals originalAmount. For a foreign-currency check with nothing yet paid off, Paraşüt's own remaining_in_trl equals the face value's TRY equivalent exactly; see buildCustomerLedgerRows for the one documented best-effort fallback beyond that. */
  amountTry: number | null;
  settlementStatus: LedgerCheckSettlementStatus;
  description: string;
}

export type LedgerSourceResource = "sales_invoices" | "purchase_bills" | "payments" | "checks" | "opening_balance";
export type LedgerTransactionType =
  | "sales_invoice"
  | "customer_collection"
  | "purchase_bill"
  | "supplier_payment"
  | "received_check"
  | "issued_check"
  | "opening_balance";

export const LEDGER_TYPE_LABELS: Record<LedgerTransactionType, string> = {
  sales_invoice: "Satış Faturası",
  customer_collection: "Tahsilat",
  purchase_bill: "Alış Faturası",
  supplier_payment: "Tedarikçi Ödemesi",
  received_check: "Alınan Çek",
  issued_check: "Verilen Çek",
  opening_balance: "Devir Bakiyesi",
};

/** One real (or, only for `opening_balance`, explicitly derived) ledger
 * event. `debit`/`credit` are always in TRY; exactly one of them is
 * non-zero (or both zero only for a balance-impacting row worth 0, which
 * never happens in practice — a 0-amount native record is filtered out
 * upstream). */
export interface LedgerRow {
  sourceResource: LedgerSourceResource;
  /** Stable Paraşüt id (or this module's own deterministic key for a derived row) — the sole deduplication key. Never a name/description/date/amount composite. */
  sourceId: string;
  contactParasutId: string;
  transactionType: LedgerTransactionType;
  date: string;
  dueDate: string | null;
  currency: string;
  originalAmount: number;
  amountTry: number;
  debit: number;
  credit: number;
  description: string;
  /** Other records' sourceIds this row subsumes/relates to — e.g. the invoice-payment fragment ids a check's face value was matched against. Never counted a second time in debit/credit once listed here. */
  relatedDocumentIds: string[];
  cancelled: boolean;
  balanceImpacting: boolean;
  /** "native" = a real, individually-verifiable Paraşüt record. "derived" = computed by this module from other native rows plus the contact's authoritative trl_balance — never itself a Paraşüt record. */
  provenance: "native" | "derived";
  /** Only set on a `provenance: "derived"` row — the exact inputs used, so the figure is always auditable rather than opaque. */
  derivationNote?: string;
  /** Only set on a check row whose relatedDocumentIds were populated without an explicit Paraşüt-side id relationship (none exists in this API — see the audit report) — states the fallback rule actually used, so the row is never silently presented as more certain than it is. */
  attributionNote?: string;
}

function sourceText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function displayText(value: unknown): string {
  return sourceText(value) || "—";
}

function numericValue(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

/** The real payable, tax-inclusive amount for a sales_invoice/purchase_bill
 * row, converted to TRY — see this module's doc comment for why
 * `net_total` (not `gross_total`) is the correct field in this Paraşüt
 * account. */
function documentPayableAmountTry(attributes: Record<string, unknown>): { original: number; try: number; currency: string } {
  const rawAmount = numericValue(attributes.net_total) ?? 0;
  const currency = sourceText(attributes.currency).toUpperCase();
  const rate = numericValue(attributes.exchange_rate);
  const isForeign = currency && currency !== "TRY" && currency !== "TRL";
  const amountTry = isForeign && rate && rate > 0 ? rawAmount * rate : rawAmount;
  return { original: rawAmount, try: amountTry, currency: currency || "TRY" };
}

function documentPaymentIds(document: LedgerDocumentRow): string[] {
  const ref = document.relationships?.payments?.data;
  if (!ref) return [];
  const list = Array.isArray(ref) ? ref : [ref];
  return list.map((item) => sourceText(item?.id)).filter(Boolean);
}

export function buildPaymentToDocumentMap(documents: readonly LedgerDocumentRow[]): Map<string, LedgerDocumentRow> {
  const map = new Map<string, LedgerDocumentRow>();
  for (const document of documents) {
    for (const paymentId of documentPaymentIds(document)) {
      map.set(paymentId, document);
    }
  }
  return map;
}

/** Every real, non-cancelled document matched to this contact — must appear
 * whether or not it has a linked payment. Only a genuinely cancelled
 * document (item_type === "cancelled") is excluded; append_contact_balance
 * is deliberately not filtered on (real production invoices with that flag
 * false are still real receivables). */
export function filterBalanceDocuments(documents: readonly LedgerDocumentRow[]): LedgerDocumentRow[] {
  return documents.filter((document) => sourceText(document.attributes?.item_type) !== "cancelled");
}

interface FragmentRow {
  key: string;
  date: string;
  amountTry: number;
  description: string;
}

function buildFragmentRows(documents: readonly LedgerDocumentRow[], payments: readonly LedgerPaymentRow[], keyPrefix: string): FragmentRow[] {
  const balanceDocuments = filterBalanceDocuments(documents);
  const documentByPaymentId = buildPaymentToDocumentMap(balanceDocuments);
  return payments.map((payment) => {
    const attributes = payment.attributes ?? {};
    const amount = numericValue(attributes.amount) ?? 0;
    const paymentId = sourceText(payment.parasut_id);
    const parentDocument = documentByPaymentId.get(paymentId);
    const reference = displayText(parentDocument?.attributes?.invoice_no);
    const notes = sourceText(attributes.notes);
    return {
      key: paymentId || `${keyPrefix}-${amount}-${sourceText(attributes.date)}`,
      date: sourceText(attributes.date),
      amountTry: amount,
      description: notes || reference,
    };
  });
}

/** Attributes each check's own face value as its ledger row, and — ONLY
 * when a fragment's date exactly matches a real Paraşüt checks-resource row
 * for the same contact — excludes that fragment from being separately
 * counted, recording it instead as a related detail on the check's row.
 *
 * WHY DATE, NOT AN EXPLICIT ID: this Paraşüt API's `payments` resource
 * carries no relationship back to `checks` (confirmed: payments'
 * `relationships` only ever contain `payable`/`reimbursement_purchase_bill`/
 * `transaction`, each with an empty `meta` stub and no `data` — and
 * `checks`' own `payments` relationship is likewise never populated,
 * confirmed live for two real checks). No explicit stable relationship
 * exists to use. This is therefore deliberately NOT applied to bare
 * same-day fragments with no backing check (that IS forbidden fuzzy
 * matching) — it only ever fires when a real, ID-verified checks-resource
 * row already exists for this exact contact on this exact date, which is
 * the one deterministic, evidence-backed signal available. If two checks
 * for the same contact share the same date, attribution is skipped
 * entirely for that date (ambiguous — never guessed) and every fragment on
 * it stays a standalone row.
 */
function attributeFragmentsToChecks(
  fragments: readonly FragmentRow[],
  checks: readonly LedgerCheckInput[],
): { attributedKeys: Set<string>; relatedByCheckId: Map<string, string[]> } {
  const attributedKeys = new Set<string>();
  const relatedByCheckId = new Map<string, string[]>();

  const checksByDate = new Map<string, LedgerCheckInput[]>();
  for (const check of checks) {
    if (!check.date) continue;
    const list = checksByDate.get(check.date) ?? [];
    list.push(check);
    checksByDate.set(check.date, list);
  }

  for (const [date, checksOnDate] of checksByDate) {
    if (checksOnDate.length !== 1) continue; // ambiguous — more than one check on this date, never guess which fragment belongs to which
    const check = checksOnDate[0];
    const matches = fragments.filter((fragment) => fragment.date === date);
    if (matches.length === 0) continue;
    relatedByCheckId.set(check.id, matches.map((fragment) => fragment.key));
    for (const fragment of matches) attributedKeys.add(fragment.key);
  }

  return { attributedKeys, relatedByCheckId };
}

export interface BuildLedgerInput {
  contactParasutId: string;
  documents: readonly LedgerDocumentRow[];
  payments: readonly LedgerPaymentRow[];
  supplierDocuments?: readonly LedgerDocumentRow[];
  supplierPayments?: readonly LedgerPaymentRow[];
  receivedChecks?: readonly LedgerCheckInput[];
  issuedChecks?: readonly LedgerCheckInput[];
  /** Paraşüt's own authoritative running balance for this contact
   * (attributes.trl_balance), used only to derive the opening-balance row —
   * see deriveOpeningBalanceRow. Omit/null to skip derivation entirely. */
  trlBalance?: number | null;
}

/** Never fabricates a TRY figure for a foreign-currency check: a TRY/TRL
 * check's own face value already IS its TRY amount; a foreign check only
 * gets a TRY amount when the caller supplied one (amountTry). Otherwise the
 * check still appears (for visibility/audit) but contributes nothing to
 * debit/credit — guessing an FX rate here would be exactly the kind of
 * invented figure this module must never produce. */
function resolveCheckTryAmount(check: LedgerCheckInput): { amountTry: number; balanceImpacting: boolean } {
  const currency = check.currency.toUpperCase();
  const isTry = !currency || currency === "TRY" || currency === "TRL";
  if (isTry) return { amountTry: check.amountTry ?? check.originalAmount ?? 0, balanceImpacting: true };
  if (check.amountTry !== null && check.amountTry !== undefined) return { amountTry: check.amountTry, balanceImpacting: true };
  return { amountTry: 0, balanceImpacting: false };
}

const ATTRIBUTION_NOTE =
  "Paraşüt'ün payments kaynağında çeke geri dönük açık bir ilişki yok; bu tarihte tam olarak bu çek varsa, aynı tarihli tahsilat/ödeme fişleri onun tahsis ayrıntısı sayılır (tahmini eşleşme değildir — kesin tarih ve tek çek koşuluyla sınırlıdır).";

/**
 * Builds the unified, deterministic ledger rows for one contact: sales
 * invoices (debit), customer collections (credit), purchase bills (credit),
 * supplier payments (debit), received checks (credit), issued checks
 * (debit) — plus, only when derivable, one opening-balance adjustment row.
 * See this module's top-of-file comment for the full direction rationale.
 */
export function buildCustomerLedgerRows(input: BuildLedgerInput): LedgerRow[] {
  const balanceDocuments = filterBalanceDocuments(input.documents);
  const supplierBalanceDocuments = filterBalanceDocuments(input.supplierDocuments ?? []);
  const receivedChecks = (input.receivedChecks ?? []).filter((check) => check.settlementStatus !== "cancelled" && check.settlementStatus !== "returned");
  const issuedChecks = (input.issuedChecks ?? []).filter((check) => check.settlementStatus !== "cancelled" && check.settlementStatus !== "returned");

  const customerFragments = buildFragmentRows(balanceDocuments, input.payments, "payment");
  const supplierFragments = buildFragmentRows(supplierBalanceDocuments, input.supplierPayments ?? [], "supplier-payment");

  const customerAttribution = attributeFragmentsToChecks(customerFragments, receivedChecks);
  const supplierAttribution = attributeFragmentsToChecks(supplierFragments, issuedChecks);

  const seen = new Set<string>();
  const rows: LedgerRow[] = [];
  const addRow = (row: LedgerRow) => {
    const dedupeKey = `${row.sourceResource}:${row.sourceId}`;
    if (seen.has(dedupeKey)) return; // stable dedup by (resource, id) only — never by name/date/amount
    seen.add(dedupeKey);
    rows.push(row);
  };

  for (const document of balanceDocuments) {
    const attributes = document.attributes ?? {};
    const amount = documentPayableAmountTry(attributes);
    addRow({
      sourceResource: "sales_invoices",
      sourceId: sourceText(document.parasut_id),
      contactParasutId: input.contactParasutId,
      transactionType: "sales_invoice",
      date: sourceText(attributes.issue_date),
      dueDate: sourceText(attributes.due_date) || null,
      currency: amount.currency,
      originalAmount: amount.original,
      amountTry: amount.try,
      debit: amount.try,
      credit: 0,
      description: displayText(attributes.invoice_no),
      relatedDocumentIds: [],
      cancelled: false,
      balanceImpacting: true,
      provenance: "native",
    });
  }

  for (const fragment of customerFragments) {
    if (customerAttribution.attributedKeys.has(fragment.key)) continue; // subsumed by a same-date received check row below
    addRow({
      sourceResource: "payments",
      sourceId: fragment.key,
      contactParasutId: input.contactParasutId,
      transactionType: "customer_collection",
      date: fragment.date,
      dueDate: null,
      currency: "TRY",
      originalAmount: fragment.amountTry,
      amountTry: fragment.amountTry,
      debit: 0,
      credit: fragment.amountTry,
      description: fragment.description,
      relatedDocumentIds: [],
      cancelled: false,
      balanceImpacting: true,
      provenance: "native",
    });
  }

  for (const document of supplierBalanceDocuments) {
    const attributes = document.attributes ?? {};
    const amount = documentPayableAmountTry(attributes);
    addRow({
      sourceResource: "purchase_bills",
      sourceId: sourceText(document.parasut_id),
      contactParasutId: input.contactParasutId,
      transactionType: "purchase_bill",
      date: sourceText(attributes.issue_date),
      dueDate: sourceText(attributes.due_date) || null,
      currency: amount.currency,
      originalAmount: amount.original,
      amountTry: amount.try,
      debit: 0,
      credit: amount.try,
      description: displayText(attributes.invoice_no),
      relatedDocumentIds: [],
      cancelled: false,
      balanceImpacting: true,
      provenance: "native",
    });
  }

  for (const fragment of supplierFragments) {
    if (supplierAttribution.attributedKeys.has(fragment.key)) continue; // subsumed by a same-date issued check row below
    addRow({
      sourceResource: "payments",
      sourceId: fragment.key,
      contactParasutId: input.contactParasutId,
      transactionType: "supplier_payment",
      date: fragment.date,
      dueDate: null,
      currency: "TRY",
      originalAmount: fragment.amountTry,
      amountTry: fragment.amountTry,
      debit: fragment.amountTry,
      credit: 0,
      description: fragment.description,
      relatedDocumentIds: [],
      cancelled: false,
      balanceImpacting: true,
      provenance: "native",
    });
  }

  for (const check of receivedChecks) {
    const { amountTry, balanceImpacting } = resolveCheckTryAmount(check);
    const related = customerAttribution.relatedByCheckId.get(check.id) ?? [];
    addRow({
      sourceResource: "checks",
      sourceId: check.id,
      contactParasutId: input.contactParasutId,
      transactionType: "received_check",
      date: check.date,
      dueDate: check.dueDate,
      currency: check.currency,
      originalAmount: check.originalAmount ?? 0,
      amountTry,
      debit: 0,
      credit: balanceImpacting ? amountTry : 0,
      description: balanceImpacting ? check.description : `${check.description} · TRY karşılığı bilinmiyor, bakiyeye dahil edilmedi`,
      relatedDocumentIds: related,
      cancelled: false,
      balanceImpacting,
      provenance: "native",
      attributionNote: related.length > 0 ? ATTRIBUTION_NOTE : undefined,
    });
  }

  for (const check of issuedChecks) {
    const { amountTry, balanceImpacting } = resolveCheckTryAmount(check);
    const related = supplierAttribution.relatedByCheckId.get(check.id) ?? [];
    addRow({
      sourceResource: "checks",
      sourceId: check.id,
      contactParasutId: input.contactParasutId,
      transactionType: "issued_check",
      date: check.date,
      dueDate: check.dueDate,
      currency: check.currency,
      originalAmount: check.originalAmount ?? 0,
      amountTry,
      debit: balanceImpacting ? amountTry : 0,
      credit: 0,
      description: balanceImpacting ? check.description : `${check.description} · TRY karşılığı bilinmiyor, bakiyeye dahil edilmedi`,
      relatedDocumentIds: related,
      cancelled: false,
      balanceImpacting,
      provenance: "native",
      attributionNote: related.length > 0 ? ATTRIBUTION_NOTE : undefined,
    });
  }

  const openingRow = deriveOpeningBalanceRow(rows, input.contactParasutId, input.trlBalance ?? null);
  if (openingRow) rows.push(openingRow);

  return sortLedgerRows(rows);
}

const OPENING_BALANCE_TOLERANCE_TRY = 0.01;

/**
 * Derives, at most, ONE opening-balance adjustment row — the residual
 * between the contact's authoritative Paraşüt `trl_balance` and the net
 * effect of every native row already built. Only fires when:
 *  - trlBalance is a real, provided number (not null/undefined — omitting
 *    it entirely skips derivation, never assumes 0);
 *  - there is at least one native, dated row to anchor the derived row's
 *    date to (an empty ledger has no "beginning" to place it before, so
 *    derivation is skipped as ambiguous rather than guessed);
 *  - the residual exceeds a 0.01 TRY rounding tolerance (a clean net-zero
 *    residual means the native ledger already fully explains the balance —
 *    nothing to derive).
 * The row is placed at the same date as the ledger's earliest native row
 * (sortLedgerRows always ranks it first on a tied date), so it is correctly
 * included in any later date-range's carried-forward balance while still
 * being visible in a full-history view.
 */
export function deriveOpeningBalanceRow(nativeRows: readonly LedgerRow[], contactParasutId: string, trlBalance: number | null): LedgerRow | null {
  if (trlBalance === null || !Number.isFinite(trlBalance)) return null;
  const dated = nativeRows.filter((row) => row.date);
  if (dated.length === 0) return null;

  const netNative = nativeRows.reduce((sum, row) => sum + row.debit - row.credit, 0);
  const residual = trlBalance - netNative;
  if (Math.abs(residual) <= OPENING_BALANCE_TOLERANCE_TRY) return null;

  const earliestDate = dated.reduce((earliest, row) => (row.date < earliest ? row.date : earliest), dated[0].date);
  const debit = residual > 0 ? residual : 0;
  const credit = residual < 0 ? -residual : 0;

  return {
    sourceResource: "opening_balance",
    sourceId: `opening-balance:${contactParasutId}`,
    contactParasutId,
    transactionType: "opening_balance",
    date: earliestDate,
    dueDate: null,
    currency: "TRY",
    originalAmount: Math.abs(residual),
    amountTry: Math.abs(residual),
    debit,
    credit,
    description: "Devir Bakiyesi (Paraşüt bakiyesinden türetilmiştir)",
    relatedDocumentIds: [],
    cancelled: false,
    balanceImpacting: true,
    provenance: "derived",
    derivationNote: `trl_balance (${trlBalance.toFixed(2)}) - bilinen kayıtların net etkisi (${netNative.toFixed(2)}) = ${residual.toFixed(2)}`,
  };
}

function sortPriority(row: LedgerRow): number {
  return row.sourceResource === "opening_balance" ? 0 : 1;
}

export function sortLedgerRows(rows: readonly LedgerRow[]): LedgerRow[] {
  return [...rows]
    .filter((row) => row.date)
    .sort((a, b) => a.date.localeCompare(b.date) || sortPriority(a) - sortPriority(b) || a.sourceId.localeCompare(b.sourceId));
}
