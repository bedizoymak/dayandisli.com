// PHASE 1B: unit coverage for the sync-health model. Each mandated detectable
// condition gets a focused scenario; timestamps are relative to `now` so the
// suite never rots with wall-clock drift.
import { describe, expect, it } from "vitest";
import {
  FAILURE_STREAK_THRESHOLD,
  HUNG_RUNNER_MS,
  STATEMENT_REFRESH_WARN_MS,
  SYNC_STALE_CRITICAL_MS,
  SYNC_STALE_WARN_MS,
  computeSyncHealth,
  type SyncRunHealthInput,
} from "./sync-health.ts";

const NOW = new Date("2026-08-25T12:00:00.000Z");
const WINDOW_HOURS = 24;

function run(overrides: Partial<SyncRunHealthInput> & { resource_type: string }): SyncRunHealthInput {
  return {
    status: "completed",
    started_at: new Date(NOW.getTime() - 5 * 60 * 1000).toISOString(),
    completed_at: new Date(NOW.getTime() - 4 * 60 * 1000).toISOString(),
    request_metadata: {},
    ...overrides,
  };
}

function healthyRuns(): SyncRunHealthInput[] {
  return ["accounts", "contacts", "products", "sales_invoices", "purchase_bills", "checks", "transaction_history_items"].map(
    (resource_type) => run({ resource_type }),
  );
}

function codes(snapshot: ReturnType<typeof computeSyncHealth>): string[] {
  return snapshot.alerts.map((alert) => alert.code);
}

