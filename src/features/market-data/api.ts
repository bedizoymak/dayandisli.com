import { supabase } from "@/integrations/supabase/client";
import type { CurrencyRate, GoldRate, MarketDataResponse, WeatherInfo } from "./types";

const GEOLOCATION_TIMEOUT_MS = 5000;

/** Best-effort browser geolocation — resolves to `null` (never rejects) on
 * denial, timeout, an unsupported browser, or a non-browser environment
 * (tests/SSR), so the caller always falls back to the fixed Istanbul
 * coordinates rather than blocking or erroring. Coordinates are used only
 * to build this one request's query string — never stored, never logged. */
function getBrowserCoordinates(): Promise<{ latitude: number; longitude: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      () => resolve(null),
      { timeout: GEOLOCATION_TIMEOUT_MS, maximumAge: 10 * 60_000 },
    );
  });
}

/** No demo/hardcoded fallback here by design — a failed or malformed response
 * from the market-data edge function must surface as "unavailable" in the
 * UI, never a fabricated rate or temperature. */
export async function fetchMarketData(): Promise<MarketDataResponse> {
  const coordinates = await getBrowserCoordinates();
  // supabase-js has no dedicated query-param option for `invoke`; embedding
  // the query string directly in the function name is the documented
  // community workaround (functions-js constructs the URL by simple
  // concatenation, so this reaches the edge function's `req.url` intact).
  const functionName = coordinates ? `market-data?lat=${coordinates.latitude}&lon=${coordinates.longitude}` : "market-data";
  const { data, error } = await supabase.functions.invoke(functionName, { method: "GET" });
  if (error) {
    const message = (error as { message?: string })?.message ?? "Piyasa verisi alınamadı.";
    throw new Error(message);
  }
  return validateMarketDataPayload(data);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0;
}

function isValidIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

/** A missing previousClose field (older payload shape) or an explicit
 * `null` both mean "no change to show" — only a present-but-malformed
 * value is treated as an error. */
function validatePreviousClose(value: unknown, fieldName: string): number | null {
  if (value === null || value === undefined) return null;
  if (!isPositiveFiniteNumber(value)) throw new Error(`Piyasa verisi geçersiz: ${fieldName}.`);
  return value;
}

function validateCurrency(candidate: unknown): CurrencyRate | null {
  if (candidate === null) return null;
  if (typeof candidate !== "object") throw new Error("Piyasa verisi geçersiz: currency.");
  const record = candidate as Record<string, unknown>;
  if (!isPositiveFiniteNumber(record.usdTry)) throw new Error("Piyasa verisi geçersiz: usdTry.");
  if (!isPositiveFiniteNumber(record.eurTry)) throw new Error("Piyasa verisi geçersiz: eurTry.");
  if (typeof record.rateDate !== "string" || !record.rateDate) throw new Error("Piyasa verisi geçersiz: rateDate.");
  if (typeof record.source !== "string" || !record.source) throw new Error("Piyasa verisi geçersiz: currency source.");
  return {
    usdTry: record.usdTry,
    usdTryPreviousClose: validatePreviousClose(record.usdTryPreviousClose, "usdTryPreviousClose"),
    eurTry: record.eurTry,
    eurTryPreviousClose: validatePreviousClose(record.eurTryPreviousClose, "eurTryPreviousClose"),
    rateDate: record.rateDate,
    source: record.source,
  };
}

function validateGold(candidate: unknown): GoldRate {
  if (typeof candidate !== "object" || candidate === null) throw new Error("Piyasa verisi geçersiz: gold.");
  const record = candidate as Record<string, unknown>;
  const gramTry = record.gramTry;
  if (gramTry !== null && !isPositiveFiniteNumber(gramTry)) throw new Error("Piyasa verisi geçersiz: goldGramTry.");
  if (!isValidIsoTimestamp(record.updatedAt)) throw new Error("Piyasa verisi geçersiz: gold updatedAt.");
  if (typeof record.source !== "string" || !record.source) throw new Error("Piyasa verisi geçersiz: gold source.");
  return {
    gramTry: gramTry as number | null,
    gramTryPreviousClose: validatePreviousClose(record.gramTryPreviousClose, "gramTryPreviousClose"),
    updatedAt: record.updatedAt as string,
    source: record.source,
  };
}

function validateWeather(candidate: unknown): WeatherInfo | null {
  if (candidate === null) return null;
  if (typeof candidate !== "object") throw new Error("Piyasa verisi geçersiz: weather.");
  const record = candidate as Record<string, unknown>;
  if (!isFiniteNumber(record.temperatureC)) throw new Error("Piyasa verisi geçersiz: temperatureC.");
  if (!isFiniteNumber(record.apparentTemperatureC)) throw new Error("Piyasa verisi geçersiz: apparentTemperatureC.");
  if (!isFiniteNumber(record.weatherCode)) throw new Error("Piyasa verisi geçersiz: weatherCode.");
  if (typeof record.condition !== "string" || !record.condition) throw new Error("Piyasa verisi geçersiz: condition.");
  if (typeof record.isDay !== "boolean") throw new Error("Piyasa verisi geçersiz: isDay.");
  if (typeof record.location !== "string" || !record.location) throw new Error("Piyasa verisi geçersiz: location.");
  if (!isValidIsoTimestamp(record.updatedAt)) throw new Error("Piyasa verisi geçersiz: weather updatedAt.");
  if (typeof record.source !== "string" || !record.source) throw new Error("Piyasa verisi geçersiz: weather source.");
  return {
    temperatureC: record.temperatureC,
    apparentTemperatureC: record.apparentTemperatureC,
    weatherCode: record.weatherCode,
    condition: record.condition,
    isDay: record.isDay,
    location: record.location,
    updatedAt: record.updatedAt as string,
    source: record.source,
  };
}

function validateMarketDataPayload(payload: unknown): MarketDataResponse {
  if (typeof payload !== "object" || payload === null) {
    throw new Error("Piyasa verisi geçersiz.");
  }
  const candidate = payload as Record<string, unknown>;
  if (!isValidIsoTimestamp(candidate.fetchedAt)) throw new Error("Piyasa verisi geçersiz: fetchedAt.");
  const errors = candidate.errors as Record<string, unknown> | undefined;

  return {
    currency: validateCurrency(candidate.currency),
    gold: validateGold(candidate.gold),
    weather: validateWeather(candidate.weather),
    fetchedAt: candidate.fetchedAt as string,
    errors: {
      currency: typeof errors?.currency === "string" ? errors.currency : null,
      gold: typeof errors?.gold === "string" ? errors.gold : null,
      weather: typeof errors?.weather === "string" ? errors.weather : null,
    },
  };
}
