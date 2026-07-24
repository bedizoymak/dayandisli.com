import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

const { fetchMarketData } = await import("./api.ts");

const VALID_PAYLOAD = {
  currency: { usdTry: 47.23, eurTry: 53.9, rateDate: "2026-07-24", source: "TCMB" },
  gold: { gramTry: 4850.32, updatedAt: "2026-07-24T04:15:00.000Z", source: "goldapi.io" },
  weather: {
    temperatureC: 29,
    apparentTemperatureC: 31.2,
    weatherCode: 0,
    condition: "Açık",
    isDay: true,
    location: "İstanbul",
    updatedAt: "2026-07-24T04:15:00.000Z",
    source: "Open-Meteo",
  },
  fetchedAt: "2026-07-24T04:15:00.000Z",
  errors: { currency: null, gold: null, weather: null },
};

describe("fetchMarketData", () => {
  it("returns parsed data for a fully valid response", async () => {
    invoke.mockResolvedValueOnce({ data: VALID_PAYLOAD, error: null });
    const result = await fetchMarketData();
    expect(result).toEqual(VALID_PAYLOAD);
  });

  it("accepts a null gold gramTry (missing credential / provider unavailable)", async () => {
    invoke.mockResolvedValueOnce({
      data: { ...VALID_PAYLOAD, gold: { gramTry: null, updatedAt: VALID_PAYLOAD.fetchedAt, source: "goldapi.io" }, errors: { ...VALID_PAYLOAD.errors, gold: "missing_credential" } },
      error: null,
    });
    const result = await fetchMarketData();
    expect(result.gold.gramTry).toBeNull();
    expect(result.errors.gold).toBe("missing_credential");
  });

  it("accepts a null currency section on provider failure", async () => {
    invoke.mockResolvedValueOnce({
      data: { ...VALID_PAYLOAD, currency: null, errors: { ...VALID_PAYLOAD.errors, currency: "unavailable" } },
      error: null,
    });
    const result = await fetchMarketData();
    expect(result.currency).toBeNull();
  });

  it("accepts a null weather section on provider failure", async () => {
    invoke.mockResolvedValueOnce({
      data: { ...VALID_PAYLOAD, weather: null, errors: { ...VALID_PAYLOAD.errors, weather: "unavailable" } },
      error: null,
    });
    const result = await fetchMarketData();
    expect(result.weather).toBeNull();
  });

  it("throws when the edge function itself errors", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "Edge Function returned a non-2xx status code" } });
    await expect(fetchMarketData()).rejects.toThrow();
  });

  it("throws on malformed JSON (non-positive currency value)", async () => {
    invoke.mockResolvedValueOnce({
      data: { ...VALID_PAYLOAD, currency: { ...VALID_PAYLOAD.currency, usdTry: 0 } },
      error: null,
    });
    await expect(fetchMarketData()).rejects.toThrow(/usdTry/);
  });

  it("throws on a non-object payload", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: null });
    await expect(fetchMarketData()).rejects.toThrow(/geçersiz/);
  });
});
