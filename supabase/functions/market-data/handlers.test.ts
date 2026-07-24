import { describe, expect, it, vi } from "vitest";
import {
  buildMarketDataResponse,
  fetchCurrency,
  fetchGold,
  fetchWeather,
  mapWeatherCodeToTurkish,
  type MarketDataDeps,
} from "./handlers";

const NOW = new Date("2026-07-24T04:15:00.000Z");

function jsonResponse(body: unknown, opts: { ok?: boolean; status?: number; contentType?: string } = {}) {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: new Headers({ "content-type": opts.contentType ?? "application/json" }),
    json: async () => body,
  } as Response;
}

function deps(overrides: Partial<MarketDataDeps> = {}): MarketDataDeps {
  return {
    fetchImpl: vi.fn(),
    now: () => NOW,
    goldApiKey: "test-key",
    ...overrides,
  };
}

// Matches the real api.frankfurter.dev v2/rate/{base}/TRY response shape
// (flat, not nested under `rates`) — confirmed against the live API.
const USD_TCMB = { date: "2026-07-24", base: "USD", quote: "TRY", rate: 47.23 };
const EUR_TCMB = { date: "2026-07-24", base: "EUR", quote: "TRY", rate: 53.9 };
const WEATHER_OK = {
  current: {
    time: "2026-07-24T04:15",
    temperature_2m: 29,
    apparent_temperature: 31.2,
    weather_code: 0,
    is_day: 1,
    relative_humidity_2m: 55,
    wind_speed_10m: 12,
  },
};
const GOLD_OK = { price: 3200, price_gram_24k: 4850.32, currency: "TRY" };

describe("fetchCurrency", () => {
  it("returns a valid TCMB USD/TRY and EUR/TRY pair", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(USD_TCMB))
      .mockResolvedValueOnce(jsonResponse(EUR_TCMB));
    const result = await fetchCurrency(deps({ fetchImpl }));
    expect(result).toEqual({ usdTry: 47.23, eurTry: 53.9, rateDate: "2026-07-24", source: "TCMB" });
  });

  it("rejects a malformed currency response (missing rate)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ base: "USD", date: "2026-07-24" }));
    await expect(fetchCurrency(deps({ fetchImpl }))).rejects.toThrow();
  });

  it("rejects a non-positive rate value", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ date: "2026-07-24", rate: 0 }));
    await expect(fetchCurrency(deps({ fetchImpl }))).rejects.toThrow();
  });

  it("rejects an unexpected content type", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(USD_TCMB, { contentType: "text/html" }));
    await expect(fetchCurrency(deps({ fetchImpl }))).rejects.toThrow(/content type/);
  });
});

describe("fetchWeather", () => {
  it("returns valid Istanbul weather", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(WEATHER_OK));
    const result = await fetchWeather(deps({ fetchImpl }));
    expect(result).toEqual({
      temperatureC: 29,
      apparentTemperatureC: 31.2,
      weatherCode: 0,
      condition: "Açık",
      isDay: true,
      location: "İstanbul",
      updatedAt: NOW.toISOString(),
      source: "Open-Meteo",
    });
  });

  it("rejects a response missing the current block", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
    await expect(fetchWeather(deps({ fetchImpl }))).rejects.toThrow();
  });
});

describe("mapWeatherCodeToTurkish", () => {
  it.each([
    [0, "Açık"],
    [1, "Parçalı bulutlu"],
    [2, "Parçalı bulutlu"],
    [3, "Bulutlu"],
    [45, "Sisli"],
    [51, "Çisenti"],
    [61, "Yağmurlu"],
    [80, "Yağmurlu"],
    [82, "Sağanak"],
    [71, "Karlı"],
    [95, "Gök gürültülü"],
  ])("maps code %i to %s", (code, expected) => {
    expect(mapWeatherCodeToTurkish(code)).toBe(expected);
  });
});

describe("fetchGold", () => {
  it("returns the gram-24k price directly when present", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(GOLD_OK));
    const result = await fetchGold(deps({ fetchImpl }));
    expect(result).toEqual({ gramTry: 4850.32, updatedAt: NOW.toISOString(), source: "goldapi.io" });
  });

  it("falls back to ounce/31.1034768 when price_gram_24k is absent", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ price: 3200 }));
    const result = await fetchGold(deps({ fetchImpl }));
    expect(result.gramTry).toBeCloseTo(3200 / 31.1034768, 6);
  });

  it("throws missing_credential when no GOLD_API_KEY is configured, without calling fetch", async () => {
    const fetchImpl = vi.fn();
    await expect(fetchGold(deps({ fetchImpl, goldApiKey: null }))).rejects.toThrow("missing_credential");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a non-positive gold price", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ price: -1, price_gram_24k: 0 }));
    await expect(fetchGold(deps({ fetchImpl }))).rejects.toThrow();
  });
});

describe("buildMarketDataResponse (failure isolation)", () => {
  it("returns all three sections when every provider succeeds", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(USD_TCMB))
      .mockResolvedValueOnce(jsonResponse(EUR_TCMB))
      .mockResolvedValueOnce(jsonResponse(GOLD_OK))
      .mockResolvedValueOnce(jsonResponse(WEATHER_OK));
    const result = await buildMarketDataResponse(deps({ fetchImpl }));
    expect(result.currency).not.toBeNull();
    expect(result.gold.gramTry).toBe(4850.32);
    expect(result.weather).not.toBeNull();
    expect(result.errors).toEqual({ currency: null, gold: null, weather: null });
  });

  it("keeps currency and weather valid when gold fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(USD_TCMB))
      .mockResolvedValueOnce(jsonResponse(EUR_TCMB))
      .mockResolvedValueOnce(jsonResponse(WEATHER_OK));
    const result = await buildMarketDataResponse(deps({ fetchImpl, goldApiKey: null }));
    expect(result.currency).not.toBeNull();
    expect(result.weather).not.toBeNull();
    expect(result.gold.gramTry).toBeNull();
    expect(result.errors.gold).toBe("missing_credential");
  });

  it("keeps currency and gold valid when weather fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(USD_TCMB))
      .mockResolvedValueOnce(jsonResponse(EUR_TCMB))
      .mockResolvedValueOnce(jsonResponse(GOLD_OK))
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 500 }));
    const result = await buildMarketDataResponse(deps({ fetchImpl }));
    expect(result.currency).not.toBeNull();
    expect(result.gold.gramTry).toBe(4850.32);
    expect(result.weather).toBeNull();
    expect(result.errors.weather).toBe("unavailable");
  });

  it("isolates a partial failure (currency down, gold and weather fine)", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, { ok: false, status: 503 }))
      .mockResolvedValueOnce(jsonResponse(EUR_TCMB))
      .mockResolvedValueOnce(jsonResponse(GOLD_OK))
      .mockResolvedValueOnce(jsonResponse(WEATHER_OK));
    const result = await buildMarketDataResponse(deps({ fetchImpl }));
    expect(result.currency).toBeNull();
    expect(result.errors.currency).toBe("unavailable");
    expect(result.gold.gramTry).toBe(4850.32);
    expect(result.weather).not.toBeNull();
  });

  it("returns a fully degraded-but-non-throwing response when every provider fails", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 500 }));
    const result = await buildMarketDataResponse(deps({ fetchImpl, goldApiKey: null }));
    expect(result.currency).toBeNull();
    expect(result.weather).toBeNull();
    expect(result.gold.gramTry).toBeNull();
    expect(result.errors).toEqual({ currency: "unavailable", gold: "missing_credential", weather: "unavailable" });
    expect(result.fetchedAt).toBe(NOW.toISOString());
  });
});
