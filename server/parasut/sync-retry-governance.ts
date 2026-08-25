/**
 * Cross-invocation retry governance for the Paraşüt sync engine.
 *
 * Closes the failure mode identified in the 2026-08-24 production incident
 * report (CLAUDE_CODE_PRODUCTION_SYNC_INCIDENT_REPORT.md): a resume chain
 * whose next page contains a persistently failing record re-attempted the
 * IDENTICAL work on every cron tick with zero backoff — the checkpoint for
 * a page with errors is intentionally never advanced (see sync-base.ts's
 * checkpointBlocked), so every subsequent invocation resumed at exactly the
 * same page, failed on exactly the same records, and left the run resumable
 * again — indefinitely (≈288 identical retries/day at the 5-minute cron).
 *
 * This module is PURE — no database, no clock, no I/O. All state lives in
 * the run's persisted request_metadata under RETRY_GOVERNANCE_METADATA_KEY
 * (a sibling of the resume checkpoint, carried across resumed invocations
 * explicitly by sync-base.ts, like chain_started_at). The engine applies
 * exponential backoff ONLY to attempts that made zero forward progress;
 * budget-bounded progress through a large backlog (maxPagesPerInvocation)
 * is healthy and never throttled. Delays are capped, so a chronically
 * poisoned chain still retries a few times per day and SELF-HEALS the
 * moment the underlying fault clears — no operator intervention, and the
 * open state is fully visible in sync_runs.request_metadata plus the
 * "circuit_open" SyncResult status surfaced by callers (Phase 1B health).
 */

export const RETRY_GOVERNANCE_METADATA_KEY = "retry_governance";

/** Delay before the 1st zero-progress re-attempt (n=1): 15 minutes. */
export const DEFAULT_RETRY_BASE_DELAY_MS = 15 * 60 * 1000;
/** Ceiling for the exponential schedule: 6 hours (~4 attempts/day worst case vs ~288 unthrottled). */
export const DEFAULT_RETRY_MAX_DELAY_MS = 6 * 60 * 60 * 1000;

/**
 * Persisted per logical resume chain (seeded from the source run into each
 * resumed run's request_metadata by sync-base.ts). All fields survive the
 * real database round-trip as plain JSON.
 */
export interface RetryGovernanceState {
  /** Total attempts of this logical chain (including the first). */
  attempts: number;
  /** Completed attempts that advanced the checkpoint by zero pages. */
  consecutive_no_progress: number;
  /** ISO timestamp of the most recent attempt's completion. */
  last_attempt_at: string | null;
  /** ISO timestamp before which zero-progress re-attempts are refused. Null = circuit closed. */
  open_until: string | null;
}

/**
 * Tolerant reader: returns null for absent/corrupt state (older runs,
 * hand-edited rows, schema drift) so governance can never hard-fail a sync
 * that used to work — an unreadable state simply means "no governance yet".
 */
export function readRetryGovernance(
  metadata: Record<string, unknown> | null | undefined,
): RetryGovernanceState | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = metadata[RETRY_GOVERNANCE_METADATA_KEY];
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const state = value as Record<string, unknown>;
  if (
    !Number.isInteger(state.attempts) ||
    (state.attempts as number) < 0 ||
    !Number.isInteger(state.consecutive_no_progress) ||
    (state.consecutive_no_progress as number) < 0 ||
    (state.last_attempt_at !== null && typeof state.last_attempt_at !== "string") ||
    (state.open_until !== null && typeof state.open_until !== "string")
  ) {
    return null;
  }
  return {
    attempts: state.attempts as number,
    consecutive_no_progress: state.consecutive_no_progress as number,
    last_attempt_at: (state.last_attempt_at as string | null) ?? null,
    open_until: (state.open_until as string | null) ?? null,
  };
}

/**
 * Exponential backoff for the nth CONSECUTIVE zero-progress attempt:
 * base * 2^(n-1), capped at max. n=1 → base, n=2 → 2×base, … capped.
 */
export function retryDelayMs(
  consecutiveNoProgress: number,
  baseDelayMs: number = DEFAULT_RETRY_BASE_DELAY_MS,
  maxDelayMs: number = DEFAULT_RETRY_MAX_DELAY_MS,
): number {
  const n = Math.max(1, Math.floor(consecutiveNoProgress));
  const uncapped = baseDelayMs * 2 ** (n - 1);
  return Math.min(uncapped, maxDelayMs);
}

export function isCircuitOpen(
  state: RetryGovernanceState | null,
  now: Date,
): boolean {
  if (!state?.open_until) return false;
  const openUntil = Date.parse(state.open_until);
  if (!Number.isFinite(openUntil)) return false;
  return now.getTime() < openUntil;
}

export interface RecordAttemptInput {
  /** Governance state carried from the source run (null on a fresh chain). */
  previous: RetryGovernanceState | null;
  /** True when this attempt advanced the checkpoint past where the chain started. */
  madeProgress: boolean;
  /** Terminal status of THIS attempt ("completed" closes the chain). */
  status: "completed" | "partial" | "failed";
  now: Date;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

/**
 * Fold one finished attempt into the chain's governance state. A completed
 * chain resets fully; ANY progress resets the backoff ladder (the chain is
 * moving, just budget-bound); zero progress climbs the ladder and opens the
 * circuit until now + delay.
 */
export function recordAttempt(input: RecordAttemptInput): RetryGovernanceState {
  const attempts = (input.previous?.attempts ?? 0) + 1;
  const lastAttemptAt = input.now.toISOString();

  if (input.status === "completed") {
    return { attempts, consecutive_no_progress: 0, last_attempt_at: lastAttemptAt, open_until: null };
  }

  if (input.madeProgress) {
    return {
      attempts,
      consecutive_no_progress: 0,
      last_attempt_at: lastAttemptAt,
      // Progress disproves the poisoned-chain assumption: reopen the
      // circuit immediately so the next tick continues the (healthy,
      // budget-bounded) traversal instead of waiting out a stale window.
      open_until: null,
    };
  }

  const consecutiveNoProgress = (input.previous?.consecutive_no_progress ?? 0) + 1;
  const delayMs = retryDelayMs(
    consecutiveNoProgress,
    input.baseDelayMs,
    input.maxDelayMs,
  );
  return {
    attempts,
    consecutive_no_progress: consecutiveNoProgress,
    last_attempt_at: lastAttemptAt,
    open_until: new Date(input.now.getTime() + delayMs).toISOString(),
  };
}
