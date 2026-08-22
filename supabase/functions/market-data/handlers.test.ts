import { describe, expect, it, vi } from "vitest";
import {
  buildMarketDataResponse,
  fetchCurrency,
  fetchGold,
  fetchWeather,
  mapWeatherCodeToTurkish,
  reverseGeocode,
  roundCoordinate,
  type MarketDataDeps,
  type MarketHistoryRepository,
} from "./handlers";

const NOW = new Date("2026-07-24T04:15:00.000Z"); // 2026-07-24 07:15 Europe/Istanbul

function jsonResponse(body: unknown, opts: { ok?: boolean; status?: number; contentType?: string } = {}) {
  return {
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    headers: new Headers({ "content-type": opts.contentType ?? "application/json" }),
    json: async () => body,
  } as Response;
}

/** Defaults to "no history available" (previousClose always null, writes
 * are no-ops) so existing tests that don't care about day-over-day change
 * don't need to know about the history repository at all. */
function fakeHistory(overrides: Partial<MarketHistoryRepository> = {}): MarketHistoryRepository {
  return {
    getPreviousClose: vi.fn().mockResolvedValue(null),
    recordClose: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function deps(overrides: Partial<MarketDataDeps> = {}): MarketDataDeps {
  return {
    fetchImpl: vi.fn(),
    now: () => NOW,
    goldApiKey: "test-key",
    weatherApiKey: "test-key",
    coordinates: null,
    history: fakeHistory(),
    ...overrides,
  };
}

// Matches the real api.frankfurter.dev v2/rate/{base}/TRY response shape
// (flat, not nested under `rates`) — confirmed against the live API.
const USD_TCMB = { date: "2026-07-24", base: "USD", quote: "TRY", rate: 47.23 };
const EUR_TCMB = { date: "2026-07-24", base: "EUR", quote: "TRY", rate: 53.9 };
// Matches the real api.tomorrow.io/v4/weather/realtime response shape —
// confirmed against the live API (data.values.{temperature,
// temperatureApparent,weatherCode,uvIndex}; no is_day field on this plan).
const WEATHER_OK = {
  data: {
    time: "2026-07-24T04:15:00Z",
    values: {
      temperature: 29,
      temperatureApparent: 31.2,
      weatherCode: 1000,
      uvIndex: 6,
    },
  },
  location: { lat: 41.0082, lon: 28.9784 },
};
// Matches the real api.metalpriceapi.com/v1/latest response shape for
// base=XAU&currencies=TRY — rates.TRY is the TRY price of 1 troy ounce.
const GOLD_OUNCE_PRICE_TRY = 150881.2;
const GOLD_OK = { success: true, base: "XAU", timestamp: 1753333333, rates: { TRY: GOLD_OUNCE_PRICE_TRY } };
// Matches a real nominatim.openstreetmap.org/reverse response for an
// Istanbul coordinate — confirmed against the live API.
const NOMINATIM_EYUPSULTAN = {
  place_id: 59867629,
  osm_type: "relation",
  addresstype: "suburb",
  name: "Rami Yeni Mahallesi",
  display_name: "Rami Yeni Mahallesi, Eyüpsultan, İstanbul, Marmara Bölgesi, Türkiye",
  address: {
    suburb: "Rami Yeni Mahallesi",
    town: "Eyüpsultan",
    province: "İstanbul",
    "ISO3166-2-lvl4": "TR-34",
    region: "Marmara Bölgesi",
    country: "Türkiye",
    country_code: "tr",
  },
  boundingbox: ["41.0453901", "41.0554291", "28.9109746", "28.9225336"],
};

describe("fetchCurrency", () => {
  it("returns a valid TCMB USD/TRY and EUR/TRY pair", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(USD_TCMB))
      .mockResolvedValueOnce(jsonResponse(EUR_TCMB));
    const result = await fetchCurrency(deps({ fetchImpl }));
    expect(result).toEqual({
      usdTry: 47.23,
      usdTryPreviousClose: null,
      eurTry: 53.9,
      eurTryPreviousClose: null,
      rateDate: "2026-07-24",
      source: "TCMB",
    });
  });

  it("returns the stored previous close for both currencies", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(USD_TCMB))
      .mockResolvedValueOnce(jsonResponse(EUR_TCMB));
    const getPreviousClose = vi.fn().mockResolvedValueOnce(46.9).mockResolvedValueOnce(53.5);
    const result = await fetchCurrency(deps({ fetchImpl, history: fakeHistory({ getPreviousClose }) }));
    expect(result.usdTryPreviousClose).toBe(46.9);
    expect(result.eurTryPreviousClose).toBe(53.5);
    expect(getPreviousClose).toHaveBeenCalledWith("usdTry", "2026-07-24");
    expect(getPreviousClose).toHaveBeenCalledWith("eurTry", "2026-07-24");
  });

  it("records today's close for both currencies", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(USD_TCMB))
      .mockResolvedValueOnce(jsonResponse(EUR_TCMB));
    const recordClose = vi.fn().mockResolvedValue(undefined);
    await fetchCurrency(deps({ fetchImpl, history: fakeHistory({ recordClose }) }));
    expect(recordClose).toHaveBeenCalledWith("usdTry", "2026-07-24", 47.23, "TCMB");
    expect(recordClose).toHaveBeenCalledWith("eurTry", "2026-07-24", 53.9, "TCMB");
  });

  it("still returns the rate with previousClose null when the history read fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(USD_TCMB))
      .mockResolvedValueOnce(jsonResponse(EUR_TCMB));
    const getPreviousClose = vi.fn().mockRejectedValue(new Error("db unreachable"));
    const result = await fetchCurrency(deps({ fetchImpl, history: fakeHistory({ getPreviousClose }) }));
    expect(result.usdTry).toBe(47.23);
    expect(result.usdTryPreviousClose).toBeNull();
  });

  it("still returns the rate when the history write fails", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(USD_TCMB))
      .mockResolvedValueOnce(jsonResponse(EUR_TCMB));
    const recordClose = vi.fn().mockRejectedValue(new Error("db unreachable"));
    await expect(fetchCurrency(deps({ fetchImpl, history: fakeHistory({ recordClose }) }))).resolves.toMatchObject({ usdTry: 47.23 });
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
      weatherCode: 1000,
      condition: "Açık",
      isDay: true,
      location: "İstanbul",
      updatedAt: NOW.toISOString(),
      source: "Tomorrow.io",
    });
  });

  it("derives isDay: false from uvIndex 0", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ data: { values: { temperature: 18, temperatureApparent: 17, weatherCode: 1000, uvIndex: 0 } } }),
    );
    const result = await fetchWeather(deps({ fetchImpl }));
    expect(result.isDay).toBe(false);
  });

  it("rejects a response missing the data/values block", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}));
    await expect(fetchWeather(deps({ fetchImpl }))).rejects.toThrow();
  });

  it("throws missing_credential when no TOMORROW_API_KEY is configured, without calling fetch", async () => {
    const fetchImpl = vi.fn();
    await expect(fetchWeather(deps({ fetchImpl, weatherApiKey: null }))).rejects.toThrow("missing_credential");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("uses the fixed Istanbul fallback and skips reverse geocoding when no coordinates are supplied", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(WEATHER_OK));
    const result = await fetchWeather(deps({ fetchImpl, coordinates: null }));
    expect(result.location).toBe("İstanbul");
    expect(fetchImpl).toHaveBeenCalledTimes(1); // weather only — no geocoding call
    expect(fetchImpl.mock.calls[0][0]).toContain("41.0082,28.9784");
  });

  it("uses the caller's coordinates for the weather request and reverse-geocodes them", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(WEATHER_OK))
      .mockResolvedValueOnce(jsonResponse(NOMINATIM_EYUPSULTAN));
    const result = await fetchWeather(deps({ fetchImpl, coordinates: { latitude: 41.0526, longitude: 28.9186 } }));
    expect(result.location).toBe("Eyüpsultan, İstanbul");
    expect(fetchImpl.mock.calls[0][0]).toContain("41.05,28.92");
  });
});

