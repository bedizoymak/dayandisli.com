import { describe, expect, it } from "vitest";
import {
  buildMonthlyTrend,
  buildUpcomingTimeline,
  computeAgingReport,
  computeChequeSummary,
  computeMonthlyVatEstimate,
  computeOpenDocumentSummary,
  computeUnsentSummary,
  decimalToNumber,
  formatDecimalScaled,
  isOverdue,
  isPositiveDecimal,
  parseDecimalScaled,
  sumDecimalStrings,
  type MirrorRow,
} from "./parasut-metrics.ts";

function row(overrides: Partial<MirrorRow["attributes"]> & { relationships?: MirrorRow["relationships"]; archived?: boolean }): MirrorRow {
  const { relationships, archived, ...attributes } = overrides;
  return {
    parasut_id: (attributes.parasut_id as string) ?? "1",
    attributes,
    relationships: relationships ?? {},
    source_archived: archived ?? false,
    synced_at: "2026-07-01T00:00:00.000Z",
    last_seen_at: "2026-07-01T00:00:00.000Z",
  };
}

describe("decimal-safe arithmetic", () => {
  it("parses and formats decimal strings without binary floating point drift", () => {
    expect(formatDecimalScaled(parseDecimalScaled("8400.0"))).toBe("8400.00");
    expect(formatDecimalScaled(parseDecimalScaled("-102500.5"))).toBe("-102500.50");
    expect(parseDecimalScaled(null)).toBe(0n);
    expect(parseDecimalScaled(undefined)).toBe(0n);
    expect(parseDecimalScaled("not-a-number")).toBe(0n);
  });

  it("sums many small decimal values exactly, unlike native float summation", () => {
    const values = Array.from({ length: 10 }, () => "0.1");
    // Native `0.1` summed 10 times in IEEE754 float drifts to 0.9999999999999999.
    expect(values.reduce((total, value) => total + Number(value), 0)).not.toBe(1);
    expect(sumDecimalStrings(values)).toBe("1.00");
  });

  it("reports positivity correctly including negative and zero values", () => {
    expect(isPositiveDecimal("0.00")).toBe(false);
    expect(isPositiveDecimal("-5")).toBe(false);
    expect(isPositiveDecimal("0.01")).toBe(true);
    expect(decimalToNumber("1400.50")).toBe(1400.5);
  });
});

describe("isOverdue — business-date boundary (Türkiye/Europe/Istanbul calendar date)", () => {
  // 2026-08-11T10:00:00Z = 2026-08-11T13:00 Europe/Istanbul (UTC+3, no DST) —
  // safely mid-day so the exact wall-clock hour cannot itself be ambiguous.
  const businessDate = new Date("2026-08-11T10:00:00.000Z");

  it("due_date 2026-08-09 (two days before business today) is overdue", () => {
    expect(isOverdue(row({ due_date: "2026-08-09" }), businessDate)).toBe(true);
  });

  it("due_date 2026-08-10 (yesterday, business today) is overdue — the exact production defect", () => {
    expect(isOverdue(row({ due_date: "2026-08-10" }), businessDate)).toBe(true);
  });

  it("due_date 2026-08-11 (business today) is NOT overdue — a document due today is not yet overdue", () => {
    expect(isOverdue(row({ due_date: "2026-08-11" }), businessDate)).toBe(false);
  });

  it("due_date 2026-08-12 (tomorrow) is NOT overdue", () => {
    expect(isOverdue(row({ due_date: "2026-08-12" }), businessDate)).toBe(false);
  });

  it("due_date NULL/absent is unscheduled, never overdue", () => {
    expect(isOverdue(row({}), businessDate)).toBe(false);
  });

  it("stale/contradictory days_overdue = 0 with an objectively past due_date MUST still be overdue (the reported production bug)", () => {
    expect(isOverdue(row({ due_date: "2026-08-10", days_overdue: 0 }), businessDate)).toBe(true);
  });

  it("days_overdue > 0 with an overdue due_date is overdue (fast path still works)", () => {
    expect(isOverdue(row({ due_date: "2026-08-01", days_overdue: 10 }), businessDate)).toBe(true);
  });

  it("does not regress into a UTC midnight boundary: 2026-08-10T22:30:00Z is 2026-08-11 01:30 in Istanbul, so a document due 2026-08-11 is NOT yet overdue even though the UTC calendar date is still 2026-08-10", () => {
    const earlyIstanbulMorning = new Date("2026-08-10T22:30:00.000Z");
    expect(isOverdue(row({ due_date: "2026-08-11" }), earlyIstanbulMorning)).toBe(false);
    // A naive `referenceDate.toISOString().slice(0, 10)` would read "2026-08-10" here (UTC) and
    // wrongly treat 2026-08-10 as still-current/not-yet-due — the Istanbul-aware date is 2026-08-11,
    // so a document due 2026-08-10 at this exact instant IS already overdue in Türkiye business time.
    expect(isOverdue(row({ due_date: "2026-08-10" }), earlyIstanbulMorning)).toBe(true);
  });
});

