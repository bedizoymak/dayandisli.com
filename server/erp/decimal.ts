// Decimal-safe money arithmetic for the ERP business layer. Deliberately
// independent of supabase/functions/_shared/parasut-metrics.ts even though
// the algorithm is the same pattern — the ERP layer must never import
// Paraşüt-specific modules (see ERP_BUSINESS_ARCHITECTURE.md). Fixed-point
// bigint scaled by 10^SCALE_DIGITS, avoiding float drift on financial sums.
const SCALE_DIGITS = 6;
const SCALE = 10n ** BigInt(SCALE_DIGITS);

export function parseDecimalScaled(value: string | number | null | undefined): bigint {
  if (value === null || value === undefined) return 0n;
  const raw = String(value).trim();
  if (!raw) return 0n;
  const negative = raw.startsWith("-");
  const unsigned = negative ? raw.slice(1) : raw;
  const [wholePart, fractionPart = ""] = unsigned.split(".");
  const fraction = (fractionPart + "0".repeat(SCALE_DIGITS)).slice(0, SCALE_DIGITS);
  const whole = wholePart || "0";
  if (!/^\d+$/.test(whole) || !/^\d*$/.test(fractionPart)) return 0n;
  const scaled = BigInt(whole) * SCALE + BigInt(fraction || "0");
  return negative ? -scaled : scaled;
}

export function formatDecimalScaled(scaled: bigint): string {
  const negative = scaled < 0n;
  const abs = negative ? -scaled : scaled;
  const whole = abs / SCALE;
  const fraction = (abs % SCALE).toString().padStart(SCALE_DIGITS, "0").slice(0, 2);
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function sumDecimalStrings(values: Array<string | number | null | undefined>): string {
  const total = values.reduce((sum, value) => sum + parseDecimalScaled(value), 0n);
  return formatDecimalScaled(total);
}

export function subtractDecimalStrings(a: string | number | null | undefined, b: string | number | null | undefined): string {
  return formatDecimalScaled(parseDecimalScaled(a) - parseDecimalScaled(b));
}

export function isPositiveDecimal(value: string | number | null | undefined): boolean {
  return parseDecimalScaled(value) > 0n;
}

export function multiplyDecimalByInt(value: string | number | null | undefined, multiplier: number): string {
  return formatDecimalScaled(parseDecimalScaled(value) * BigInt(Math.round(multiplier)));
}

/** Fixed-point decimal × decimal multiplication (e.g. unit price × fractional quantity) — never loses precision to a float intermediate. */
export function multiplyDecimalStrings(a: string | number | null | undefined, b: string | number | null | undefined): string {
  return formatDecimalScaled((parseDecimalScaled(a) * parseDecimalScaled(b)) / SCALE);
}
