import { describe, expect, it } from "vitest";
import { computeIdsToArchive, evaluateReconciliationEligibility } from "./reconciliation.ts";

function baseEligibility(overrides: Partial<Parameters<typeof evaluateReconciliationEligibility>[0]> = {}) {
  return evaluateReconciliationEligibility({
    loopCompletedWithoutError: true,
    errorCount: 0,
    pagesFetched: 18,
    observedCount: 436,
    previouslyActiveCount: 437,
    ...overrides,
  });
}

describe("evaluateReconciliationEligibility", () => {
  it("allows reconciliation for a genuinely complete, error-free, non-empty run", () => {
    expect(baseEligibility()).toEqual({ skip: false, reason: null });
  });

  it("skips when the sync loop did not complete (threw)", () => {
    expect(baseEligibility({ loopCompletedWithoutError: false })).toEqual({
      skip: true,
      reason: "sync_run_did_not_complete",
    });
  });

  it("skips when any per-resource error occurred during the run (partial pagination / conversion / DB error)", () => {
    expect(baseEligibility({ errorCount: 1 })).toEqual({ skip: true, reason: "sync_run_had_errors" });
  });

  it("skips when zero pages were fetched", () => {
    expect(baseEligibility({ pagesFetched: 0 })).toEqual({ skip: true, reason: "no_pages_fetched" });
  });

  it("skips a suspiciously empty snapshot (0 observed but rows previously existed)", () => {
    expect(baseEligibility({ observedCount: 0, previouslyActiveCount: 437 })).toEqual({
      skip: true,
      reason: "suspiciously_empty_snapshot",
    });
  });

  it("does NOT skip a genuinely empty resource that was always empty (0 observed, 0 previously active)", () => {
    expect(baseEligibility({ observedCount: 0, previouslyActiveCount: 0 })).toEqual({ skip: false, reason: null });
  });

  it("does NOT skip when the snapshot shrank by one real deletion (not suspicious — still mostly populated)", () => {
    expect(baseEligibility({ observedCount: 436, previouslyActiveCount: 437 })).toEqual({ skip: false, reason: null });
  });

  it("skips a truncated-but-nonzero snapshot (e.g. pagination stopped early after only 10%)", () => {
    expect(baseEligibility({ observedCount: 44, previouslyActiveCount: 437 })).toEqual({
      skip: true,
      reason: "suspiciously_truncated_snapshot",
    });
  });

  it("does not skip a snapshot just above the retention threshold", () => {
    // 219/437 = 50.11% — just over the 50% default floor.
    expect(baseEligibility({ observedCount: 219, previouslyActiveCount: 437 })).toEqual({ skip: false, reason: null });
  });

  it("skips a snapshot just below the retention threshold", () => {
    // 218/437 = 49.88% — just under the 50% default floor.
    expect(baseEligibility({ observedCount: 218, previouslyActiveCount: 437 })).toEqual({
      skip: true,
      reason: "suspiciously_truncated_snapshot",
    });
  });

  it("honors a custom minObservedRatio override", () => {
    expect(baseEligibility({ observedCount: 44, previouslyActiveCount: 437, minObservedRatio: 0.05 })).toEqual({
      skip: false,
      reason: null,
    });
  });
});

describe("computeIdsToArchive", () => {
  it("archives exactly the one previously-active id missing from the complete snapshot", () => {
    const previouslyActive = ["1", "2", "1067909443"];
    const observed = new Set(["1", "2"]);
    expect(computeIdsToArchive(previouslyActive, observed)).toEqual(["1067909443"]);
  });

  it("archives nothing when every previously-active id was observed", () => {
    expect(computeIdsToArchive(["1", "2"], new Set(["1", "2", "3"]))).toEqual([]);
  });

  it("archives nothing when the mirror had no active rows to begin with", () => {
    expect(computeIdsToArchive([], new Set(["1"]))).toEqual([]);
  });

  it("never returns an id that wasn't already in previouslyActiveIds (archival set can't exceed the mirror's own rows)", () => {
    const result = computeIdsToArchive(["1"], new Set([]));
    expect(result).toEqual(["1"]);
    expect(result).not.toContain("999-not-in-mirror");
  });

  it("accepts a plain array of observed ids (not just a Set)", () => {
    expect(computeIdsToArchive(["1", "2"], ["1"])).toEqual(["2"]);
  });

  it("dedupes previouslyActiveIds", () => {
    expect(computeIdsToArchive(["1", "1", "2"], new Set(["2"]))).toEqual(["1"]);
  });

  it("is a pure diff — never mentions DELETE, and returns ids only, no side effects", () => {
    // documents the contract: this function's entire surface area is (ids in, ids out).
    // The caller is responsible for turning this into a scoped UPDATE ... SET source_archived = true,
    // never a DELETE statement.
    const result = computeIdsToArchive(["a", "b"], new Set(["a"]));
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual(["b"]);
  });
});
