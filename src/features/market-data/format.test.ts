import { describe, expect, it } from "vitest";
import {
  formatTryAmount,
  formatProviderLabel,
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

describe("formatProviderLabel", () => {
  it("maps the metalpriceapi.com source to a friendly display name", () => {
    expect(formatProviderLabel("metalpriceapi.com")).toBe("MetalPriceAPI");
  });

  it("passes an already-friendly source (e.g. TCMB) through unchanged", () => {
    expect(formatProviderLabel("TCMB")).toBe("TCMB");
  });

  it("never includes a date or clock time", () => {
    expect(formatProviderLabel("TCMB")).not.toMatch(/\d{1,2}:\d{2}|\d{4}-\d{2}-\d{2}|Ocak|Şubat|Mart|Nisan|Mayıs|Haziran|Temmuz|Ağustos|Eylül|Ekim|Kasım|Aralık/);
    expect(formatProviderLabel("metalpriceapi.com")).not.toMatch(/\d{1,2}:\d{2}|\d{4}-\d{2}-\d{2}/);
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
    expect(getWeatherIconKey(1000, true)).toBe("sun");
    expect(getWeatherIconKey(1000, false)).toBe("moon");
  });

  it("does not map every condition to sun", () => {
    expect(getWeatherIconKey(4001, true)).toBe("rain");
    expect(getWeatherIconKey(1001, true)).toBe("cloud");
    expect(getWeatherIconKey(8000, true)).toBe("thunder");
    expect(getWeatherIconKey(5000, true)).toBe("snow");
  });
});