describe("computeOpenDocumentSummary", () => {
  const referenceDate = new Date("2026-07-15T00:00:00.000Z");

  it("only counts non-archived documents with positive remaining balance", () => {
    const rows: MirrorRow[] = [
      row({ remaining: "100.0", currency: "TRY", due_date: "2026-07-01", days_overdue: 5 }),
      row({ remaining: "0.0", currency: "TRY", due_date: "2026-07-01" }),
      row({ remaining: "50.0", currency: "TRY", due_date: "2026-01-01", days_overdue: 3, archived: true }),
    ];
    const summary = computeOpenDocumentSummary(rows, referenceDate);
    expect(summary.totalDue).toEqual([{ currency: "TRY", total: "100.00" }]);
    expect(summary.overdueCount).toBe(1);
  });

  it("a document with no due_date is unscheduled, never overdue, even if days_overdue is stale/positive", () => {
    const rows: MirrorRow[] = [
      row({ remaining: "200.0", currency: "TRY", days_overdue: 10 }), // no due_date at all -> unscheduled, NOT overdue
      row({ remaining: "300.0", currency: "TRY", due_date: "2099-01-01", days_overdue: 0 }), // future, not overdue
    ];
    const summary = computeOpenDocumentSummary(rows, referenceDate);
    expect(summary.overdueCount).toBe(0);
    expect(summary.unscheduledCount).toBe(1);
  });

  it("falls back to comparing due_date against the reference date when days_overdue is absent", () => {
    const rows: MirrorRow[] = [
      row({ remaining: "10.0", currency: "TRY", due_date: "2026-07-01" }), // past reference date, no days_overdue field
      row({ remaining: "10.0", currency: "TRY", due_date: "2026-08-01" }), // future
    ];
    expect(computeOpenDocumentSummary(rows, referenceDate).overdueCount).toBe(1);
  });

  it("counts is_recurred_item as recurring without inventing a field", () => {
    const rows: MirrorRow[] = [
      row({ remaining: "10.0", currency: "TRY", due_date: "2026-08-01", is_recurred_item: true }),
      row({ remaining: "10.0", currency: "TRY", due_date: "2026-08-01", is_recurred_item: false }),
    ];
    expect(computeOpenDocumentSummary(rows, referenceDate).recurringCount).toBe(1);
  });

  it("keeps different currencies separate instead of summing them together", () => {
    const rows: MirrorRow[] = [
      row({ remaining: "100.0", currency: "TRY", due_date: "2026-08-01" }),
      row({ remaining: "50.0", currency: "USD", due_date: "2026-08-01" }),
    ];
    const summary = computeOpenDocumentSummary(rows, referenceDate);
    expect(summary.totalDue).toEqual([
      { currency: "TRY", total: "100.00" },
      { currency: "USD", total: "50.00" },
    ]);
  });
});

