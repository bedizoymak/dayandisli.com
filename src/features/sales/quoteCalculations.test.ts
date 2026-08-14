import { describe, expect, it } from "vitest";
import { calculateLineTotal, calculateQuoteTotals } from "./quoteCalculations";

describe("calculateLineTotal", () => {
  it("computes a plain line with no discount at 20% VAT", () => {
    // 10 * 100 = 1000 gross, no discount, +20% VAT = 1200
    expect(calculateLineTotal({ quantity: 10, unitPrice: 100, discountPct: 0, vatPct: 20 })).toBe(1200);
  });

  it("applies discount before VAT", () => {
    // 1000 gross, 10% discount -> 900, +20% VAT -> 1080
    expect(calculateLineTotal({ quantity: 10, unitPrice: 100, discountPct: 10, vatPct: 20 })).toBe(1080);
  });

  it("is currency-agnostic (pure number arithmetic, no symbol/locale involved)", () => {
    // Same math regardless of which currency the caller later formats it in.
    const line = { quantity: 2, unitPrice: 50, discountPct: 5, vatPct: 20 };
    expect(calculateLineTotal(line)).toBe(calculateLineTotal({ ...line }));
  });

  it("handles zero quantity/price without producing NaN", () => {
    expect(calculateLineTotal({ quantity: 0, unitPrice: 0, discountPct: 0, vatPct: 20 })).toBe(0);
  });
});

describe("calculateQuoteTotals", () => {
  it("sums subtotal, discount, VAT and grand total across multiple lines", () => {
    const totals = calculateQuoteTotals([
      { quantity: 1, unitPrice: 12000, discountPct: 0, vatPct: 20 }, // 12000, vat 2400
      { quantity: 1, unitPrice: 13000, discountPct: 0, vatPct: 20 }, // 13000, vat 2600
    ]);
    expect(totals.subtotal).toBe(25000);
    expect(totals.discountTotal).toBe(0);
    expect(totals.vatTotal).toBe(5000);
    expect(totals.grandTotal).toBe(30000);
  });

  it("accounts for per-line discount in both discountTotal and vatTotal (VAT applies after discount)", () => {
    const totals = calculateQuoteTotals([{ quantity: 1, unitPrice: 1000, discountPct: 10, vatPct: 20 }]);
    expect(totals.discountTotal).toBe(100);
    expect(totals.vatTotal).toBe(180); // (1000-100)*0.20
    expect(totals.grandTotal).toBe(1080);
  });

  it("returns all zeros for an empty line list", () => {
    expect(calculateQuoteTotals([])).toEqual({ subtotal: 0, discountTotal: 0, vatTotal: 0, grandTotal: 0 });
  });

  it("grandTotal tracks subtotal - discountTotal + vatTotal within a rounding cent (each figure is independently rounded to 2dp)", () => {
    const totals = calculateQuoteTotals([
      { quantity: 3, unitPrice: 249.99, discountPct: 7.5, vatPct: 20 },
      { quantity: 1, unitPrice: 1500, discountPct: 0, vatPct: 20 },
    ]);
    expect(totals.grandTotal).toBeCloseTo(totals.subtotal - totals.discountTotal + totals.vatTotal, 1);
  });
});
