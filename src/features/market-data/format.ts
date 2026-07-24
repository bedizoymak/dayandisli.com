const rateFormatter = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatTryAmount(value: number): string {
  return `₺${rateFormatter.format(value)}`;
}

const TR_MONTHS = [
  "Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık",
];

/** `rateDate` is a "YYYY-MM-DD" calendar date (Frankfurter/TCMB), not a
 * timestamp — parsed manually to avoid UTC-vs-local day drift. */
export function formatCurrencyMeta(rateDate: string, source: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(rateDate);
  if (!match) return source;
  const day = Number(match[3]);
  const month = TR_MONTHS[Number(match[2]) - 1];
  if (!month) return source;
  return `${day} ${month} · ${source}`;
}

export function formatGoldMeta(updatedAtIso: string): string {
  const date = new Date(updatedAtIso);
  if (Number.isNaN(date.getTime())) return "Güncellendi —";
  const time = date.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
  return `Güncellendi ${time}`;
}

export function formatTemperature(celsius: number): string {
  return `${Math.round(celsius)}°`;
}

const STALE_THRESHOLD_MS = 20 * 60_000;

export function isMarketDataStale(dataUpdatedAtMs: number, nowMs: number = Date.now()): boolean {
  if (!dataUpdatedAtMs) return false;
  return nowMs - dataUpdatedAtMs > STALE_THRESHOLD_MS;
}

export type WeatherIconKey =
  | "sun"
  | "moon"
  | "cloud-sun"
  | "cloud"
  | "fog"
  | "drizzle"
  | "rain"
  | "showers"
  | "snow"
  | "thunder";

/** Tomorrow.io weather codes — kept in sync with
 * supabase/functions/market-data/handlers.ts's mapWeatherCodeToTurkish. */
export function getWeatherIconKey(code: number, isDay: boolean): WeatherIconKey {
  if (code === 1000 || code === 1100) return isDay ? "sun" : "moon";
  if (code === 1101) return "cloud-sun";
  if (code === 1102 || code === 1001) return "cloud";
  if (code === 2000 || code === 2100) return "fog";
  if (code === 4000 || code === 6000) return "drizzle";
  if (code === 4001 || code === 4200 || code === 6001 || code === 6200) return "rain";
  if (code === 4201 || code === 6201) return "showers";
  if (code === 5000 || code === 5001 || code === 5100 || code === 5101 || code === 7000 || code === 7101 || code === 7102) return "snow";
  if (code === 8000) return "thunder";
  return "cloud";
}