describe("computeChequeSummary", () => {
  const referenceDate = new Date("2026-07-15T00:00:00.000Z");

  it("filters strictly by direction: is_in for received, is_out for given, never both", () => {
    const rows: MirrorRow[] = [
      row({ is_in: true, is_out: false, remaining_in_trl: "100.0" }),
      row({ is_in: false, is_out: true, remaining_in_trl: "200.0" }),
    ];
    expect(computeChequeSummary(rows, "is_in", referenceDate).total).toBe("100.00");
    expect(computeChequeSummary(rows, "is_out", referenceDate).total).toBe("200.00");
  });

  it("open is purely remaining_in_trl > 0 — no source_archived check, since checks expose no archived attribute", () => {
    const rows: MirrorRow[] = [
      row({ is_in: true, remaining_in_trl: "100.0", archived: true }), // "archived" here only sets source_archived, which computeChequeSummary ignores
      row({ is_in: true, remaining_in_trl: "0.0" }), // cashed/closed
    ];
    const summary = computeChequeSummary(rows, "is_in", referenceDate);
    expect(summary.total).toBe("100.00");
    expect(summary.count).toBe(2); // count is every directional row regardless of open state
  });

  it("classifies overdue via days_overdue or due_date, same convention as computeOpenDocumentSummary — but no due_date is never overdue regardless of days_overdue", () => {
    const rows: MirrorRow[] = [
      row({ is_in: true, remaining_in_trl: "100.0", days_overdue: 5 }), // no due_date at all -> not overdue
      row({ is_in: true, remaining_in_trl: "200.0", due_date: "2026-01-01" }), // past reference date, no days_overdue field
      row({ is_in: true, remaining_in_trl: "300.0", due_date: "2099-01-01" }), // future
    ];
    const summary = computeChequeSummary(rows, "is_in", referenceDate);
    expect(summary.overdueCount).toBe(1);
    expect(summary.overdue).toBe("200.00");
  });

  it("classifies unscheduled via missing due_date, among open cheques only", () => {
    const rows: MirrorRow[] = [
      row({ is_in: true, remaining_in_trl: "100.0" }), // no due_date -> unscheduled
      row({ is_in: true, remaining_in_trl: "0.0" }), // no due_date but closed -> excluded from unscheduled
      row({ is_in: true, remaining_in_trl: "50.0", due_date: "2099-01-01" }),
    ];
    const summary = computeChequeSummary(rows, "is_in", referenceDate);
    expect(summary.unscheduledCount).toBe(1);
    expect(summary.unscheduled).toBe("100.00");
  });

  it("uses remaining_in_trl directly regardless of currency — no per-currency grouping/exclusion like documents", () => {
    const rows: MirrorRow[] = [
      row({ is_in: true, currency: "TRL", remaining_in_trl: "100.0" }),
      row({ is_in: true, currency: "USD", remaining_in_trl: "50.0" }), // Paraşüt's own conversion, included as-is
    ];
    expect(computeChequeSummary(rows, "is_in", referenceDate).total).toBe("150.00");
  });
});

describe("computeUnsentSummary", () => {
  it("flags invoices with no printed_at and zero sharings as unsent", () => {
    const rows: MirrorRow[] = [
      row({ remaining: "10.0", currency: "TRY", printed_at: null, sharings_count: 0 }),
      row({ remaining: "10.0", currency: "TRY", printed_at: "2026-07-01T00:00:00Z", sharings_count: 0 }),
      row({ remaining: "10.0", currency: "TRY", printed_at: null, sharings_count: 2 }),
    ];
    expect(computeUnsentSummary(rows).count).toBe(1);
  });
});

describe("computeMonthlyVatEstimate", () => {
  it("nets output VAT against input VAT for the current month only, per currency", () => {
    const referenceDate = new Date("2026-07-15T00:00:00.000Z");
    const sales: MirrorRow[] = [
      row({ total_vat: "1400.0", currency: "TRY", issue_date: "2026-07-10" }),
      row({ total_vat: "999.0", currency: "TRY", issue_date: "2026-06-30" }), // out of month, excluded
    ];
    const purchases: MirrorRow[] = [row({ total_vat: "400.0", currency: "TRY", issue_date: "2026-07-05" })];

    const result = computeMonthlyVatEstimate(sales, purchases, referenceDate);
    expect(result).toEqual([{ currency: "TRY", outputVat: "1400.00", inputVat: "400.00", netVat: "1000.00" }]);
  });

  it("excludes archived documents from the estimate", () => {
    const referenceDate = new Date("2026-07-15T00:00:00.000Z");
    const sales: MirrorRow[] = [row({ total_vat: "1400.0", currency: "TRY", issue_date: "2026-07-10", archived: true })];
    const result = computeMonthlyVatEstimate(sales, [], referenceDate);
    expect(result).toEqual([]);
  });
});

