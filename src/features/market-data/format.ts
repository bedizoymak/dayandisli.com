const rateFormatter = new Intl.NumberFormat("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatTryAmount(value: number): string {
  return `₺${rateFormatter.format(value)}`;
}

const PROVIDER_LABELS: Record<string, string> = {
  "metalpriceapi.com": "MetalPriceAPI",
};

/** Card sublabels show the provider only — no rate date or update time, by
 * design (dates/times were removed from all market/weather cards). Raw
 * source identifiers are mapped to a friendlier display name where one is
 * known; unrecognized sources (e.g. "TCMB") pass through unchanged. */
export function formatProviderLabel(source: string): string {
  return PROVIDER_LABELS[source] ?? source;
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
