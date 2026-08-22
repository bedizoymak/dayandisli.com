// Pure aggregation logic for the market-data edge function — no Deno-specific
// imports, so it can be unit-tested directly with Vitest (see
// handlers.test.ts) exactly like supabase/functions/parasut-api/handlers.ts.
//
// Providers:
//  - Currency: Frankfurter (api.frankfurter.dev), TCMB indicative rates.
//  - Weather: Tomorrow.io realtime weather, at the caller's coordinates
//    (fixed Istanbul coordinates when none are supplied).
//  - Gold/metals: MetalpriceAPI (https://api.metalpriceapi.com/v1/latest,
//    base=USD&currencies=EUR,XAU,XAG&api_key=...). This shape returns
//    EUR/XAU/XAG *per 1 USD* (not TRY directly), so the gram/TRY gold price
//    is derived by combining it with the USD/TRY rate from fetchCurrency —
//    see fetchGold below. MetalpriceAPI calls are rate-limited to at most
//    once per 8 hours and 99/month via a Postgres-backed claim (see
//    MetalPriceCacheRepository / metalprice_api_state migration) so the
//    quota is shared globally across every caller and edge function
//    instance, and survives cold starts/restarts.
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

/** Raw MetalpriceAPI /v1/latest rates with base=USD — each field is the
 * amount of that currency/metal equal to 1 USD (documented pattern: "1
 * <base> = rates.<quote> <quote>"). EUR/XAG are fetched (required by the
 * single combined request) but only XAU currently feeds the gold/TRY card. */
export interface MetalRates {
  eurPerUsd: number;
  xauPerUsd: number;
  xagPerUsd: number;
}

export interface MetalPriceClaim {
  /** true if this call won the right to hit MetalpriceAPI right now (8h
   * elapsed, monthly cap not reached, no other request currently in
   * flight). false means "reuse cachedRates" — never treat it as an error. */
  claimed: boolean;
  cachedRates: MetalRates | null;
}

/** Backs the 8-hour/99-per-month MetalpriceAPI rate limit. Must be a
 * globally shared, persistent, race-safe store (see
 * supabase/migrations/20260822100000_metalprice_api_state.sql) — an
 * in-memory cache would neither survive a cold start nor coordinate across
 * concurrent edge function instances. */
export interface MetalPriceCacheRepository {
  claimRefresh(now: Date): Promise<MetalPriceClaim>;
  recordResult(now: Date, success: boolean, rates: MetalRates | null, errorMessage: string | null): Promise<void>;
}

/** Fails closed (claimed: false, no cached rates) rather than open — without
 * a working persistent store there is no way to safely enforce the monthly
 * cap, and the cap is a hard requirement ("must NEVER exceed 99 calls"), so
 * degrading to "call anyway" is not an acceptable fallback here (unlike
 * noopHistoryRepository, where the worst case is just no previous-close
 * shown). In practice this path is unreachable in production, since
 * SUPABASE_SERVICE_ROLE_KEY is auto-provisioned for every edge function. */
