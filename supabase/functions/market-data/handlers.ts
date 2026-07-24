// Pure aggregation logic for the market-data edge function — no Deno-specific
// imports, so it can be unit-tested directly with Vitest (see
// handlers.test.ts) exactly like supabase/functions/parasut-api/handlers.ts.
//
// Providers:
//  - Currency: Frankfurter (api.frankfurter.dev), TCMB indicative rates.
//  - Weather: Open-Meteo, Istanbul coordinates.
//  - Gold: MetalpriceAPI (https://api.metalpriceapi.com/v1/latest,
//    base=XAU&currencies=TRY&api_key=..., ounce price converted to grams).
//
// Every provider call is isolated: one provider failing never blocks the
// others (Promise.allSettled), and no fabricated/zero/negative value is
// ever substituted for a failed or invalid upstream response.

const FETCH_TIMEOUT_MS = 8000;
const OUNCE_TO_GRAM = 31.1034768;

export interface CurrencyRate {
  usdTry: number;
  eurTry: number;
  rateDate: string;
  source: string;
}

export interface GoldRate {
  gramTry: number | null;
  updatedAt: string;
  source: string;
}

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
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
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
  return {
    usdTry: usd.rate,
    eurTry: eur.rate,
    rateDate: usd.date,
    source: "TCMB",
  };
}

export async function fetchWeather(deps: MarketDataDeps): Promise<WeatherInfo> {
  const payload = await fetchJson(
    deps.fetchImpl,
    "https://api.open-meteo.com/v1/forecast?latitude=41.0082&longitude=28.9784&current=temperature_2m,apparent_temperature,weather_code,is_day,relative_humidity_2m,wind_speed_10m&timezone=Europe%2FIstanbul",
  );
  if (typeof payload !== "object" || payload === null) throw new Error("malformed weather response");
  const current = (payload as Record<string, unknown>).current;
  if (typeof current !== "object" || current === null) throw new Error("missing current weather block");
  const c = current as Record<string, unknown>;

  const temperatureC = c.temperature_2m;
  const apparentTemperatureC = c.apparent_temperature;
  const weatherCode = c.weather_code;
  const isDayRaw = c.is_day;

  if (!isFiniteNumber(temperatureC)) throw new Error("invalid temperature");
  if (!isFiniteNumber(apparentTemperatureC)) throw new Error("invalid apparent temperature");
  if (!isFiniteNumber(weatherCode) || !Number.isInteger(weatherCode)) throw new Error("invalid weather code");
  if (isDayRaw !== 0 && isDayRaw !== 1) throw new Error("invalid is_day flag");

  return {
    temperatureC,
    apparentTemperatureC,
    weatherCode,
    condition: mapWeatherCodeToTurkish(weatherCode),
    isDay: isDayRaw === 1,
    location: "İstanbul",
    updatedAt: deps.now().toISOString(),
    source: "Open-Meteo",
  };
}

/** WMO weather codes as used by Open-Meteo. */
export function mapWeatherCodeToTurkish(code: number): string {
  if (code === 0) return "Açık";
  if (code === 1 || code === 2) return "Parçalı bulutlu";
  if (code === 3) return "Bulutlu";
  if (code === 45 || code === 48) return "Sisli";
  if (code >= 51 && code <= 57) return "Çisenti";
  if ((code >= 61 && code <= 67) || code === 80 || code === 81) return "Yağmurlu";
  if (code === 82) return "Sağanak";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "Karlı";
  if (code >= 95 && code <= 99) return "Gök gürültülü";
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

  return {
    gramTry: ouncePriceTry / OUNCE_TO_GRAM,
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
      : { gramTry: null, updatedAt: deps.now().toISOString(), source: "metalpriceapi.com" };

  const goldErrorMessage =
    goldResult.status === "rejected"
      ? goldResult.reason instanceof Error && goldResult.reason.message === "missing_credential"
        ? "missing_credential"
        : "unavailable"
      : null;

  return {
    currency,
    gold,
    weather,
    fetchedAt: deps.now().toISOString(),
    errors: {
      currency: currencyResult.status === "rejected" ? "unavailable" : null,
      gold: goldErrorMessage,
      weather: weatherResult.status === "rejected" ? "unavailable" : null,
    },
  };
}
