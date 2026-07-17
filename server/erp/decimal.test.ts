import { describe, expect, it } from "vitest";
import { formatDecimalScaled, isPositiveDecimal, multiplyDecimalByInt, parseDecimalScaled, subtractDecimalStrings, sumDecimalStrings } from "./decimal.ts";

describe("parseDecimalScaled / formatDecimalScaled", () => {
  it("round-trips a plain integer", () => {
    expect(formatDecimalScaled(parseDecimalScaled("1400"))).toBe("1400.00");
  });

  it("round-trips a decimal value", () => {
    expect(formatDecimalScaled(parseDecimalScaled("1400.5"))).toBe("1400.50");
  });

  it("handles negative values", () => {
    expect(formatDecimalScaled(parseDecimalScaled("-250.75"))).toBe("-250.75");
  });

  it("treats null/undefined/empty as zero", () => {
    expect(formatDecimalScaled(parseDecimalScaled(null))).toBe("0.00");
    expect(formatDecimalScaled(parseDecimalScaled(undefined))).toBe("0.00");
    expect(formatDecimalScaled(parseDecimalScaled(""))).toBe("0.00");
  });

  it("never drifts on values that break IEEE754 floats", () => {
    // 0.1 + 0.2 !== 0.3 in float math; must be exact here.
    expect(sumDecimalStrings(["0.1", "0.2"])).toBe("0.30");
  });
});

describe("sumDecimalStrings", () => {
  it("sums many string amounts exactly", () => {
    expect(sumDecimalStrings(["100.10", "200.20", "300.30"])).toBe("600.60");
  });

  it("returns 0.00 for an empty list", () => {
    expect(sumDecimalStrings([])).toBe("0.00");
  });
});

describe("subtractDecimalStrings", () => {
  it("subtracts exactly", () => {
    expect(subtractDecimalStrings("100.00", "40.25")).toBe("59.75");
  });
});

describe("isPositiveDecimal", () => {
  it("is true only for strictly positive values", () => {
    expect(isPositiveDecimal("0.01")).toBe(true);
    expect(isPositiveDecimal("0")).toBe(false);
    expect(isPositiveDecimal("0.00")).toBe(false);
    expect(isPositiveDecimal("-5")).toBe(false);
    expect(isPositiveDecimal(null)).toBe(false);
  });
});

describe("multiplyDecimalByInt", () => {
  it("multiplies a decimal amount by an integer quantity exactly", () => {
    expect(multiplyDecimalByInt("19.99", 3)).toBe("59.97");
  });
});
