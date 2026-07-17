// Pure, dependency-free Paraşüt mirror calculation module.
//
// This file intentionally has zero imports (no Deno-only or Node-only APIs)
// so the exact same source can run both inside the `parasut-api` Supabase
// Edge Function (Deno) and inside Vitest (Node) for unit testing. Do not add
// imports here — split platform-specific code into the caller instead.
//
// All monetary arithmetic uses fixed-point integers (scaled by 10^6) instead
// of native floating point, because Paraşüt's API returns monetary amounts
// as decimal strings (e.g. "8400.0") and naive `parseFloat` summation can
// accumulate binary-floating-point rounding error across many rows.

const DECIMAL_SCALE = 1_000_000n;

/** Parses a Paraşüt decimal string/number into a scaled bigint. Invalid/missing values become 0n. */
export function parseDecimalScaled(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  const raw = typeof value === "number" ? value.toString() : value.trim();
  if (raw === "") return 0n;

  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [wholePartRaw, fractionPartRaw = ""] = unsigned.split(".");
  const wholePart = wholePartRaw === "" ? "0" : wholePartRaw;
  if (!/^\d+$/.test(wholePart) || (fractionPartRaw !== "" && !/^\d+$/.test(fractionPartRaw))) return 0n;

  const fractionDigits = fractionPartRaw.slice(0, 6).padEnd(6, "0");
  const scaled = BigInt(wholePart) * DECIMAL_SCALE + BigInt(fractionDigits || "0");
  return negative ? -scaled : scaled;
}

/** Formats a scaled bigint back into a plain decimal string with up to 2 fraction digits. */
export function formatDecimalScaled(scaled: bigint): string {
  const negative = scaled < 0n;
  const absolute = negative ? -scaled : scaled;
  const whole = absolute / DECIMAL_SCALE;
  const fraction = (absolute % DECIMAL_SCALE).toString().padStart(6, "0").slice(0, 2);
  return `${negative ? "-" : ""}${whole.toString()}.${fraction}`;
}

/** Sums a list of Paraşüt decimal strings without floating-point drift. */
export function sumDecimalStrings(values: Array<string | number | null | undefined>): string {
  let total = 0n;
  for (const value of values) total += parseDecimalScaled(value);
  return formatDecimalScaled(total);
}

export function decimalToNumber(value: string | number | null | undefined): number {
  return Number(formatDecimalScaled(parseDecimalScaled(value)));
}

export function isPositiveDecimal(value: string | number | null | undefined): boolean {
  return parseDecimalScaled(value) > 0n;
}

// ---------------------------------------------------------------------
// Shared row shapes (subset of confirmed Paraşüt JSON:API attributes,
// see PARASUT_SCHEMA_AUDIT_REPORT.md and tools/parasut/discovery/*.json).
// ---------------------------------------------------------------------

export interface MirrorRow {
  parasut_id: string;
  attributes: Record<string, unknown>;
  relationships: Record<string, unknown>;
  source_archived: boolean | null;
  synced_at: string;
  last_seen_at: string;
}

export interface CurrencyTotal {
  currency: string;
  total: string;
}