describe("roundCoordinate", () => {
  it("rounds to 2 decimal places (~1.1km precision)", () => {
    expect(roundCoordinate(41.052637)).toBe(41.05);
    expect(roundCoordinate(28.918642)).toBe(28.92);
  });
});

describe("reverseGeocode", () => {
  it("returns 'district, city' when both resolve", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(NOMINATIM_EYUPSULTAN));
    const result = await reverseGeocode(deps({ fetchImpl }), { latitude: 41.0526, longitude: 28.9186 });
    expect(result).toEqual({ district: "Eyüpsultan", city: "İstanbul", displayName: "Eyüpsultan, İstanbul" });
  });

  it("falls back to city only when no district field is present", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(
      jsonResponse({ address: { province: "İstanbul" } }),
    );
    const result = await reverseGeocode(deps({ fetchImpl }), { latitude: 41, longitude: 29 });
    expect(result).toEqual({ district: null, city: "İstanbul", displayName: "İstanbul" });
  });

  it("falls back to 'Konumunuz' when neither district nor city resolve", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ address: {} }));
    const result = await reverseGeocode(deps({ fetchImpl }), { latitude: 41, longitude: 29 });
    expect(result.displayName).toBe("Konumunuz");
  });

  it("falls back to 'Konumunuz' (never throws) when the geocoding request fails outright", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({}, { ok: false, status: 503 }));
    const result = await reverseGeocode(deps({ fetchImpl }), { latitude: 41, longitude: 29 });
    expect(result).toEqual({ district: null, city: null, displayName: "Konumunuz" });
  });

  it("never returns street, house number, postcode, or the provider's full address string", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(NOMINATIM_EYUPSULTAN));
    const result = await reverseGeocode(deps({ fetchImpl }), { latitude: 41.0526, longitude: 28.9186 });
    expect(Object.keys(result).sort()).toEqual(["city", "displayName", "district"]);
    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/road|house_number|postcode|display_name|Rami Yeni Mahallesi/);
  });

  it("rounds coordinates before requesting (never sends full-precision coordinates upstream)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(NOMINATIM_EYUPSULTAN));
    await reverseGeocode(deps({ fetchImpl }), { latitude: 41.052637123, longitude: 28.918642987 });
    const requestedUrl = fetchImpl.mock.calls[0][0] as string;
    expect(requestedUrl).toContain("lat=41.05");
    expect(requestedUrl).toContain("lon=28.92");
    expect(requestedUrl).not.toContain("41.052637123");
  });
});

