import { describe, expect, it } from "vitest";
import {
  DEFAULT_RETRY_BASE_DELAY_MS,
  DEFAULT_RETRY_MAX_DELAY_MS,
  RETRY_GOVERNANCE_METADATA_KEY,
  isCircuitOpen,
  readRetryGovernance,
  recordAttempt,
  retryDelayMs,
} from "./sync-retry-governance.ts";

describe("retryDelayMs", () => {
  it("doubles per consecutive zero-progress attempt", () => {
    expect(retryDelayMs(1)).toBe(DEFAULT_RETRY_BASE_DELAY_MS);
    expect(retryDelayMs(2)).toBe(2 * DEFAULT_RETRY_BASE_DELAY_MS);
    expect(retryDelayMs(3)).toBe(4 * DEFAULT_RETRY_BASE_DELAY_MS);
    expect(retryDelayMs(4)).toBe(8 * DEFAULT_RETRY_BASE_DELAY_MS);
  });

  it("caps at the maximum delay (~4 attempts/day worst case vs ~288 unthrottled)", () => {
    expect(retryDelayMs(50)).toBe(DEFAULT_RETRY_MAX_DELAY_MS);
    expect(retryDelayMs(1000)).toBe(DEFAULT_RETRY_MAX_DELAY_MS);
    expect(retryDelayMs(1000)).toBeLessThanOrEqual(6 * 60 * 60 * 1000);
  });

  it("honours injected schedule overrides (tests/fast environments)", () => {
    expect(retryDelayMs(1, 1000, 4000)).toBe(1000);
    expect(retryDelayMs(5, 1000, 4000)).toBe(4000);
  });
});

describe("readRetryGovernance", () => {
  it("reads a valid persisted state", () => {
    const state = {
      attempts: 3,
      consecutive_no_progress: 2,
      last_attempt_at: "2026-08-25T00:00:00.000Z",
      open_until: "2026-08-25T00:30:00.000Z",
    };
    expect(readRetryGovernance({ [RETRY_GOVERNANCE_METADATA_KEY]: state })).toEqual(state);
  });

  it("returns null for absent, malformed, or corrupt state — governance can never hard-fail a previously-working sync", () => {
    expect(readRetryGovernance(undefined)).toBeNull();
    expect(readRetryGovernance(null)).toBeNull();
    expect(readRetryGovernance({})).toBeNull();
    expect(readRetryGovernance({ [RETRY_GOVERNANCE_METADATA_KEY]: "garbage" })).toBeNull();
    expect(readRetryGovernance({ [RETRY_GOVERNANCE_METADATA_KEY]: [1, 2] })).toBeNull();
    expect(
      readRetryGovernance({
        [RETRY_GOVERNANCE_METADATA_KEY]: { attempts: "many", consecutive_no_progress: 0 },
      }),
    ).toBeNull();
    expect(
      readRetryGovernance({
        [RETRY_GOVERNANCE_METADATA_KEY]: { attempts: 1, consecutive_no_progress: -1 },
      }),
    ).toBeNull();
  });
});

describe("isCircuitOpen", () => {
  const state = (openUntil: string | null) => ({
    attempts: 1,
    consecutive_no_progress: 1,
    last_attempt_at: "2026-08-25T00:00:00.000Z",
    open_until: openUntil,
  });

  it("is open strictly before the boundary", () => {
    expect(isCircuitOpen(state("2026-08-25T01:00:00.000Z"), new Date("2026-08-25T00:59:59.999Z"))).toBe(true);
  });

  it("closes exactly at the boundary (half-open interval)", () => {
    expect(isCircuitOpen(state("2026-08-25T01:00:00.000Z"), new Date("2026-08-25T01:00:00.000Z"))).toBe(false);
  });

  it("is never open without persisted state or an unreadable boundary", () => {
    expect(isCircuitOpen(null, new Date())).toBe(false);
    expect(isCircuitOpen(state(null), new Date())).toBe(false);
    expect(isCircuitOpen(state("not-a-date"), new Date())).toBe(false);
  });
});

describe("recordAttempt", () => {
  const T0 = new Date("2026-08-25T00:00:00.000Z");

  it("opens the backoff window after the first zero-progress failure", () => {
    const next = recordAttempt({ previous: null, madeProgress: false, status: "partial", now: T0 });
    expect(next).toEqual({
      attempts: 1,
      consecutive_no_progress: 1,
      last_attempt_at: T0.toISOString(),
      open_until: new Date(T0.getTime() + DEFAULT_RETRY_BASE_DELAY_MS).toISOString(),
    });
  });

  it("climbs the ladder on repeated zero-progress failures", () => {
    const first = recordAttempt({ previous: null, madeProgress: false, status: "failed", now: T0 });
    const second = recordAttempt({ previous: first, madeProgress: false, status: "partial", now: T0 });
    expect(second.consecutive_no_progress).toBe(2);
    expect(second.attempts).toBe(2);
    expect(second.open_until).toBe(new Date(T0.getTime() + 2 * DEFAULT_RETRY_BASE_DELAY_MS).toISOString());
  });

  it("resets the ladder when the attempt makes forward progress (healthy bounded backlog)", () => {
    const poisoned = recordAttempt({ previous: null, madeProgress: false, status: "partial", now: T0 });
    const progressing = recordAttempt({
      previous: poisoned,
      madeProgress: true,
      status: "partial",
      now: T0,
    });
    expect(progressing.consecutive_no_progress).toBe(0);
    expect(progressing.open_until).toBeNull();
    expect(progressing.attempts).toBe(2);
  });

  it("fully resets when the chain completes", () => {
    const poisoned = recordAttempt({ previous: null, madeProgress: false, status: "partial", now: T0 });
    const done = recordAttempt({ previous: poisoned, madeProgress: true, status: "completed", now: T0 });
    expect(done).toEqual({
      attempts: 2,
      consecutive_no_progress: 0,
      last_attempt_at: T0.toISOString(),
      open_until: null,
    });
  });
});