function groupByCurrency(rows: MirrorRow[], amountField: string): CurrencyTotal[] {
  const buckets = new Map<string, string[]>();
  for (const row of rows) {
    const currency = (row.attributes.currency as string | undefined) ?? "TRY";
    const list = buckets.get(currency) ?? [];
    list.push(row.attributes[amountField] as string | undefined ?? "0");
    buckets.set(currency, list);
  }
  return Array.from(buckets.entries())
    .map(([currency, values]) => ({ currency, total: sumDecimalStrings(values) }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export interface ReceivablesPayablesSummary {
  totalDue: CurrencyTotal[];
  overdue: CurrencyTotal[];
  unscheduled: CurrencyTotal[];
  recurringCount: number;
  overdueCount: number;
  unscheduledCount: number;
}

function isOpenDocument(row: MirrorRow): boolean {
  if (row.source_archived) return false;
  return isPositiveDecimal(row.attributes.remaining as string | undefined);
}

/** `referenceDate` is injected (rather than read via `new Date()` internally) so this stays deterministic in tests and doesn't rot as real time passes. */
function isOverdue(row: MirrorRow, referenceDate: Date): boolean {
  const daysOverdue = row.attributes.days_overdue;
  if (typeof daysOverdue === "number") return daysOverdue > 0;
  const dueDate = row.attributes.due_date as string | null | undefined;
  if (!dueDate) return false;
  return dueDate < referenceDate.toISOString().slice(0, 10);
}

/** Computes the "Toplam Tahsil Edilecek / Gecikmiş / Planlanmamış / Tekrarlayan" style summary for a set of open documents. */
export function computeOpenDocumentSummary(rows: MirrorRow[], referenceDate: Date = new Date()): ReceivablesPayablesSummary {
  const open = rows.filter(isOpenDocument);
  const overdue = open.filter((row) => isOverdue(row, referenceDate));
  const unscheduled = open.filter((row) => !row.attributes.due_date);
  const recurringCount = open.filter((row) => row.attributes.is_recurred_item === true).length;

  return {
    totalDue: groupByCurrency(open, "remaining"),
    overdue: groupByCurrency(overdue, "remaining"),
    unscheduled: groupByCurrency(unscheduled, "remaining"),
    recurringCount,
    overdueCount: overdue.length,
    unscheduledCount: unscheduled.length,
  };
}

export interface UnsentSummary {
  count: number;
  currencyTotals: CurrencyTotal[];
}

/** "Yazdırılmamış / Gönderilmemiş" — sales invoices never printed and never shared, from confirmed fields printed_at + sharings_count. */
export function computeUnsentSummary(rows: MirrorRow[]): UnsentSummary {
  const unsent = rows.filter((row) => {
    if (row.source_archived) return false;
    const printedAt = row.attributes.printed_at;
    const sharingsCount = row.attributes.sharings_count;
    return !printedAt && (typeof sharingsCount !== "number" || sharingsCount === 0);
  });
  return { count: unsent.length, currencyTotals: groupByCurrency(unsent, "remaining") };
}

export interface VatEstimate {
  currency: string;
  outputVat: string;
  inputVat: string;
  netVat: string;
}

/** Bu Ay Oluşan KDV (estimated): current-calendar-month output VAT (sales) minus input VAT (purchases), grouped by currency.
 * Caveat: does not include devreden KDV (carried-forward VAT credit) or other declaration-time adjustments —
 * callers must surface this as an estimate, not an authoritative tax figure. */
export function computeMonthlyVatEstimate(
  salesInvoices: MirrorRow[],
  purchaseBills: MirrorRow[],
  referenceDate: Date,
): VatEstimate[] {
  const monthPrefix = referenceDate.toISOString().slice(0, 7); // YYYY-MM
  const inMonth = (row: MirrorRow) => {
    const issueDate = row.attributes.issue_date as string | undefined;
    return Boolean(issueDate && issueDate.startsWith(monthPrefix)) && !row.source_archived;
  };

  const salesByCurrency = groupByCurrency(salesInvoices.filter(inMonth), "total_vat");
  const purchasesByCurrency = groupByCurrency(purchaseBills.filter(inMonth), "total_vat");

  const currencies = new Set([...salesByCurrency.map((c) => c.currency), ...purchasesByCurrency.map((c) => c.currency)]);
  return Array.from(currencies)
    .map((currency) => {
      const outputVat = salesByCurrency.find((c) => c.currency === currency)?.total ?? "0.00";
      const inputVat = purchasesByCurrency.find((c) => c.currency === currency)?.total ?? "0.00";
      const netVat = formatDecimalScaled(parseDecimalScaled(outputVat) - parseDecimalScaled(inputVat));
      return { currency, outputVat, inputVat, netVat };
    })
    .sort((a, b) => a.currency.localeCompare(b.currency));
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

function relationshipName(row: MirrorRow, includedNames: Map<string, string>, key: string): string | null {
  const relationship = row.relationships[key] as { data?: { id?: string } | null } | undefined;
  const id = relationship?.data?.id;
  if (!id) return null;
  return includedNames.get(id) ?? null;
}

/** Builds a merged, sorted upcoming/overdue timeline from open sales invoices and purchase bills. Cheque data is intentionally excluded (no mirrored resource exists for it). */
export function buildUpcomingTimeline(
  salesInvoices: MirrorRow[],
  purchaseBills: MirrorRow[],
  contactNamesById: Map<string, string>,
  referenceDate: Date = new Date(),
  limit = 20,
): TimelineEntry[] {
  const toEntry = (row: MirrorRow, kind: TimelineEntry["kind"], relationshipKey: string): TimelineEntry | null => {
    if (!isOpenDocument(row)) return null;
    const dueDate = row.attributes.due_date as string | null | undefined;
    if (!dueDate) return null;
    // days_till_due_date is already (due_date - today) in Paraşüt's own convention: positive = upcoming, negative = past due.
    const daysFromToday =
      typeof row.attributes.days_till_due_date === "number"
        ? row.attributes.days_till_due_date
        : Math.round((new Date(dueDate).getTime() - referenceDate.getTime()) / 86_400_000);
    return {
      kind,
      parasutId: row.parasut_id,
      documentNo: (row.attributes.invoice_no as string | null | undefined) ?? null,
      partyName: relationshipName(row, contactNamesById, relationshipKey),
      dueDate,
      amount: formatDecimalScaled(parseDecimalScaled(row.attributes.remaining as string | undefined)),
      currency: (row.attributes.currency as string | undefined) ?? "TRY",
      daysFromToday,
      overdue: isOverdue(row, referenceDate),
    };
  };

  const entries = [
    ...salesInvoices.map((row) => toEntry(row, "receivable", "contact")),
    ...purchaseBills.map((row) => toEntry(row, "payable", "supplier")),
  ].filter((entry): entry is TimelineEntry => entry !== null);

  return entries.sort((a, b) => a.daysFromToday - b.daysFromToday).slice(0, limit);
}

// ---------------------------------------------------------------------
// Reports: aging buckets and monthly trend
// ---------------------------------------------------------------------

export const AGING_BUCKET_LABELS = ["Vadesi Gelmemiş", "1-30 gün", "31-60 gün", "61-90 gün", "90+ gün"] as const;
export type AgingBucketLabel = (typeof AGING_BUCKET_LABELS)[number];

export interface AgingBucket {
  bucket: AgingBucketLabel;
  totals: CurrencyTotal[];
  count: number;
}

function agingBucketFor(row: MirrorRow, referenceDate: Date): AgingBucketLabel {
  const daysOverdue =
    typeof row.attributes.days_overdue === "number"
      ? row.attributes.days_overdue
      : (() => {
          const dueDate = row.attributes.due_date as string | null | undefined;
          if (!dueDate) return 0;
          return Math.max(0, Math.round((referenceDate.getTime() - new Date(dueDate).getTime()) / 86_400_000));
        })();

  if (daysOverdue <= 0) return "Vadesi Gelmemiş";
  if (daysOverdue <= 30) return "1-30 gün";
  if (daysOverdue <= 60) return "31-60 gün";
  if (daysOverdue <= 90) return "61-90 gün";
  return "90+ gün";
}

/** Buckets open (non-archived, remaining > 0) documents into standard aging ranges, grouped by currency within each bucket. */
export function computeAgingReport(rows: MirrorRow[], referenceDate: Date = new Date()): AgingBucket[] {
  const open = rows.filter(isOpenDocument);
  return AGING_BUCKET_LABELS.map((bucket) => {
    const rowsInBucket = open.filter((row) => agingBucketFor(row, referenceDate) === bucket);
    return { bucket, totals: groupByCurrency(rowsInBucket, "remaining"), count: rowsInBucket.length };
  });
}

export interface MonthlyTrendEntry {
  month: string; // YYYY-MM
  currency: string;
  count: number;
  total: string;
}

/** Groups non-archived documents by issue month and currency for the last `monthsBack` months (including the current month). */
export function buildMonthlyTrend(rows: MirrorRow[], monthsBack: number, referenceDate: Date, amountField = "gross_total"): MonthlyTrendEntry[] {
  const months: string[] = [];
  for (let offset = monthsBack - 1; offset >= 0; offset--) {
    const date = new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth() - offset, 1));
    months.push(date.toISOString().slice(0, 7));
  }

  const buckets = new Map<string, MirrorRow[]>();
  for (const row of rows) {
    if (row.source_archived) continue;
    const issueDate = row.attributes.issue_date as string | undefined;
    const month = issueDate?.slice(0, 7);
    if (!month || !months.includes(month)) continue;
    const currency = (row.attributes.currency as string | undefined) ?? "TRY";
    const key = `${month}|${currency}`;
    const list = buckets.get(key) ?? [];
    list.push(row);
    buckets.set(key, list);
  }

  const entries: MonthlyTrendEntry[] = [];
  for (const month of months) {
    const currenciesThisMonth = Array.from(buckets.keys())
      .filter((key) => key.startsWith(`${month}|`))
      .map((key) => key.split("|")[1]);
    const currencies = currenciesThisMonth.length > 0 ? currenciesThisMonth : ["TRY"];
    for (const currency of new Set(currencies)) {
      const rowsInBucket = buckets.get(`${month}|${currency}`) ?? [];
      entries.push({
        month,
        currency,
        count: rowsInBucket.length,
        total: sumDecimalStrings(rowsInBucket.map((row) => row.attributes[amountField] as string | undefined)),
      });
    }
  }
  return entries;
}