describe("buildUpcomingTimeline", () => {
  const referenceDate = new Date("2026-07-15T00:00:00.000Z");

  it("merges receivables and payables sorted by days from today (overdue first), resolving contact names", () => {
    const contactNames = new Map([["c1", "Acme A.Ş."], ["s1", "Tedarik Ltd."]]);
    const sales: MirrorRow[] = [
      row({
        remaining: "100.0",
        currency: "TRY",
        due_date: "2026-08-01",
        days_till_due_date: 17,
        invoice_no: "HD001",
        relationships: { contact: { data: { id: "c1", type: "contacts" } } },
      }),
    ];
    const purchases: MirrorRow[] = [
      row({
        remaining: "50.0",
        currency: "TRY",
        due_date: "2026-07-01",
        days_till_due_date: -14,
        invoice_no: "PB001",
        relationships: { supplier: { data: { id: "s1", type: "contacts" } } },
      }),
    ];

    const timeline = buildUpcomingTimeline(sales, purchases, contactNames, referenceDate);
    expect(timeline).toHaveLength(2);
    expect(timeline[0]).toMatchObject({ kind: "payable", partyName: "Tedarik Ltd.", overdue: true, daysFromToday: -14 });
    expect(timeline[1]).toMatchObject({ kind: "receivable", partyName: "Acme A.Ş.", overdue: false, daysFromToday: 17 });
  });

  it("excludes documents without a due date and fully paid documents", () => {
    const sales: MirrorRow[] = [
      row({ remaining: "100.0", currency: "TRY", due_date: null }),
      row({ remaining: "0.0", currency: "TRY", due_date: "2026-08-01" }),
    ];
    expect(buildUpcomingTimeline(sales, [], new Map(), referenceDate)).toEqual([]);
  });
});

describe("computeAgingReport", () => {
  const referenceDate = new Date("2026-07-15T00:00:00.000Z");

  it("buckets open documents by days overdue using the confirmed days_overdue field", () => {
    const rows: MirrorRow[] = [
      row({ remaining: "100.0", currency: "TRY", days_overdue: 0 }),
      row({ remaining: "100.0", currency: "TRY", days_overdue: 15 }),
      row({ remaining: "100.0", currency: "TRY", days_overdue: 45 }),
      row({ remaining: "100.0", currency: "TRY", days_overdue: 75 }),
      row({ remaining: "100.0", currency: "TRY", days_overdue: 400 }),
    ];
    const report = computeAgingReport(rows, referenceDate);
    expect(report.map((bucket) => bucket.count)).toEqual([1, 1, 1, 1, 1]);
    expect(report.find((bucket) => bucket.bucket === "90+ gün")?.totals).toEqual([{ currency: "TRY", total: "100.00" }]);
  });

  it("excludes archived and fully-paid documents from every bucket", () => {
    const rows: MirrorRow[] = [
      row({ remaining: "100.0", currency: "TRY", days_overdue: 5, archived: true }),
      row({ remaining: "0.0", currency: "TRY", days_overdue: 5 }),
    ];
    const report = computeAgingReport(rows, referenceDate);
    expect(report.every((bucket) => bucket.count === 0)).toBe(true);
  });

  it("falls back to computing days overdue from due_date when days_overdue is absent", () => {
    const rows: MirrorRow[] = [row({ remaining: "50.0", currency: "TRY", due_date: "2026-05-15" })]; // 61 days before reference
    const report = computeAgingReport(rows, referenceDate);
    expect(report.find((bucket) => bucket.bucket === "61-90 gün")?.count).toBe(1);
  });
});

describe("buildMonthlyTrend", () => {
  it("groups non-archived documents by issue month and currency, filling requested months even when empty", () => {
    const referenceDate = new Date("2026-07-15T00:00:00.000Z");
    const rows: MirrorRow[] = [
      row({ gross_total: "100.0", currency: "TRY", issue_date: "2026-07-01" }),
      row({ gross_total: "200.0", currency: "TRY", issue_date: "2026-07-20" }),
      row({ gross_total: "50.0", currency: "USD", issue_date: "2026-06-10" }),
      row({ gross_total: "999.0", currency: "TRY", issue_date: "2025-01-01" }), // outside window
    ];
    const trend = buildMonthlyTrend(rows, 3, referenceDate);
    expect(trend).toContainEqual({ month: "2026-07", currency: "TRY", count: 2, total: "300.00" });
    expect(trend).toContainEqual({ month: "2026-06", currency: "USD", count: 1, total: "50.00" });
    expect(trend.some((entry) => entry.total === "999.00")).toBe(false);
  });

  it("excludes archived documents", () => {
    const referenceDate = new Date("2026-07-15T00:00:00.000Z");
    const rows: MirrorRow[] = [row({ gross_total: "100.0", currency: "TRY", issue_date: "2026-07-01", archived: true })];
    const trend = buildMonthlyTrend(rows, 1, referenceDate);
    expect(trend.find((entry) => entry.month === "2026-07" && entry.currency === "TRY")?.count).toBe(0);
  });
});
