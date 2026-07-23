const currencyFormatterCache = new Map<string, Intl.NumberFormat>();

function getCurrencyFormatter(currency: string): Intl.NumberFormat {
  const existing = currencyFormatterCache.get(currency);
  if (existing) return existing;
  const formatter = new Intl.NumberFormat("tr-TR", { style: "currency", currency, maximumFractionDigits: 2 });
  currencyFormatterCache.set(currency, formatter);
  return formatter;
}

/** Formats a Paraşüt decimal string (e.g. "8400.0") for display. Display-only: safe to use `Number()` here
 * because no summation happens at this layer — aggregation is done with decimal-safe arithmetic server-side. */
export function formatParasutCurrency(value: string | number | null | undefined, currency: string | null | undefined): string {
  if (value === null || value === undefined) return "—";
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return "—";
  try {
    return getCurrencyFormatter(currency || "TRY").format(numeric);
  } catch {
    return `${numeric.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ${currency ?? ""}`.trim();
  }
}

export function formatParasutDate(value: string | null | undefined): string {
  if (!value) return "—";
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) return `${dateOnly[3]}.${dateOnly[2]}.${dateOnly[1]}`;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatParasutDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Turkish relative-day label matching the Paraşüt dashboard style ("16 gün sonra" / "247 gün gecikti" / "Bugün"). */
export function formatRelativeDays(daysFromToday: number): string {
  if (daysFromToday === 0) return "Bugün";
  if (daysFromToday > 0) return `${daysFromToday} gün sonra`;
  return `${Math.abs(daysFromToday)} gün gecikti`;
}

export function formatCount(value: number): string {
  return value.toLocaleString("tr-TR");
}
