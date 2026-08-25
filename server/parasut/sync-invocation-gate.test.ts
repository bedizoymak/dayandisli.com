// Regression tests for execution-source classification on parasut-sync-run
// (server/parasut/sync-invocation-gate.ts). Encodes the required behavior:
//
//   PARASUT_SYNC_EMERGENCY_PAUSE=true (the fail-safe default):
//     cron invocation                        → BLOCKED (paused)
//     scheduled statement-refresh invocation → BLOCKED (paused)
//     background/CLI-style invocation        → BLOCKED (403, unproven source)
//     unknown invocation                     → BLOCKED (403)
//   pause=false:
//     proven-scheduled invocation            → ALLOWED
//     everything else                        → still 403 (fail closed never
//                                              relaxes with the pause)
//
// Manual ERP admin synchronization is intentionally NOT part of this gate —
// it lives exclusively on parasut-write-api ("resync"/"full-resync") behind
// Supabase-JWT + erp_users admin verification; see handlers.test.ts there and
// the frontend contract guard in architecture-integration-guards.test.ts.
import { describe, expect, it } from "vitest";
import { classifyInvocationSource, gateScheduledInvocation, timingSafeEqual } from "./sync-invocation-gate.ts";

const SECRET = "cron-secret-0123456789abcdef";
const scheduled = {
  triggerHeader: "scheduled",
  secretHeader: SECRET,
  configuredSecret: SECRET,
};

describe("sync invocation gate: pause behavior (fail-safe default PAUSED)", () => {
  it("cron invocation is BLOCKED while the emergency pause is active", () => {
    const decision = gateScheduledInvocation({ ...scheduled, emergencyPauseActive: true });
    expect(decision.verdict).toBe("paused");
  });

  it("scheduled statement-refresh invocation is BLOCKED while paused", () => {
    // statement-refresh rides the same entrypoint + proof headers; the gate
    // sees only the transport-level classification.
    const decision = gateScheduledInvocation({ ...scheduled, emergencyPauseActive: true });
    expect(decision.verdict).toBe("paused");
  });

  it("background/CLI-style invocation with no headers is BLOCKED even while paused", () => {
    const decision = gateScheduledInvocation({
      triggerHeader: null,
      secretHeader: null,
      configuredSecret: SECRET,
      emergencyPauseActive: true,
    });
    expect(decision).toEqual({ verdict: "reject", httpStatus: 403, reason: "unauthorized_execution_source" });
  });

  it("unknown trigger value is BLOCKED even while paused", () => {
    const decision = gateScheduledInvocation({
      triggerHeader: "manual",
      secretHeader: SECRET,
      configuredSecret: SECRET,
      emergencyPauseActive: true,
    });
    expect(decision.verdict).toBe("reject");
  });

  it("a client-supplied 'manual' marker can NEVER bypass the pause via this entrypoint", () => {
    const decision = gateScheduledInvocation({
      triggerHeader: "manual",
      secretHeader: SECRET,
      configuredSecret: SECRET,
      emergencyPauseActive: false,
    });
    expect(decision.verdict).toBe("reject");
  });
});

describe("sync invocation gate: shared-secret proof", () => {
  it("missing secret header is rejected", () => {
    const decision = gateScheduledInvocation({
      triggerHeader: "scheduled",
      secretHeader: null,
      configuredSecret: SECRET,
      emergencyPauseActive: false,
    });
    expect(decision.verdict).toBe("reject");
  });

  it("wrong secret header is rejected", () => {
    const decision = gateScheduledInvocation({
      triggerHeader: "scheduled",
      secretHeader: "wrong-secret",
      configuredSecret: SECRET,
      emergencyPauseActive: false,
    });
    expect(decision.verdict).toBe("reject");
  });

  it("unset server-side secret fails closed even if a caller guesses a value", () => {
    const source = classifyInvocationSource({
      triggerHeader: "scheduled",
      secretHeader: "anything",
      configuredSecret: null,
    });
    expect(source.kind).toBe("unknown");

    const decision = gateScheduledInvocation({
      triggerHeader: "scheduled",
      secretHeader: "anything",
      configuredSecret: "   ",
      emergencyPauseActive: false,
    });
    expect(decision.verdict).toBe("reject");
  });

  it("empty-string secret header is rejected without throwing on timing compare", () => {
    const source = classifyInvocationSource({
      triggerHeader: "scheduled",
      secretHeader: "",
      configuredSecret: SECRET,
    });
    expect(source.kind).toBe("unknown");
  });
});

describe("sync invocation gate: proven-scheduled execution after deliberate unpause", () => {
  it("authenticated-at-the-gateway scheduled invocation with the exact shared secret is ALLOWED once an operator lifts the pause", () => {
    const decision = gateScheduledInvocation({ ...scheduled, emergencyPauseActive: false });
    expect(decision.verdict).toBe("allow_scheduled");
  });
});

describe("timing-safe equality helper", () => {
  it("matches equal strings regardless of length class", () => {
    expect(timingSafeEqual(SECRET, SECRET)).toBe(true);
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("mismatches different strings of equal and unequal length", () => {
    expect(timingSafeEqual(SECRET, `${SECRET}x`)).toBe(false);
    expect(timingSafeEqual("a", "b")).toBe(false);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
  });
});
