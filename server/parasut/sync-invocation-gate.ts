// Execution-source classification for the ONE automatic Paraşüt sync
// entrypoint (supabase/functions/parasut-sync-run).
//
// Why this exists: PARASUT_SYNC_EMERGENCY_PAUSE was deliberately designed as
// a global kill switch — before this module, the entrypoint returned
// 200 {status:"paused"} to EVERY caller (cron, CLI, anonymous internet)
// without any authentication at all, and its only scheduled-source proof
// (the X-Sync-Trigger header plus the PUBLIC publishable API key) could be
// forged by anyone. Lifting the pause would therefore have exposed the full
// six-resource sync, statement refresh and history backfill to arbitrary
// unauthenticated callers.
//
// Execution-source model (fail closed):
//   cron / scheduled statement-refresh / background  → proven via shared
//     secret (X-Sync-Secret must equal the PARASUT_SYNC_CRON_SECRET edge
//     secret); STILL blocked while the emergency pause is active.
//   manual ERP admin requests → NEVER enter this entrypoint. They live
//     exclusively on parasut-write-api ("resync"/"full-resync"), which
//     verifies the Supabase JWT and an active erp_users admin server-side
//     and may execute despite the automatic pause by design. This module
//     intentionally has no notion of "manual" so the manual path cannot
//     proliferate onto a second surface.
//   unknown / forged / malformed sources → REJECTED (403), pause active or
//     not. Absent or empty configured secret also fails closed.
//
// Pure logic on purpose: importable by both the Deno edge function and the
// vitest suite so the decision table stays under regression test.
export interface InvocationProofInput {
  /** X-Sync-Trigger request header (forgeable on its own — never trusted alone). */
  triggerHeader: string | null;
  /** X-Sync-Secret request header — must equal the configured shared secret. */
  secretHeader: string | null;
  /** Server-side PARASUT_SYNC_CRON_SECRET edge secret (never sent to clients). */
  configuredSecret: string | null;
}

export type InvocationSource = { kind: "scheduled" } | { kind: "unknown" };

export type ScheduledInvocationDecision =
  | { verdict: "reject"; httpStatus: 403; reason: "unauthorized_execution_source" }
  | { verdict: "paused" }
  | { verdict: "allow_scheduled" };

/** Constant-time string equality — no early exit on first differing byte. */
export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  const length = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

/**
 * Classifies the caller. Only a request that presents BOTH the scheduled
 * trigger marker AND the exact configured shared secret counts as
 * "scheduled"; everything else — including a matching secret with the wrong
 * trigger, a matching trigger with no/wrong secret, or a completely unset
 * server-side secret — is "unknown".
 */
export function classifyInvocationSource(input: InvocationProofInput): InvocationSource {
  const configured = input.configuredSecret?.trim() ?? "";
  if (!configured) return { kind: "unknown" };
  if (input.triggerHeader !== "scheduled") return { kind: "unknown" };
  const presented = input.secretHeader ?? "";
  if (!presented || !timingSafeEqual(presented, configured)) return { kind: "unknown" };
  return { kind: "scheduled" };
}

/**
 * Single decision point for parasut-sync-run. Order of evaluation is part
 * of the security contract:
 *   1. unprovable sources are rejected outright (fail closed — even while
 *      paused, so anonymous callers learn nothing and can never ride out a
 *      future unpause),
 *   2. proven-scheduled callers still hit the emergency pause (automatic
 *      execution remains blocked until an operator deliberately lifts it),
 *   3. only then may the scheduled run proceed.
 */
export function gateScheduledInvocation(
  input: InvocationProofInput & { emergencyPauseActive: boolean },
): ScheduledInvocationDecision {
  const source = classifyInvocationSource(input);
  if (source.kind === "unknown") {
    return { verdict: "reject", httpStatus: 403, reason: "unauthorized_execution_source" };
  }
  if (input.emergencyPauseActive) return { verdict: "paused" };
  return { verdict: "allow_scheduled" };
}
