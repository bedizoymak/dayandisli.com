/**
 * PHASE 1B — Sync health model (pure, no I/O).
 *
 * Computes a machine-readable health snapshot for the Paraşüt mirror sync
 * from data that already exists: recent `parasut.sync_runs` rows plus the
 * project-wide emergency-pause flag (all edge functions in one Supabase
 * project share secrets, so parasut-api can read the same
 * PARASUT_SYNC_EMERGENCY_PAUSE value parasut-sync-run gates on — no new
 * tables, no cross-function calls, no writes while paused).
 *
 * Detectable conditions (remediation mandate 1B):
 *   paused                      emergency pause active right now
 *   last successful sync        per-resource recency of status='completed'
 *   stale mirror                freshness thresholds breached per resource
 *   failed sync                 latest run per resource is failed/partial
 *   repeatedly failing          trailing failure streak ≥ threshold
 *   excessive retry rate        retry-governance ladder open/climbing
 *   hung runner                 a run stuck 'running' past the reap window
 *   queue starvation            statement-refresh cadence lagged/stalled
 *
 * Consumers: supabase/functions/parasut-api handleSyncStatus attaches this
 * to every sync-status response (`health` field) behind the existing
 * `parasut.sync.view` authorization — machine-readable JSON is the
 * contract; a UI surface can render it without any new backend work.
 */

export const SYNC_STALE_WARN_MS = 30 * 60 * 1000;
export const SYNC_STALE_CRITICAL_MS = 2 * 60 * 60 * 1000;
/** The statement-refresh cron fires every minute; an hour of silence means stalled. */
export const STATEMENT_REFRESH_WARN_MS = 60 * 60 * 1000;
/** sync-base reaps 'running' rows after 10 min; seeing one older than this live means the reaper is not coping. */
export const HUNG_RUNNER_MS = 15 * 60 * 1000;
export const FAILURE_STREAK_THRESHOLD = 3;
/** consecutive_no_progress at/above this surfaces as an explicit alert even before delays cap out. */
export const RETRY_LADDER_ATTENTION_CONSECUTIVE = 2;

/** Structural subset of a sync_runs row the model needs (JSON-safe). */
export interface SyncRunHealthInput {
  resource_type: string;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  request_metadata?: Record<string, unknown> | null;
}

export type Freshness = "fresh" | "stale" | "very_stale" | "never_synced";

export interface ResourceHealth {
  resourceType: string;
  latestStatus: string | null;
  latestStartedAt: string | null;
  lastSuccessfulSyncAt: string | null;
  secondsSinceLastSuccess: number | null;
  freshness: Freshness;
  /** Trailing streak of failed/partial runs inside the observation window. */
  consecutiveFailures: number;
  /** ISO backoff boundary when the newest resumable chain's circuit is open; else null. */
  circuitOpenUntil: string | null;
  attemptsObserved: number | null;
  consecutiveNoProgress: number | null;
  hungRunner: boolean;
}

export interface HealthAlert {
  code:
    | "SYNC_PAUSED"
    | "STALE_MIRROR"
    | "MIRROR_VERY_STALE"
    | "LAST_RUN_FAILED"
    | "REPEATED_FAILURES"
    | "RETRY_CIRCUIT_OPEN"
    | "HUNG_RUNNER"
    | "STATEMENT_REFRESH_LAG"
    | "NEVER_SYNCED";
  severity: "warning" | "critical";
  resourceType: string | null;
  message: string;
}

export interface SyncHealthSnapshot {
  status: "paused" | "ok" | "degraded" | "critical";
  checkedAt: string;
  emergencyPauseActive: boolean;
  windowHours: number;
  resources: ResourceHealth[];
  alerts: HealthAlert[];
}

const RESOURCE_TYPES = [
  "accounts",
  "contacts",
  "products",
  "sales_invoices",
  "purchase_bills",
  "checks",
] as const;

