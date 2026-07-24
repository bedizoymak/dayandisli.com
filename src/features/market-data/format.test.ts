import { describe, expect, it } from "vitest";
import {
  formatTryAmount,
  formatCurrencyMeta,
  formatGoldMeta,
  formatTemperature,
  isMarketDataStale,
  getWeatherIconKey,
} from "./format";

describe("formatTryAmount", () => {
  it("formats with Turkish number formatting and a ₺ prefix", () => {
    expect(formatTryAmount(47.23)).toBe("₺47,23");
  });

  it("formats larger values with a Turkish thousands separator", () => {
    expect(formatTryAmount(4850.32)).toBe("₺4.850,32");
  });
});

describe("formatCurrencyMeta", () => {
  it("formats a YYYY-MM-DD date as 'D Month · Source'", () => {
    expect(formatCurrencyMeta("2026-07-24", "TCMB")).toBe("24 Temmuz · TCMB");
  });

  it("falls back to just the source for an unparsable date", () => {
    expect(formatCurrencyMeta("not-a-date", "TCMB")).toBe("TCMB");
  });
});

describe("formatGoldMeta", () => {
  it("formats an ISO timestamp as 'Güncellendi HH:MM'", () => {
    expect(formatGoldMeta("2026-07-24T04:15:00.000Z")).toMatch(/^Güncellendi \d{2}:\d{2}$/);
  });

  it("handles an invalid timestamp without throwing", () => {
    expect(formatGoldMeta("not-a-date")).toBe("Güncellendi —");
  });
});

describe("formatTemperature", () => {
  it("rounds to the nearest integer with a degree sign", () => {
    expect(formatTemperature(29.4)).toBe("29°");
    expect(formatTemperature(29.6)).toBe("30°");
  });
});

describe("isMarketDataStale", () => {
  const now = new Date("2026-07-24T12:00:00.000Z").getTime();

  it("is not stale just after fetching", () => {
    expect(isMarketDataStale(now - 60_000, now)).toBe(false);
  });

  it("is stale after the threshold elapses", () => {
    expect(isMarketDataStale(now - 30 * 60_000, now)).toBe(true);
  });
});

describe("getWeatherIconKey", () => {
  it("maps clear-day and clear-night to different icons", () => {
    expect(getWeatherIconKey(0, true)).toBe("sun");
    expect(getWeatherIconKey(0, false)).toBe("moon");
  });

  it("does not map every condition to sun", () => {
    expect(getWeatherIconKey(61, true)).toBe("rain");
    expect(getWeatherIconKey(3, true)).toBe("cloud");
    expect(getWeatherIconKey(95, true)).toBe("thunder");
    expect(getWeatherIconKey(71, true)).toBe("snow");
  });
});