describe("mapWeatherCodeToTurkish", () => {
  it.each([
    [1000, "Açık"],
    [1100, "Açık"],
    [1101, "Parçalı bulutlu"],
    [1102, "Bulutlu"],
    [1001, "Bulutlu"],
    [2000, "Sisli"],
    [4000, "Çisenti"],
    [4001, "Yağmurlu"],
    [4200, "Yağmurlu"],
    [4201, "Sağanak"],
    [5000, "Karlı"],
    [8000, "Gök gürültülü"],
  ])("maps code %i to %s", (code, expected) => {
    expect(mapWeatherCodeToTurkish(code)).toBe(expected);
  });
});

describe("fetchGold", () => {
  it("converts the ounce price to a gram price", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(GOLD_OK));
    const result = await fetchGold(deps({ fetchImpl }));
    expect(result.gramTry).toBeCloseTo(GOLD_OUNCE_PRICE_TRY / 31.1034768, 6);
    expect(result.gramTryPreviousClose).toBeNull();
    expect(result.updatedAt).toBe(NOW.toISOString());
    expect(result.source).toBe("metalpriceapi.com");
  });

  it("returns the stored previous close and records today's close", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(GOLD_OK));
    const getPreviousClose = vi.fn().mockResolvedValue(4700.5);
    const recordClose = vi.fn().mockResolvedValue(undefined);
    const result = await fetchGold(deps({ fetchImpl, history: fakeHistory({ getPreviousClose, recordClose }) }));
    expect(result.gramTryPreviousClose).toBe(4700.5);
    expect(getPreviousClose).toHaveBeenCalledWith("gramTry", "2026-07-24");
    expect(recordClose).toHaveBeenCalledWith("gramTry", "2026-07-24", result.gramTry, "metalpriceapi.com");
  });

  it("rejects a response with success:false even though HTTP status is 200 (MetalpriceAPI's actual failure signal)", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: false, error: { statusCode: 101, message: "User did not supply an API Key" } }));
    await expect(fetchGold(deps({ fetchImpl }))).rejects.toThrow();
  });

  it("throws missing_credential when no GOLD_API_KEY is configured, without calling fetch", async () => {
    const fetchImpl = vi.fn();
    await expect(fetchGold(deps({ fetchImpl, goldApiKey: null }))).rejects.toThrow("missing_credential");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("rejects a non-positive gold price", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: true, rates: { TRY: 0 } }));
    await expect(fetchGold(deps({ fetchImpl }))).rejects.toThrow();
  });

  it("rejects a missing rates.TRY field", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse({ success: true, rates: {} }));
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
    expect(result.gold.gramTry).toBeCloseTo(GOLD_OUNCE_PRICE_TRY / 31.1034768, 6);
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
    expect(result.gold.gramTry).toBeCloseTo(GOLD_OUNCE_PRICE_TRY / 31.1034768, 6);
    expect(result.weather).toBeNull();
    expect(result.errors.weather).toBe("unavailable");
  });

  it("keeps currency and gold valid when weather is missing its credential", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(USD_TCMB))
      .mockResolvedValueOnce(jsonResponse(EUR_TCMB))
      .mockResolvedValueOnce(jsonResponse(GOLD_OK));
    const result = await buildMarketDataResponse(deps({ fetchImpl, weatherApiKey: null }));
    expect(result.currency).not.toBeNull();
    expect(result.gold.gramTry).toBeCloseTo(GOLD_OUNCE_PRICE_TRY / 31.1034768, 6);
    expect(result.weather).toBeNull();
    expect(result.errors.weather).toBe("missing_credential");
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
    expect(result.gold.gramTry).toBeCloseTo(GOLD_OUNCE_PRICE_TRY / 31.1034768, 6);
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
