import type { QuoteLineDraft } from "./quoteTypes";

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export type QuoteLineCalcInput = Pick<QuoteLineDraft, "quantity" | "unitPrice" | "discountPct" | "vatPct">;

/** Unit prices are VAT-exclusive; line total is VAT-inclusive. */
export function calculateLineTotal(line: QuoteLineCalcInput): number {
  const gross = line.quantity * line.unitPrice;
  const afterDiscount = gross * (1 - line.discountPct / 100);
  return round2(afterDiscount * (1 + line.vatPct / 100));
}

export type QuoteTotals = {
  subtotal: number;
  discountTotal: number;
  vatTotal: number;
  grandTotal: number;
};

/** subtotal = sum of gross (pre-discount, pre-VAT) line amounts. grandTotal is VAT-inclusive. */
export function calculateQuoteTotals(lines: readonly QuoteLineCalcInput[]): QuoteTotals {
  let subtotal = 0;
  let discountTotal = 0;
  let vatTotal = 0;
  for (const line of lines) {
    const gross = line.quantity * line.unitPrice;
    const discount = gross * (line.discountPct / 100);
    const net = gross - discount;
    subtotal += gross;
    discountTotal += discount;
    vatTotal += net * (line.vatPct / 100);
  }
  return {
    subtotal: round2(subtotal),
    discountTotal: round2(discountTotal),
    vatTotal: round2(vatTotal),
    grandTotal: round2(subtotal - discountTotal + vatTotal),
  };
}