export const noopMetalPriceCacheRepository: MetalPriceCacheRepository = {
  claimRefresh: async () => ({ claimed: false, cachedRates: null }),
  recordResult: async () => {},
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
  metalPriceCache: MetalPriceCacheRepository;
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
 * base=USD&currencies=EUR,XAU,XAG, each `rates.<X>` is the amount of that
 * currency/metal equal to 1 USD (documented pattern: "1 <base> = rates.<quote>
 * <quote>") — the actual HTTP call, made only when fetchMetalRates has
 * already won a claim (see below). Never called more than once per claim. */
async function fetchMetalRatesFromProvider(deps: MarketDataDeps): Promise<MetalRates> {
  const payload = await fetchJson(
    deps.fetchImpl,
    `https://api.metalpriceapi.com/v1/latest?api_key=${encodeURIComponent(deps.goldApiKey!)}&base=USD&currencies=EUR,XAU,XAG`,
  );
  if (typeof payload !== "object" || payload === null) throw new Error("malformed metal price response");
  const record = payload as Record<string, unknown>;
  if (record.success !== true) throw new Error("metal price provider reported failure: " + JSON.stringify(record.error ?? record));

  const rates = record.rates as Record<string, unknown> | undefined;
  const eurPerUsd = rates?.EUR;
  const xauPerUsd = rates?.XAU;
  const xagPerUsd = rates?.XAG;
  if (!isPositiveFiniteNumber(eurPerUsd)) throw new Error("invalid EUR rate");
  if (!isPositiveFiniteNumber(xauPerUsd)) throw new Error("invalid XAU rate");
  if (!isPositiveFiniteNumber(xagPerUsd)) throw new Error("invalid XAG rate");

  return { eurPerUsd, xauPerUsd, xagPerUsd };
}

/** Enforces the 8-hour/99-per-month MetalpriceAPI call budget via the
 * shared Postgres claim (see MetalPriceCacheRepository). Only actually
 * calls the provider when claimRefresh() grants the claim; otherwise reuses
 * the last successfully cached rates. A failed provider call also falls
 * back to the last cached rates rather than failing the whole request, same
 * as every other provider in this file — only throws when there is truly
 * no cached data to fall back to (e.g. the very first call ever fails). */
export async function fetchMetalRates(deps: MarketDataDeps): Promise<MetalRates> {
  if (!deps.goldApiKey) {
    throw new Error("missing_credential");
  }

  const claim = await deps.metalPriceCache.claimRefresh(deps.now());
  if (!claim.claimed) {
    if (claim.cachedRates) return claim.cachedRates;
    throw new Error("metal price unavailable: no cached rates yet and refresh not due");
  }

  try {
    const rates = await fetchMetalRatesFromProvider(deps);
    await deps.metalPriceCache.recordResult(deps.now(), true, rates, null);
    return rates;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await deps.metalPriceCache.recordResult(deps.now(), false, null, message);
    if (claim.cachedRates) return claim.cachedRates;
    throw error;
  }
}

/** Converts MetalpriceAPI's USD-relative XAU rate into a TRY gram price:
 * rates.XAU is XAU per 1 USD, so 1/rates.XAU is USD per troy ounce; dividing
 * by OUNCE_TO_GRAM and multiplying by the caller-supplied USD/TRY rate
 * preserves the exact same gram-conversion math the old direct
 * base=XAU&currencies=TRY response used — only the sourcing of "ounce price
 * in TRY" changed, since the new required request shape has no TRY quote. */
export async function fetchGold(deps: MarketDataDeps, usdTry: number): Promise<GoldRate> {
  const metalRates = await fetchMetalRates(deps);
  const ouncePriceUsd = 1 / metalRates.xauPerUsd;
  const gramTry = (ouncePriceUsd / OUNCE_TO_GRAM) * usdTry;

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

function isMissingCredential(result: PromiseSettledResult<unknown>): boolean {
  return result.status === "rejected" && result.reason instanceof Error && result.reason.message === "missing_credential";
}

export interface RatesData {
  currency: CurrencyRate | null;
  gold: GoldRate;
  errors: { currency: string | null; gold: string | null };
}

export interface WeatherData {
  weather: WeatherInfo | null;
  errors: { weather: string | null };
}

function isMissingCredentialError(error: unknown): boolean {
  return error instanceof Error && error.message === "missing_credential";
}

/** Currency and gold prices do not depend on the caller's coordinates —
 * split out from weather so index.ts can cache them under one global key
 * shared by every caller, instead of the per-coordinate key weather needs.
 * Previously both were fetched (and cached) together keyed by the caller's
 * rounded coordinates, so every visitor opening the dashboard from a
 * distinct location re-hit MetalpriceAPI instead of sharing the 15-minute
 * cache — this is what was burning through the plan's monthly request
 * allowance well ahead of the TTL alone.
 *
 * Currency is fetched first (not in parallel with gold): fetchGold now
 * needs the resolved USD/TRY rate to convert MetalpriceAPI's USD-relative
 * XAU price into TRY (see fetchGold's doc comment), so a successful
 * currency fetch is a prerequisite for gold — a new coupling forced by the
 * required base=USD&currencies=EUR,XAU,XAG request shape, which carries no
 * TRY quote the way the old base=XAU&currencies=TRY shape did. */
export async function fetchRatesData(deps: MarketDataDeps): Promise<RatesData> {
  let currency: CurrencyRate | null = null;
  let currencyError: string | null = null;
  try {
    currency = await fetchCurrency(deps);
  } catch (error) {
    // Server-side only (Supabase function logs) — never included in the
    // response body, so this never reaches the browser or leaks a
    // credential. The client only ever sees the categorized
    // "unavailable"/"missing_credential" string in `errors`.
    console.error("[market-data] currency fetch failed:", error);
    currencyError = "unavailable";
  }

  let gold: GoldRate = { gramTry: null, gramTryPreviousClose: null, updatedAt: deps.now().toISOString(), source: "metalpriceapi.com" };
  let goldError: string | null = null;
  if (currency) {
    try {
      gold = await fetchGold(deps, currency.usdTry);
    } catch (error) {
      console.error("[market-data] gold fetch failed:", error);
      goldError = isMissingCredentialError(error) ? "missing_credential" : "unavailable";
    }
  } else {
    goldError = "unavailable";
  }

  return {
    currency,
    gold,
    errors: { currency: currencyError, gold: goldError },
  };
}

export async function fetchWeatherData(deps: MarketDataDeps): Promise<WeatherData> {
  const [weatherResult] = await Promise.allSettled([fetchWeather(deps)]);
  if (weatherResult.status === "rejected") console.error("[market-data] weather fetch failed:", weatherResult.reason);

  return {
    weather: weatherResult.status === "fulfilled" ? weatherResult.value : null,
    errors: {
      weather: weatherResult.status === "rejected" ? (isMissingCredential(weatherResult) ? "missing_credential" : "unavailable") : null,
    },
  };
}

export async function buildMarketDataResponse(deps: MarketDataDeps): Promise<MarketDataResponse> {
  const [rates, weatherData] = await Promise.all([fetchRatesData(deps), fetchWeatherData(deps)]);
  return {
    currency: rates.currency,
    gold: rates.gold,
    weather: weatherData.weather,
    fetchedAt: deps.now().toISOString(),
    errors: {
      currency: rates.errors.currency,
      gold: rates.errors.gold,
      weather: weatherData.errors.weather,
    },
  };
}
