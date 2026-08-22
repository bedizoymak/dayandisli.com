// Pure aggregation logic for the market-data edge function — no Deno-specific
// imports, so it can be unit-tested directly with Vitest (see
// handlers.test.ts) exactly like supabase/functions/parasut-api/handlers.ts.
//
// Providers:
//  - Currency: Frankfurter (api.frankfurter.dev), TCMB indicative rates.
//  - Weather: Tomorrow.io realtime weather, at the caller's coordinates
//    (fixed Istanbul coordinates when none are supplied).
//  - Gold: MetalpriceAPI (https://api.metalpriceapi.com/v1/latest,
//    base=XAU&currencies=TRY&api_key=..., ounce price converted to grams).
//  - Reverse geocoding: Nominatim (OpenStreetMap), no API key. Open-Meteo
//    was the originally preferred provider but does not offer reverse
//    geocoding (confirmed against its docs) — Nominatim's `address.town`
//    field reliably carries the Istanbul district (ilçe) name, confirmed
//    against the live API for two real coordinate pairs.
//
// Every provider call is isolated: one provider failing never blocks the
// others (Promise.allSettled), and no fabricated/zero/negative value is
// ever substituted for a failed or invalid upstream response.
//
// PRIVACY: coordinates supplied by the caller exist only for the duration
// of a single request (or a short in-memory cache entry keyed by rounded
// coordinates, held by index.ts) — never logged, never written to any
// store, and never returned to the browser. Only the sanitized district/
// city/displayName strings are returned.

const FETCH_TIMEOUT_MS = 8000;
const OUNCE_TO_GRAM = 31.1034768;
const FALLBACK_LATITUDE = 41.0082;
const FALLBACK_LONGITUDE = 28.9784;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationLabel {
  district: string | null;
  city: string | null;
  displayName: string;
}

export interface CurrencyRate {
  usdTry: number;
  usdTryPreviousClose: number | null;
  eurTry: number;
  eurTryPreviousClose: number | null;
  rateDate: string;
  source: string;
}

export interface GoldRate {
  gramTry: number | null;
  gramTryPreviousClose: number | null;
  updatedAt: string;
  source: string;
}

export type MarketInstrument = "usdTry" | "eurTry" | "gramTry";

/** Backs the day-over-day change shown in each FX/gold tile's <small> slot.
 * Implementations must never throw for a missing history row — return
 * `null` from getPreviousClose instead — since a history lookup/write
 * failure must never take down the rate itself. */
export interface MarketHistoryRepository {
  getPreviousClose(instrument: MarketInstrument, beforeDateIso: string): Promise<number | null>;
  recordClose(instrument: MarketInstrument, dateIso: string, value: number, source: string): Promise<void>;
}

export const noopHistoryRepository: MarketHistoryRepository = {
  getPreviousClose: async () => null,
  recordClose: async () => {},
};

export interface WeatherInfo {
  temperatureC: number;
  apparentTemperatureC: number;
  weatherCode: number;
  condition: string;
  isDay: boolean;
  location: string;
  updatedAt: string;
  source: string;
}

export interface MarketDataResponse {
  currency: CurrencyRate | null;
  gold: GoldRate;
  weather: WeatherInfo | null;
  fetchedAt: string;
  errors: {
    currency: string | null;
    gold: string | null;
    weather: string | null;
  };
}