function readGovernance(metadata: Record<string, unknown> | null | undefined): {
  openUntil: string | null;
  attempts: number | null;
  consecutiveNoProgress: number | null;
} {
  const value = metadata?.["retry_governance"];
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { openUntil: null, attempts: null, consecutiveNoProgress: null };
  }
  const state = value as Record<string, unknown>;
  return {
    openUntil: typeof state.open_until === "string" ? state.open_until : null,
    attempts: Number.isInteger(state.attempts) ? (state.attempts as number) : null,
    consecutiveNoProgress: Number.isInteger(state.consecutive_no_progress)
      ? (state.consecutive_no_progress as number)
      : null,
  };
}

function freshnessOf(
  secondsSinceLastSuccess: number | null,
): Freshness {
  if (secondsSinceLastSuccess === null) return "never_synced";
  if (secondsSinceLastSuccess >= SYNC_STALE_CRITICAL_MS / 1000) return "very_stale";
  if (secondsSinceLastSuccess >= SYNC_STALE_WARN_MS / 1000) return "stale";
  return "fresh";
}

/**
 * Pure computation. `recentRuns` must be the bounded observation window
 * (newest first is NOT required — the model sorts internally), typically
 * the trailing 24h capped at ~200 rows by the caller.
 */
export function computeSyncHealth(input: {
  now: Date;
  emergencyPauseActive: boolean;
  windowHours: number;
  recentRuns: SyncRunHealthInput[];
}): SyncHealthSnapshot {
  const nowMs = input.now.getTime();
  const alerts: HealthAlert[] = [];
  const push = (alert: HealthAlert) => alerts.push(alert);

  const runsByResource = new Map<string, SyncRunHealthInput[]>();
  for (const run of input.recentRuns) {
    const list = runsByResource.get(run.resource_type) ?? [];
    list.push(run);
    runsByResource.set(run.resource_type, list);
  }
  for (const list of runsByResource.values()) {
    // Normalize to newest-first regardless of caller ordering.
    list.sort((a, b) =>
      (b.started_at ?? "") > (a.started_at ?? "") ? 1 : (b.started_at ?? "") < (a.started_at ?? "") ? -1 : 0,
    );
  }

  const resources: ResourceHealth[] = RESOURCE_TYPES.map((resourceType) => {
    const runs = runsByResource.get(resourceType) ?? [];
    const latest = runs[0] ?? null;

    let lastSuccessfulSyncAt: string | null = null;
    for (const run of runs) {
      if (run.status === "completed" && run.completed_at) {
        lastSuccessfulSyncAt = run.completed_at;
        break;
      }
    }
    const secondsSinceLastSuccess = lastSuccessfulSyncAt
      ? Math.max(0, Math.floor((nowMs - Date.parse(lastSuccessfulSyncAt)) / 1000))
      : null;

    let consecutiveFailures = 0;
    for (const run of runs) {
      if (run.status === "failed" || run.status === "partial") consecutiveFailures++;
      else break;
    }

    const newestWithLadder = runs.find((run) => readGovernance(run.request_metadata).openUntil !== null);
    const governance = newestWithLadder ? readGovernance(newestWithLadder.request_metadata) : null;
    const circuitOpenUntil =
      governance?.openUntil && Date.parse(governance.openUntil) > nowMs ? governance.openUntil : null;

    const hungRunner =
      latest?.status === "running" &&
      !!latest.started_at &&
      nowMs - Date.parse(latest.started_at) > HUNG_RUNNER_MS;

    const freshness = freshnessOf(secondsSinceLastSuccess);

    if (freshness === "very_stale") {
      push({
        code: "MIRROR_VERY_STALE",
        severity: "critical",
        resourceType,
        message: `No successful ${resourceType} sync for ${Math.round((secondsSinceLastSuccess ?? 0) / 60)} minutes.`,
      });
    } else if (freshness === "stale") {
      push({
        code: "STALE_MIRROR",
        severity: "warning",
        resourceType,
        message: `${resourceType} last synced ${Math.round((secondsSinceLastSuccess ?? 0) / 60)} minutes ago.`,
      });
    } else if (freshness === "never_synced") {
      push({
        code: "NEVER_SYNCED",
        severity: "warning",
        resourceType,
        message: `No completed ${resourceType} run inside the ${input.windowHours}h window.`,
      });
    }

    if (latest && (latest.status === "failed" || latest.status === "partial")) {
      if (consecutiveFailures >= FAILURE_STREAK_THRESHOLD) {
        push({
          code: "REPEATED_FAILURES",
          severity: "critical",
          resourceType,
          message: `${resourceType} has ${consecutiveFailures} consecutive unsuccessful runs (latest: ${latest.status}).`,
        });
      } else {
        push({
          code: "LAST_RUN_FAILED",
          severity: "warning",
          resourceType,
          message: `Latest ${resourceType} run ended '${latest.status}'.`,
        });
      }
    }

    if (circuitOpenUntil) {
      push({
        code: "RETRY_CIRCUIT_OPEN",
        severity: "warning",
        resourceType,
        message: `${resourceType} retry circuit open until ${circuitOpenUntil}` +
          (governance?.attempts != null ? ` (attempt ${governance.attempts}` : "") +
          (governance?.consecutiveNoProgress != null
            ? `, ${governance.consecutiveNoProgress} zero-progress retries)`
            : ")") +
          ".",
      });
      if ((governance?.consecutiveNoProgress ?? 0) >= RETRY_LADDER_ATTENTION_CONSECUTIVE) {
        push({
          code: "RETRY_CIRCUIT_OPEN",
          severity: "warning",
          resourceType,
          message: `${resourceType} made ${governance?.consecutiveNoProgress} consecutive zero-progress attempts — investigate sync_errors for the poisoned record.`,
        });
      }
    }

    if (hungRunner) {
      push({
        code: "HUNG_RUNNER",
        severity: "critical",
        resourceType,
        message: `${resourceType} has a run stuck 'running' since ${latest?.started_at} — past the stale-run reap window.`,
      });
    }

    return {
      resourceType,
      latestStatus: latest?.status ?? null,
      latestStartedAt: latest?.started_at ?? null,
      lastSuccessfulSyncAt,
      secondsSinceLastSuccess,
      freshness,
      consecutiveFailures,
      circuitOpenUntil,
      attemptsObserved: governance?.attempts ?? null,
      consecutiveNoProgress: governance?.consecutiveNoProgress ?? null,
      hungRunner,
    };
  });

  // Statement refresh rides the transaction_history_items resource on its
  // own 1-minute cron; its lag doubles as the queue-starvation signal.
  const statementRuns = runsByResource.get("transaction_history_items") ?? [];
  const statementLatest = statementRuns[0] ?? null;
  let statementLastSuccessAt: string | null = null;
  for (const run of statementRuns) {
    if (run.status === "completed" && run.completed_at) {
      statementLastSuccessAt = run.completed_at;
      break;
    }
  }
  const secondsSinceStatement =
    statementLastSuccessAt !== null
      ? Math.max(0, Math.floor((nowMs - Date.parse(statementLastSuccessAt)) / 1000))
      : null;
  if (!input.emergencyPauseActive && (secondsSinceStatement === null || secondsSinceStatement > STATEMENT_REFRESH_WARN_MS / 1000)) {
    push({
      code: "STATEMENT_REFRESH_LAG",
      severity: "warning",
      resourceType: "transaction_history_items",
      message:
        secondsSinceStatement === null
          ? `No completed statement refresh inside the ${input.windowHours}h window — customer statements will fail closed.`
          : `Statement refresh lagging: last success ${Math.round(secondsSinceStatement / 60)} minutes ago.`,
    });
  }

  let status: SyncHealthSnapshot["status"] = "ok";
  if (alerts.some((alert) => alert.severity === "critical")) status = "critical";
  else if (alerts.length > 0) status = "degraded";

  if (input.emergencyPauseActive) {
    status = "paused";
    push({
      code: "SYNC_PAUSED",
      severity: "critical",
      resourceType: null,
      message: "PARASUT_SYNC_EMERGENCY_PAUSE is active — all sync actions are refusing to run.",
    });
  }

  return {
    status,
    checkedAt: input.now.toISOString(),
    emergencyPauseActive: input.emergencyPauseActive,
    windowHours: input.windowHours,
    resources,
    alerts,
  };
}
