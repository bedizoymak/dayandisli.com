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

/** WMO weather codes as used by Open-Meteo — kept in sync with
 * supabase/functions/market-data/handlers.ts's mapWeatherCodeToTurkish. */
export function getWeatherIconKey(code: number, isDay: boolean): WeatherIconKey {
  if (code === 0) return isDay ? "sun" : "moon";
  if (code === 1 || code === 2) return "cloud-sun";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || code === 80 || code === 81) return "rain";
  if (code === 82) return "showers";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95 && code <= 99) return "thunder";
  return "cloud";
}
