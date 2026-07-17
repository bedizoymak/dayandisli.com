// Generic currency-grouping and monthly-trend aggregation helpers, shared
// across the ERP service layer. Never combines currencies into one total —
// see ERP_BUSINESS_ARCHITECTURE.md's accounting-safety rule.
import { sumDecimalStrings } from "./decimal.ts";
import type { CurrencyAmount, TrendPoint } from "./types.ts";

export function groupSumByCurrency<T>(rows: T[], amountOf: (row: T) => string, currencyOf: (row: T) => string): CurrencyAmount[] {
  const currencies = new Set(rows.map(currencyOf));
  return Array.from(currencies)
    .map((currency) => ({
      currency,
      amount: sumDecimalStrings(rows.filter((row) => currencyOf(row) === currency).map(amountOf)),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function buildMonthlyTrend<T>(
  rows: T[],
  months: number,
  now: Date,
  amountOf: (row: T) => string,
  dateOf: (row: T) => string,
  currencyOf: (row: T) => string,
): TrendPoint[] {
  const buckets = new Map<string, { currency: string; rows: T[] }>();
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1));

  for (const row of rows) {
    const date = new Date(dateOf(row));
    if (Number.isNaN(date.getTime()) || date < cutoff) continue;
    const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const currency = currencyOf(row);
    const bucketKey = `${monthKey}|${currency}`;
    const bucket = buckets.get(bucketKey) ?? { currency, rows: [] };
    bucket.rows.push(row);
    buckets.set(bucketKey, bucket);
  }

  return Array.from(buckets.entries())
    .map(([bucketKey, bucket]) => {
      const [month] = bucketKey.split("|");
      return {
        month,
        currency: bucket.currency,
        total: sumDecimalStrings(bucket.rows.map(amountOf)),
        documentCount: bucket.rows.length,
      };
    })
    .sort((a, b) => (a.month === b.month ? a.currency.localeCompare(b.currency) : a.month.localeCompare(b.month)));
}
