const DEFAULT_STALE_THRESHOLD_MINUTES = 30;
const RECOVERY_REASON = "stale_running_timeout";

interface RecoveryRun {
  id: string;
  company_id: string;
  parasut_company_id: string;
  resource_type: string;
  status: string;
  completed_at: string | null;
  page_count: number;
  request_metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface DatabaseResult<T> {
  data: T | null;
  error: { message?: string } | null;
}

interface RecoveryQuery<T> extends PromiseLike<DatabaseResult<T>> {
  select(columns?: string): RecoveryQuery<T>;
  update(values: unknown): RecoveryQuery<T>;
  eq(column: string, value: unknown): RecoveryQuery<T>;
  is(column: string, value: null): RecoveryQuery<T>;
  lt(column: string, value: string): RecoveryQuery<T>;
}

export interface RecoveryDatabase {
  schema(name: string): RecoveryDatabase;
  from<T = unknown>(table: "sync_runs"): RecoveryQuery<T>;
}

const INTEGRATION_SCHEMA = "parasut";

export interface RecoverStaleRunsOptions {
  thresholdMinutes?: number;
  now?: Date;
  companyId?: string;
  parasutCompanyId?: string;
}

export interface RecoverStaleRunsResult {
  cutoff: string;
  detectedRunIds: string[];
  recoveredRunIds: string[];
  skippedRunIds: string[];
}

function positiveThreshold(value: number | undefined): number {
  const threshold = value ?? DEFAULT_STALE_THRESHOLD_MINUTES;
  if (!Number.isFinite(threshold) || threshold <= 0) {
    throw new Error("Stale run threshold must be a positive number");
  }
  return threshold;
}

/**
 * A stuck run's own request_metadata.resume.last_completed_page (advanced by
 * persistPageThenCheckpoint after every committed page) is always at least
 * as accurate as page_count (only ever written once, by completeRun — which
 * never ran for a run stuck in "running"). Prefer it; fall back to
 * page_count only if the checkpoint metadata was never initialized.
 */
function lastCheckpointedPage(run: RecoveryRun): number {
  const resume = run.request_metadata?.resume;
  if (resume && typeof resume === "object" && !Array.isArray(resume)) {
    const value = (resume as Record<string, unknown>).last_completed_page;
    if (Number.isInteger(value) && (value as number) >= 0) return value as number;
  }
  return Number.isInteger(run.page_count) ? run.page_count : 0;
}

function recoveryMetadata(
  run: RecoveryRun,
  recoveredAt: string,
  thresholdMinutes: number,
): Record<string, unknown> {
  const originalResume = run.request_metadata?.resume;
  const priorResume =
    originalResume && typeof originalResume === "object" && !Array.isArray(originalResume)
      ? (originalResume as Record<string, unknown>)
      : {};

  return {
    ...run.request_metadata,
    recovery: {
      reason: RECOVERY_REASON,
      recovered_at: recoveredAt,
      threshold_minutes: thresholdMinutes,
      previous_status: "running",
    },
    resume: {
      ...priorResume,
      contract_version: 1,
      eligible: true,
      source_run_id: run.id,
      resource_type: run.resource_type,
      last_completed_page: lastCheckpointedPage(run),
    },
  };
}

export async function recoverStaleRuns(
  database: RecoveryDatabase,
  options: RecoverStaleRunsOptions = {},
): Promise<RecoverStaleRunsResult> {
  const thresholdMinutes = positiveThreshold(options.thresholdMinutes);
  const now = options.now ?? new Date();
  const recoveredAt = now.toISOString();
  const cutoff = new Date(
    now.getTime() - thresholdMinutes * 60 * 1000,
  ).toISOString();

  const scoped = database.schema(INTEGRATION_SCHEMA);

  let query = scoped
    .from<RecoveryRun[]>("sync_runs")
    .select(
      "id,company_id,parasut_company_id,resource_type,status,completed_at,page_count,request_metadata,created_at,updated_at",
    )
    .eq("status", "running")
    .is("completed_at", null)
    // Heartbeat-based, not started_at-based: updated_at is touched by the
    // erp_set_updated_at trigger on every persistCheckpoint/completeRun
    // UPDATE, so a run that's still actively progressing (even if it's been
    // running a while) is never mistaken for stale — only a row with no
    // progress for the full threshold is.
    .lt("updated_at", cutoff);

  if (options.companyId) query = query.eq("company_id", options.companyId);
  if (options.parasutCompanyId) {
    query = query.eq("parasut_company_id", options.parasutCompanyId);
  }

  const candidates = await query;
  if (candidates.error) {
    throw new Error(candidates.error.message ?? "Stale sync-run lookup failed");
  }

  const runs = candidates.data ?? [];
  const recoveredRunIds: string[] = [];
  const skippedRunIds: string[] = [];

  for (const run of runs) {
    const update = await scoped
      .from<RecoveryRun[]>("sync_runs")
      .update({
        // "partial", not "failed" — a recovered run's checkpoint (if any
        // pages were committed) is exactly as trustworthy as a clean
        // maxPagesPerInvocation stop, so it's resumable without the
        // acceptPageDriftRisk gate decideSyncResume requires for "failed".
        status: "partial",
        completed_at: recoveredAt,
        request_metadata: recoveryMetadata(run, recoveredAt, thresholdMinutes),
      })
      .eq("id", run.id)
      .eq("status", "running")
      .is("completed_at", null)
      .select("id");

    if (update.error) {
      throw new Error(update.error.message ?? "Stale sync-run recovery failed");
    }

    if ((update.data ?? []).length === 1) recoveredRunIds.push(run.id);
    else skippedRunIds.push(run.id);
  }

  return {
    cutoff,
    detectedRunIds: runs.map((run) => run.id),
    recoveredRunIds,
    skippedRunIds,
  };
}

export { DEFAULT_STALE_THRESHOLD_MINUTES };