export interface MarketDataDeps {
  fetchImpl: typeof fetch;
  now: () => Date;
  goldApiKey: string | null;
  weatherApiKey: string | null;
  coordinates: Coordinates | null;
  history: MarketHistoryRepository;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

/** ~1.1km precision — enough for district-level weather/geocoding, coarse
 * enough that it is not a precise/persistable location, and used as the
 * geocoding cache key so nearby requests share one lookup. */
export function roundCoordinate(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Calendar date (Europe/Istanbul) used as the history table's rate_date —
 * matches the en-CA-locale-as-YYYY-MM-DD convention already used on the
 * frontend (see checkDomain.ts's istanbulTodayIso). */
function istanbulDateIso(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}

/** A history lookup failure degrades to "no change shown" (previousClose:
 * null) rather than ever failing the rate/gold fetch itself. */
async function getPreviousCloseSafe(deps: MarketDataDeps, instrument: MarketInstrument, todayIso: string): Promise<number | null> {
  try {
    return await deps.history.getPreviousClose(instrument, todayIso);
  } catch {
    return null;
  }
}

/** A history write failure is swallowed — persisting today's close is a
 * best-effort enhancement for tomorrow's change display, never a
 * requirement for today's response. */
async function recordCloseSafe(deps: MarketDataDeps, instrument: MarketInstrument, todayIso: string, value: number, source: string): Promise<void> {
  try {
    await deps.history.recordClose(instrument, todayIso, value, source);
  } catch {
    // best-effort by design — see doc comment above
  }
}

async function fetchJson(fetchImpl: typeof fetch, url: string, headers?: Record<string, string>): Promise<unknown> {
  const response = await fetchImpl(url, {
    method: "GET",
    headers,
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    throw new Error(`upstream HTTP ${response.status}`);
  }
  if (!contentType.includes("application/json")) {
    throw new Error("unexpected content type");
  }
  return response.json();
}

async function fetchFrankfurterRate(fetchImpl: typeof fetch, base: "USD" | "EUR"): Promise<{ rate: number; date: string }> {
  // The v2/rate/{base}/{quote} endpoint returns a flat object —
  // {"date","base","quote","rate"} — not the nested {rates:{TRY:...}}
  // shape of the older /latest endpoint. Confirmed against the live API.
  const payload = await fetchJson(
    fetchImpl,
    `https://api.frankfurter.dev/v2/rate/${base}/TRY?providers=TCMB`,
  );
  if (typeof payload !== "object" || payload === null) throw new Error("malformed currency response");
  const record = payload as Record<string, unknown>;
  const rate = record.rate;
  const date = record.date;
  if (!isPositiveFiniteNumber(rate)) throw new Error("invalid rate value");
  if (typeof date !== "string" || Number.isNaN(Date.parse(date))) throw new Error("invalid rate date");
  return { rate, date };
}

export async function fetchCurrency(deps: MarketDataDeps): Promise<CurrencyRate> {
  const [usd, eur] = await Promise.all([
    fetchFrankfurterRate(deps.fetchImpl, "USD"),
    fetchFrankfurterRate(deps.fetchImpl, "EUR"),
  ]);
  const todayIso = istanbulDateIso(deps.now());
  const [usdTryPreviousClose, eurTryPreviousClose] = await Promise.all([
    getPreviousCloseSafe(deps, "usdTry", todayIso),
    getPreviousCloseSafe(deps, "eurTry", todayIso),
  ]);
  await Promise.all([
    recordCloseSafe(deps, "usdTry", todayIso, usd.rate, "TCMB"),
    recordCloseSafe(deps, "eurTry", todayIso, eur.rate, "TCMB"),
  ]);
  return {
    usdTry: usd.rate,
    usdTryPreviousClose,
    eurTry: eur.rate,
    eurTryPreviousClose,
    rateDate: usd.date,
    source: "TCMB",
  };
}

/** Reverse-geocodes rounded coordinates to a district/city label via
 * Nominatim. Returns only sanitized fields — never street, building,
 * postcode, or the provider's full `display_name` address string. Any
 * failure (network, malformed body, no usable address fields) resolves to
 * "Konumunuz" rather than throwing, since a location label is a display
 * nicety and must never take down the weather card. */
export async function reverseGeocode(deps: MarketDataDeps, coordinates: Coordinates): Promise<LocationLabel> {
  const lat = roundCoordinate(coordinates.latitude);
  const lon = roundCoordinate(coordinates.longitude);
  try {
    const payload = await fetchJson(
      deps.fetchImpl,
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=14&addressdetails=1&accept-language=tr`,
      { "User-Agent": "dayandisli-erp-dashboard/1.0 (internal ERP dashboard weather widget)" },
    );
    if (typeof payload !== "object" || payload === null) throw new Error("malformed geocoding response");
    const address = (payload as Record<string, unknown>).address;
    if (typeof address !== "object" || address === null) throw new Error("missing address block");
    const a = address as Record<string, unknown>;

    const district = pickString(a.town) ?? pickString(a.city_district) ?? pickString(a.county) ?? pickString(a.suburb);
    const city = pickString(a.city) ?? pickString(a.province) ?? pickString(a.state);

    if (district && city) return { district, city, displayName: `${district}, ${city}` };
    if (city) return { district: null, city, displayName: city };
    return { district: null, city: null, displayName: "Konumunuz" };
  } catch {
    return { district: null, city: null, displayName: "Konumunuz" };
  }
}

/** Tomorrow.io's realtime endpoint (this plan/field set) does not return a
 * sunrise/sunset or is-day field, so day/night is derived from `uvIndex`
 * (0 at night, positive during daylight) — a standard, documented proxy,
 * not a guess: confirmed live (uvIndex=6 at 11:04 local Istanbul time). */
export async function fetchWeather(deps: MarketDataDeps): Promise<WeatherInfo> {
  if (!deps.weatherApiKey) {
    throw new Error("missing_credential");
  }

  const usingFallback = deps.coordinates === null;
  const latitude = usingFallback ? FALLBACK_LATITUDE : roundCoordinate(deps.coordinates!.latitude);
  const longitude = usingFallback ? FALLBACK_LONGITUDE : roundCoordinate(deps.coordinates!.longitude);

  const [payload, locationLabel] = await Promise.all([
    fetchJson(
      deps.fetchImpl,
      "https://api.tomorrow.io/v4/weather/realtime" +
        `?location=${latitude},${longitude}` +
        "&units=metric" +
        "&fields=temperature,temperatureApparent,weatherCode,uvIndex" +
        `&apikey=${encodeURIComponent(deps.weatherApiKey)}`,
    ),
    // Fixed fallback coordinates never trigger reverse geocoding — the
    // display name is always the plain city name in that case.
    usingFallback
      ? Promise.resolve<LocationLabel>({ district: null, city: "İstanbul", displayName: "İstanbul" })
      : reverseGeocode(deps, { latitude, longitude }),
  ]);

  if (typeof payload !== "object" || payload === null) throw new Error("malformed weather response");
  const data = (payload as Record<string, unknown>).data;
  if (typeof data !== "object" || data === null) throw new Error("missing data block");
  const values = (data as Record<string, unknown>).values;
  if (typeof values !== "object" || values === null) throw new Error("missing values block");
  const v = values as Record<string, unknown>;

  const temperatureC = v.temperature;
  const apparentTemperatureC = v.temperatureApparent;
  const weatherCode = v.weatherCode;
  const uvIndex = v.uvIndex;

  if (!isFiniteNumber(temperatureC)) throw new Error("invalid temperature");
  if (!isFiniteNumber(apparentTemperatureC)) throw new Error("invalid apparent temperature");
  if (!isFiniteNumber(weatherCode) || !Number.isInteger(weatherCode)) throw new Error("invalid weather code");
  if (!isFiniteNumber(uvIndex)) throw new Error("invalid uvIndex");

  return {
    temperatureC,
    apparentTemperatureC,
    weatherCode,
    condition: mapWeatherCodeToTurkish(weatherCode),
    isDay: uvIndex > 0,
    location: locationLabel.displayName,
    updatedAt: deps.now().toISOString(),
    source: "Tomorrow.io",
  };
}

/** Tomorrow.io weather codes (docs.tomorrow.io/reference/data-layers-weather-codes). */
export function mapWeatherCodeToTurkish(code: number): string {
  if (code === 1000 || code === 1100) return "Açık";
  if (code === 1101) return "Parçalı bulutlu";
  if (code === 1102 || code === 1001) return "Bulutlu";
  if (code === 2000 || code === 2100) return "Sisli";
  if (code === 4000 || code === 6000) return "Çisenti";
  if (code === 4001 || code === 4200 || code === 6001 || code === 6200) return "Yağmurlu";
  if (code === 4201 || code === 6201) return "Sağanak";
  if (code === 5000 || code === 5001 || code === 5100 || code === 5101 || code === 7000 || code === 7101 || code === 7102) return "Karlı";
  if (code === 8000) return "Gök gürültülü";
  return "Bulutlu";
}

/** MetalpriceAPI's /v1/latest returns HTTP 200 even on failure — the only
 * reliable signal is the `success` field, never response.ok alone. With
 * base=XAU&currencies=TRY, `rates.TRY` is the TRY price of one troy ounce
 * of gold (documented pattern: "1 <base> = rates.<quote> <quote>"). */
export async function fetchGold(deps: MarketDataDeps): Promise<GoldRate> {
  if (!deps.goldApiKey) {
    throw new Error("missing_credential");
  }
  const payload = await fetchJson(
    deps.fetchImpl,
    `https://api.metalpriceapi.com/v1/latest?api_key=${encodeURIComponent(deps.goldApiKey)}&base=XAU&currencies=TRY`,
  );
  if (typeof payload !== "object" || payload === null) throw new Error("malformed gold response");
  const record = payload as Record<string, unknown>;
  if (record.success !== true) throw new Error("gold provider reported failure");

  const rates = record.rates as Record<string, unknown> | undefined;
  const ouncePriceTry = rates?.TRY;
  if (!isPositiveFiniteNumber(ouncePriceTry)) throw new Error("invalid gold price");

  const gramTry = ouncePriceTry / OUNCE_TO_GRAM;
  const todayIso = istanbulDateIso(deps.now());
  const gramTryPreviousClose = await getPreviousCloseSafe(deps, "gramTry", todayIso);
  await recordCloseSafe(deps, "gramTry", todayIso, gramTry, "metalpriceapi.com");

  return {
    gramTry,
    gramTryPreviousClose,
    updatedAt: deps.now().toISOString(),
    source: "metalpriceapi.com",
  };
}

export async function buildMarketDataResponse(deps: MarketDataDeps): Promise<MarketDataResponse> {
  const [currencyResult, goldResult, weatherResult] = await Promise.allSettled([
    fetchCurrency(deps),
    fetchGold(deps),
    fetchWeather(deps),
  ]);

  const currency = currencyResult.status === "fulfilled" ? currencyResult.value : null;
  const weather = weatherResult.status === "fulfilled" ? weatherResult.value : null;
  const gold: GoldRate =
    goldResult.status === "fulfilled"
      ? goldResult.value
      : { gramTry: null, gramTryPreviousClose: null, updatedAt: deps.now().toISOString(), source: "metalpriceapi.com" };

  const missingCredential = (result: PromiseSettledResult<unknown>) =>
    result.status === "rejected" && result.reason instanceof Error && result.reason.message === "missing_credential";

  return {
    currency,
    gold,
    weather,
    fetchedAt: deps.now().toISOString(),
    errors: {
      currency: currencyResult.status === "rejected" ? "unavailable" : null,
      gold: goldResult.status === "rejected" ? (missingCredential(goldResult) ? "missing_credential" : "unavailable") : null,
      weather: weatherResult.status === "rejected" ? (missingCredential(weatherResult) ? "missing_credential" : "unavailable") : null,
    },
  };
}
