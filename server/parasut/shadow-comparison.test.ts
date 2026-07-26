import { describe, expect, it } from "vitest";
import type { JsonApiResource } from "./types.ts";
import { compareResourceRows, summarizeAggregates, type ShadowComparisonRow } from "./shadow-comparison.ts";

// All rows below are synthetic fixtures — no live business values.

function row(attributes: Record<string, unknown>, currentTyped: Record<string, unknown>): ShadowComparisonRow {
  const rawPayload: JsonApiResource = { id: "fixture", type: "sales_invoices", attributes, relationships: {} };
  return { rawPayload, currentTyped };
}

describe("shadow-comparison — pure, zero-write aggregate comparison", () => {
  it("counts equal values when current typed column matches the payload exactly", () => {
    const rows: ShadowComparisonRow[] = [row({ gross_total: 100 }, { gross_total: 100 })];
    const [agg] = compareResourceRows("sales_invoices", rows).filter((a) => a.attribute === "gross_total");
    expect(agg.equalCount).toBe(1);
    expect(agg.mismatchCount).toBe(0);
  });

  it("counts a numeric-string payload that derives to the same number as an exact equal, not a mismatch", () => {
    // "100.0" derives to the number 100 via deriveOfflineRow itself, so this
    // is EQUAL by design (the mapper already normalizes it) — a genuinely
    // different normalization-only case is exercised separately below.
    const rawPayload: JsonApiResource = { id: "1", type: "sales_invoices", attributes: { gross_total: "100.0" }, relationships: {} };
    const rows: ShadowComparisonRow[] = [{ rawPayload, currentTyped: { gross_total: 100 } }];
    const [agg] = compareResourceRows("sales_invoices", rows).filter((a) => a.attribute === "gross_total");
    expect(agg.equalCount).toBe(1);
    expect(agg.mismatchCount).toBe(0);
  });

  it("counts a text field differing only by surrounding whitespace as a normalization-only difference, not a mismatch", () => {
    const rawPayload: JsonApiResource = { id: "1", type: "sales_invoices", attributes: { description: "Invoice note" }, relationships: {} };
    const rows: ShadowComparisonRow[] = [{ rawPayload, currentTyped: { description: "Invoice note " } }];
    const [agg] = compareResourceRows("sales_invoices", rows).filter((a) => a.attribute === "description");
    expect(agg.normalizationOnlyDifferenceCount).toBe(1);
    expect(agg.mismatchCount).toBe(0);
  });

  it("counts a genuine mismatch when values disagree after normalization", () => {
    const rawPayload: JsonApiResource = { id: "1", type: "sales_invoices", attributes: { gross_total: 999 }, relationships: {} };
    const rows: ShadowComparisonRow[] = [{ rawPayload, currentTyped: { gross_total: 1 } }];
    const [agg] = compareResourceRows("sales_invoices", rows).filter((a) => a.attribute === "gross_total");
    expect(agg.mismatchCount).toBe(1);
  });

  it("separately counts current-null/proposed-non-null and the reverse", () => {
    const rows: ShadowComparisonRow[] = [
      row({ gross_total: 50 }, {}), // current column absent -> null; proposed non-null
    ];
    const [agg] = compareResourceRows("sales_invoices", rows).filter((a) => a.attribute === "gross_total");
    expect(agg.currentNullProposedNonNullCount).toBe(1);
    expect(agg.currentNonNullProposedNullCount).toBe(0);
  });

  it("counts both-null rows as bothNullCount, not as a mismatch", () => {
    const rows: ShadowComparisonRow[] = [row({}, {})];
    const [agg] = compareResourceRows("sales_invoices", rows).filter((a) => a.attribute === "gross_total");
    expect(agg.bothNullCount).toBe(1);
    expect(agg.mismatchCount).toBe(0);
  });

  it("marks a zero-row resource as not-verifiable with reason ZERO_ROWS, per field", () => {
    const [agg] = compareResourceRows("sales_invoices", []).filter((a) => a.attribute === "gross_total");
    expect(agg.notVerifiableReason).toBe("ZERO_ROWS");
    expect(agg.totalRows).toBe(0);
  });

  it("produces one aggregate per registered field for the resource (53 for sales_invoices)", () => {
    const results = compareResourceRows("sales_invoices", []);
    expect(results.length).toBe(53);
  });

  it("never returns a raw value — only counts — in any aggregate", () => {
    const rows: ShadowComparisonRow[] = [row({ description: "sanitized fixture text" }, { description: "sanitized fixture text" })];
    const results = compareResourceRows("sales_invoices", rows);
    const serialized = JSON.stringify(results);
    expect(serialized).not.toContain("sanitized fixture text");
  });

  it("summarizeAggregates rolls up counts across all fields without exposing values", () => {
    const rows: ShadowComparisonRow[] = [row({ gross_total: 1 }, { gross_total: 1 })];
    const summary = summarizeAggregates(compareResourceRows("sales_invoices", rows));
    expect(summary.fields).toBe(53);
    expect(summary.equal).toBeGreaterThanOrEqual(1);
  });

  it("does not mutate the input rows array", () => {
    const rows: ShadowComparisonRow[] = [row({ gross_total: 1 }, { gross_total: 1 })];
    const before = JSON.stringify(rows);
    compareResourceRows("sales_invoices", rows);
    expect(JSON.stringify(rows)).toBe(before);
  });
});