describe("computeSyncHealth", () => {
  it("reports ok when every resource is fresh and successful", () => {
    const snapshot = computeSyncHealth({ now: NOW, emergencyPauseActive: false, windowHours: WINDOW_HOURS, recentRuns: healthyRuns() });
    expect(snapshot.status).toBe("ok");
    expect(snapshot.alerts).toHaveLength(0);
    for (const resource of snapshot.resources) {
      expect(resource.freshness).toBe("fresh");
      expect(resource.consecutiveFailures).toBe(0);
    }
  });

  it("reports paused when the emergency kill-switch is active, regardless of history", () => {
    const snapshot = computeSyncHealth({
      now: NOW,
      emergencyPauseActive: true,
      windowHours: WINDOW_HOURS,
      recentRuns: healthyRuns().concat(run({ resource_type: "contacts", status: "failed", started_at: NOW.toISOString(), completed_at: null })),
    });
    expect(snapshot.status).toBe("paused");
    expect(snapshot.emergencyPauseActive).toBe(true);
    expect(codes(snapshot)).toContain("SYNC_PAUSED");
  });

  it("flags stale and very-stale mirrors at the configured thresholds", () => {
    const staleAt = new Date(NOW.getTime() - (SYNC_STALE_WARN_MS + 60 * 1000));
    const veryStaleAt = new Date(NOW.getTime() - (SYNC_STALE_CRITICAL_MS + 60 * 1000));
    const snapshot = computeSyncHealth({
      now: NOW,
      emergencyPauseActive: false,
      windowHours: WINDOW_HOURS,
      recentRuns: [
        ...healthyRuns().filter((r) => r.resource_type !== "accounts" && r.resource_type !== "products"),
        run({ resource_type: "accounts", started_at: new Date(staleAt.getTime() - 60000).toISOString(), completed_at: staleAt.toISOString() }),
        run({ resource_type: "products", started_at: new Date(veryStaleAt.getTime() - 60000).toISOString(), completed_at: veryStaleAt.toISOString() }),
      ],
    });
    expect(snapshot.resources.find((r) => r.resourceType === "accounts")?.freshness).toBe("stale");
    expect(snapshot.resources.find((r) => r.resourceType === "products")?.freshness).toBe("very_stale");
    expect(codes(snapshot)).toContain("STALE_MIRROR");
    expect(codes(snapshot)).toContain("MIRROR_VERY_STALE");
    expect(snapshot.status).toBe("critical");
  });

  it("escalates to REPEATED_FAILURES after the failure-streak threshold", () => {
    const runs = healthyRuns()
      .filter((r) => r.resource_type !== "checks")
      .concat(
        Array.from({ length: FAILURE_STREAK_THRESHOLD }, (_, i) =>
          run({
            resource_type: "checks",
            status: "failed",
            started_at: new Date(NOW.getTime() - i * 5 * 60 * 1000).toISOString(),
            completed_at: null,
          }),
        ),
      );
    const snapshot = computeSyncHealth({ now: NOW, emergencyPauseActive: false, windowHours: WINDOW_HOURS, recentRuns: runs });
    const checks = snapshot.resources.find((r) => r.resourceType === "checks");
    expect(checks?.consecutiveFailures).toBe(FAILURE_STREAK_THRESHOLD);
    expect(codes(snapshot)).toContain("REPEATED_FAILURES");
    expect(snapshot.status).toBe("critical");
  });

  it("surfaces an open retry-governance circuit with its ladder state", () => {
    const openUntil = new Date(NOW.getTime() + 30 * 60 * 1000).toISOString();
    const runs = healthyRuns().concat(
      run({
        resource_type: "purchase_bills",
        status: "partial",
        started_at: new Date(NOW.getTime() - 10 * 60 * 1000).toISOString(),
        completed_at: new Date(NOW.getTime() - 9 * 60 * 1000).toISOString(),
        request_metadata: { retry_governance: { attempts: 3, consecutive_no_progress: 2, open_until: openUntil } },
      }),
    );
    const snapshot = computeSyncHealth({ now: NOW, emergencyPauseActive: false, windowHours: WINDOW_HOURS, recentRuns: runs });
    const bills = snapshot.resources.find((r) => r.resourceType === "purchase_bills");
    expect(bills?.circuitOpenUntil).toBe(openUntil);
    expect(bills?.attemptsObserved).toBe(3);
    expect(bills?.consecutiveNoProgress).toBe(2);
    expect(codes(snapshot)).toContain("RETRY_CIRCUIT_OPEN");
    // A closed (expired) window must NOT surface.
    const expired = healthyRuns().concat(
      run({
        resource_type: "purchase_bills",
        status: "partial",
        request_metadata: { retry_governance: { attempts: 5, consecutive_no_progress: 3, open_until: "2026-08-20T00:00:00.000Z" } },
      }),
    );
    const calm = computeSyncHealth({ now: NOW, emergencyPauseActive: false, windowHours: WINDOW_HOURS, recentRuns: expired });
    expect(calm.resources.find((r) => r.resourceType === "purchase_bills")?.circuitOpenUntil).toBeNull();
  });

  it("flags a hung runner past the stale-run reap window", () => {
    const stuckSince = new Date(NOW.getTime() - (HUNG_RUNNER_MS + 60 * 1000)).toISOString();
    const runs = healthyRuns().filter((r) => r.resource_type !== "contacts").concat(
      run({ resource_type: "contacts", status: "running", started_at: stuckSince, completed_at: null }),
    );
    const snapshot = computeSyncHealth({ now: NOW, emergencyPauseActive: false, windowHours: WINDOW_HOURS, recentRuns: runs });
    const contacts = snapshot.resources.find((r) => r.resourceType === "contacts");
    expect(contacts?.hungRunner).toBe(true);
    expect(codes(snapshot)).toContain("HUNG_RUNNER");
    expect(snapshot.status).toBe("critical");
  });

  it("flags statement-refresh lag as the queue-starvation signal (only when not paused)", () => {
    const laggedAt = new Date(NOW.getTime() - (STATEMENT_REFRESH_WARN_MS + 60 * 1000));
    const runs = healthyRuns().filter((r) => r.resource_type !== "transaction_history_items").concat(
      run({ resource_type: "transaction_history_items", started_at: new Date(laggedAt.getTime() - 60000).toISOString(), completed_at: laggedAt.toISOString() }),
    );
    const lagging = computeSyncHealth({ now: NOW, emergencyPauseActive: false, windowHours: WINDOW_HOURS, recentRuns: runs });
    expect(codes(lagging)).toContain("STATEMENT_REFRESH_LAG");

    // While paused the lag is expected, not an anomaly.
    const pausedLag = computeSyncHealth({ now: NOW, emergencyPauseActive: true, windowHours: WINDOW_HOURS, recentRuns: runs });
    expect(codes(pausedLag)).not.toContain("STATEMENT_REFRESH_LAG");
  });

  it("never reports a healthy snapshot below degraded when alerts exist and ok only when none do", () => {
    const oneWarning = healthyRuns().filter((r) => r.resource_type !== "sales_invoices").concat(
      run({ resource_type: "sales_invoices", status: "partial", completed_at: null }),
    );
    const degraded = computeSyncHealth({ now: NOW, emergencyPauseActive: false, windowHours: WINDOW_HOURS, recentRuns: oneWarning });
    expect(degraded.status).toBe("degraded");
    expect(degraded.alerts.every((alert) => alert.severity === "warning")).toBe(true);
  });

  it("sorts resources deterministically regardless of input row order", () => {
    const shuffled = [...healthyRuns()].reverse();
    const snapshot = computeSyncHealth({ now: NOW, emergencyPauseActive: false, windowHours: WINDOW_HOURS, recentRuns: shuffled });
    expect(snapshot.resources.map((r) => r.resourceType)).toEqual([
      "accounts", "contacts", "products", "sales_invoices", "purchase_bills", "checks",
    ]);
  });
});
