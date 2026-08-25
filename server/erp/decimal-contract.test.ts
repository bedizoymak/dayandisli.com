// PHASE 9 contract tests: the SAME financial primitives exist per runtime
// boundary by design (server/erp/decimal.ts must not import Paraşüt modules;
// supabase/functions/_shared/parasut-metrics.ts must stay Deno-free and
// import-free). Duplication is therefore ALLOWED — but only under proof of
// equivalence. These tests run identical fixture vectors through BOTH
// implementations and fail if they ever diverge. If you change one
// implementation, these tests force the other to match or force a conscious,
// reviewed semantic decision.
import { describe, expect, it } from "vitest";
import {
  formatDecimalScaled as erpFormat,
  isPositiveDecimal as erpIsPositive,
  parseDecimalScaled as erpParse,
  sumDecimalStrings as erpSum,
} from "./decimal.ts";
import {
  formatDecimalScaled as metricsFormat,
  isPositiveDecimal as metricsIsPositive,
  parseDecimalScaled as metricsParse,
  sumDecimalStrings as metricsSum,
} from "../../supabase/functions/_shared/parasut-metrics.ts";
import { BALANCE_TOLERANCE as ENGINE_TOLERANCE } from "../parasut/sync-statement-staleness.ts";
import { BALANCE_TOLERANCE as FRONTEND_TOLERANCE } from "../../src/features/crm/customerLedger";

// Vectors include every trap this system has ever hit (see the trl_balance
// incident): canonical API decimals, negatives, >2 fraction digits, Turkish
// locale strings that MUST NOT parse, junk, empties, huge values.
const PARSE_VECTORS: Array<{ input: string | number | null | undefined; expectedScaled: bigint }> = [
  { input: "8400.0", expectedScaled: 8_400_000_000n },
  { input: "1127109.11", expectedScaled: 1_127_109_110_000n },
  { input: "-2919100.005", expectedScaled: -2_919_100_005_000n },
  { input: 42, expectedScaled: 42_000_000n },
  { input: -0.5, expectedScaled: -500_000n },
  { input: "0.0000004", expectedScaled: 0n }, // beyond scale-6 → truncated
  { input: ".5", expectedScaled: 500_000n },
  { input: "5.", expectedScaled: 5_000_000n },
  { input: "", expectedScaled: 0n },
  { input: "   ", expectedScaled: 0n },
  { input: null, expectedScaled: 0n },
  { input: undefined, expectedScaled: 0n },
  { input: "1.234,56", expectedScaled: 0n }, // Turkish locale — MUST NOT parse
  { input: "1,234.56", expectedScaled: 0n }, // thousands separator — MUST NOT parse
  { input: "abc", expectedScaled: 0n },
  { input: "1e9", expectedScaled: 0n }, // scientific notation rejected
];

const FORMAT_VECTORS: Array<{ scaled: bigint; expected: string }> = [
  { scaled: 0n, expected: "0.00" },
  { scaled: 8_400_000_000n, expected: "8400.00" },
  { scaled: 1_127_109_110_000n, expected: "1127109.11" },
  { scaled: -500_000n, expected: "-0.50" },
  { scaled: 123n, expected: "0.00" }, // sub-kurus fraction truncates in display
  { scaled: -2_919_100_005_000n, expected: "-2919100.00" }, // display keeps 2 digits
];

const SUM_VECTORS: Array<{ inputs: Array<string | number | null | undefined>; expected: string }> = [
  { inputs: ["8400.0", "1600.0"], expected: "10000.00" },
  { inputs: ["0.1", "0.2"], expected: "0.30" }, // the float classic — fixed-point wins
  { inputs: ["-2919100.00", "1991990.89"], expected: "-927109.11" },
  { inputs: [], expected: "0.00" },
  { inputs: [null, undefined, "", 7], expected: "7.00" },
  { inputs: ["999999999999.99", "0.01"], expected: "1000000000000.00" },
];

describe("CONTRACT: decimal primitives are identical across runtime boundaries", () => {
  it("parseDecimalScaled agrees on every vector", () => {
    for (const vector of PARSE_VECTORS) {
      expect(erpParse(vector.input), `erp parse of ${JSON.stringify(vector.input)}`).toBe(vector.expectedScaled);
      expect(metricsParse(vector.input), `metrics parse of ${JSON.stringify(vector.input)}`).toBe(vector.expectedScaled);
    }
  });

  it("formatDecimalScaled agrees on every vector", () => {
    for (const vector of FORMAT_VECTORS) {
      expect(erpFormat(vector.scaled)).toBe(vector.expected);
      expect(metricsFormat(vector.scaled)).toBe(vector.expected);
    }
  });

  it("sumDecimalStrings agrees on every vector (no float drift anywhere)", () => {
    for (const vector of SUM_VECTORS) {
      expect(erpSum(vector.inputs)).toBe(vector.expected);
      expect(metricsSum(vector.inputs)).toBe(vector.expected);
    }
  });

  it("isPositiveDecimal agrees on every vector", () => {
    const samples = ["0", "-0.01", "0.01", "8400.0", "", null];
    for (const sample of samples) {
      expect(erpIsPositive(sample)).toBe(metricsIsPositive(sample));
    }
    expect(erpIsPositive("0")).toBe(false);
  });
});

describe("CONTRACT: statement balance tolerance is one value everywhere", () => {
  it("frontend customerLedger and backend staleness engine use the same half-a-kurus tolerance", () => {
    expect(FRONTEND_TOLERANCE).toBe(ENGINE_TOLERANCE);
    expect(FRONTEND_TOLERANCE).toBe(0.005);
  });

  it("tolerance actually separates fresh from stale at the boundary (behavioral pin)", () => {
    const computed = 927_109.11;
    const finalHistory = computed + 0.004;
    const finalHistoryBeyondTolerance = computed + 0.006;
    expect(Math.abs(computed - finalHistory) > FRONTEND_TOLERANCE).toBe(false);
    expect(Math.abs(computed - finalHistoryBeyondTolerance) > FRONTEND_TOLERANCE).toBe(true);
  });
});