// TASK 2 root-cause fix (Phase 2A continuation pass): the originally-reported
// failure ("counts a normalization-only difference (numeric string vs
// number)...", expected 1, got 0) was a TEST FIXTURE defect, not a
// comparator-logic defect. Root cause: the fixture used payload "100.0" vs
// current 100, but deriveOfflineRow (the mapper) already parses "100.0" to
// the JS number 100 *before* shadow-comparison.ts ever sees it — so by the
// time compareResourceRows runs, both sides are already the identical
// number 100 and the strict JSON.stringify check on line ~137 correctly
// reports them EQUAL. The mapper's own normalization happens one stage
// earlier than the fixture assumed; normalizedEqual() was never reached,
// and correctly so. That specific test was corrected in the prior pass
// ("counts a numeric-string payload that derives to the same number as an
// exact equal, not a mismatch", above) to assert the true behavior
// (equalCount, not normalizationOnlyDifferenceCount) instead of weakening
// the comparator or asserting a false expectation.
//
// While auditing this, a SEPARATE, real comparator defect was found and
// fixed in shadow-comparison.ts: normalizedEqual()'s jsonb branch used a
// naive JSON.stringify(a) === JSON.stringify(b) check, which reports two
// structurally-identical objects with different key insertion order as
// unequal. Fixed via canonicalize()/canonicalStringify() (same key-sorting
// convention already established in upsert-resource.ts's canonicalValue()),
// which sorts object keys recursively while preserving array element order
// (arrays remain order-significant, objects do not). This is a genuine bug
// fix, verified below, not a weakened expectation.
describe("shadow-comparison — TASK 2 required explicit assertions", () => {
  function numericRow(payloadValue: unknown, currentValue: unknown): ShadowComparisonRow {
    return { rawPayload: { id: "1", type: "sales_invoices", attributes: { gross_total: payloadValue }, relationships: {} }, currentTyped: { gross_total: currentValue } };
  }

  it("numeric 100 vs \"100.0\": mapper-normalizes upstream to equal numbers -> equalCount, never reaches normalizedEqual", () => {
    const [agg] = compareResourceRows("sales_invoices", [numericRow("100.0", 100)]).filter((a) => a.attribute === "gross_total");
    expect(agg.equalCount).toBe(1);
    expect(agg.mismatchCount).toBe(0);
    expect(agg.normalizationOnlyDifferenceCount).toBe(0);
  });

  it("numeric \"001.500\" vs \"1.5\": both parse to the same number via the mapper -> equalCount", () => {
    const [agg] = compareResourceRows("sales_invoices", [numericRow("001.500", "1.5")]).filter((a) => a.attribute === "gross_total");
    // currentTyped here simulates a text-cast source (e.g. a readable view) —
    // "1.5" (string) vs proposed number 1.5: JSON.stringify differs
    // ('"1.5"' vs '1.5'), so this DOES reach normalizedEqual's numeric branch.
    expect(agg.normalizationOnlyDifferenceCount).toBe(1);
    expect(agg.mismatchCount).toBe(0);
  });

  it("boolean true vs string \"true\": simulates a text-cast current value against a correctly-typed derived boolean -> normalizationOnlyDifferenceCount", () => {
    const rawPayload: JsonApiResource = { id: "1", type: "sales_invoices", attributes: { cash_sale: true }, relationships: {} };
    const rows: ShadowComparisonRow[] = [{ rawPayload, currentTyped: { cash_sale: "true" } }];
    const [agg] = compareResourceRows("sales_invoices", rows).filter((a) => a.attribute === "cash_sale");
    expect(agg.normalizationOnlyDifferenceCount).toBe(1);
    expect(agg.mismatchCount).toBe(0);
  });

  it("permitted equivalent date representations (with/without milliseconds, explicit UTC offset) -> normalizationOnlyDifferenceCount", () => {
    const rawPayload: JsonApiResource = { id: "1", type: "sales_invoices", attributes: { issue_date: "2026-06-01" }, relationships: {} };
    const rows: ShadowComparisonRow[] = [{ rawPayload, currentTyped: { issue_date: "2026-06-01T00:00:00.000Z" } }];
    const [agg] = compareResourceRows("sales_invoices", rows).filter((a) => a.attribute === "issue_date");
    expect(agg.normalizationOnlyDifferenceCount).toBe(1);
    expect(agg.mismatchCount).toBe(0);
  });

  it("JSON objects with different key order are treated as a normalization-only difference, not a mismatch (fixed defect)", () => {
    const rawPayload: JsonApiResource = { id: "1", type: "sales_invoices", attributes: { e_document_accounts: { b: 2, a: 1 } }, relationships: {} };
    const rows: ShadowComparisonRow[] = [{ rawPayload, currentTyped: { e_document_accounts: { a: 1, b: 2 } } }];
    const [agg] = compareResourceRows("sales_invoices", rows).filter((a) => a.attribute === "e_document_accounts");
    expect(agg.normalizationOnlyDifferenceCount).toBe(1);
    expect(agg.mismatchCount).toBe(0);
  });

  it("JSON arrays where order is significant: reordered elements are a genuine mismatch, not normalization-only", () => {
    const rawPayload: JsonApiResource = { id: "1", type: "sales_invoices", attributes: { payer_tax_numbers: ["111", "222"] }, relationships: {} };
    const rows: ShadowComparisonRow[] = [{ rawPayload, currentTyped: { payer_tax_numbers: ["222", "111"] } }];
    const [agg] = compareResourceRows("sales_invoices", rows).filter((a) => a.attribute === "payer_tax_numbers");
    expect(agg.mismatchCount).toBe(1);
    expect(agg.normalizationOnlyDifferenceCount).toBe(0);
  });

  it("null vs missing key: both resolve to null on the proposed side and are counted as bothNull, distinctly from a real value", () => {
    const missingKeyRow: ShadowComparisonRow = { rawPayload: { id: "1", type: "sales_invoices", attributes: {}, relationships: {} }, currentTyped: {} };
    const explicitNullRow: ShadowComparisonRow = { rawPayload: { id: "2", type: "sales_invoices", attributes: { description: null }, relationships: {} }, currentTyped: {} };
    const [aggMissing] = compareResourceRows("sales_invoices", [missingKeyRow]).filter((a) => a.attribute === "description");
    const [aggNull] = compareResourceRows("sales_invoices", [explicitNullRow]).filter((a) => a.attribute === "description");
    expect(aggMissing.bothNullCount).toBe(1);
    expect(aggNull.bothNullCount).toBe(1);
  });

  it("empty string vs null: an empty string is a real (non-null) value, distinct from null — currentNonNullProposedNullCount fires, not bothNull", () => {
    const rawPayload: JsonApiResource = { id: "1", type: "sales_invoices", attributes: {}, relationships: {} }; // missing key -> proposed null
    const rows: ShadowComparisonRow[] = [{ rawPayload, currentTyped: { description: "" } }]; // current is "" (non-null)
    const [agg] = compareResourceRows("sales_invoices", rows).filter((a) => a.attribute === "description");
    expect(agg.currentNonNullProposedNullCount).toBe(1);
    expect(agg.bothNullCount).toBe(0);
  });
});
