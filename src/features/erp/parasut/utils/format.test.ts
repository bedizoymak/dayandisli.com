import { describe, expect, it } from "vitest";
import { formatParasutCurrency, formatParasutDate, formatRelativeDays } from "./format";

describe("formatParasutCurrency", () => {
  it("formats a decimal string with its own currency, never combining currencies", () => {
    expect(formatParasutCurrency("1400.5", "TRY")).toContain("1.400,50");
    expect(formatParasutCurrency("1400.5", "USD")).not.toBe(formatParasutCurrency("1400.5", "TRY"));
  });

  it("falls back gracefully for missing values instead of showing a false zero", () => {
    expect(formatParasutCurrency(null, "TRY")).toBe("—");
    expect(formatParasutCurrency(undefined, "TRY")).toBe("—");
  });
});

describe("formatParasutDate", () => {
  it("formats an ISO date in Turkish day/month/year order", () => {
    expect(formatParasutDate("2026-07-15")).toBe("15.07.2026");
  });

  it("returns a placeholder for missing or invalid dates", () => {
    expect(formatParasutDate(null)).toBe("—");
    expect(formatParasutDate("not-a-date")).toBe("—");
  });
});

describe("formatRelativeDays", () => {
  it("labels future, past, and same-day values distinctly", () => {
    expect(formatRelativeDays(16)).toBe("16 gün sonra");
    expect(formatRelativeDays(-247)).toBe("247 gün gecikti");
    expect(formatRelativeDays(0)).toBe("Bugün");
  });
});
