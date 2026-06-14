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
  from<T = unknown>(table: "parasut_sync_runs"): RecoveryQuery<T>;
}

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

function recoveryMetadata(
  run: RecoveryRun,
  recoveredAt: string,
  thresholdMinutes: number,
): Record<string, unknown> {
  return {
    ...run.request_metadata,
    recovery: {
      reason: RECOVERY_REASON,
      recovered_at: recoveredAt,
      threshold_minutes: thresholdMinutes,
      previous_status: "running",
    },
    resume: {
      eligible: true,
      source_run_id: run.id,
      resource_type: run.resource_type,
      last_completed_page: run.page_count,
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

  let query = database
    .from<RecoveryRun[]>("parasut_sync_runs")
    .select(
      "id,company_id,parasut_company_id,resource_type,status,completed_at,page_count,request_metadata,created_at",
    )
    .eq("status", "running")
    .is("completed_at", null)
    .lt("created_at", cutoff);

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
    const update = await database
      .from<RecoveryRun[]>("parasut_sync_runs")
      .update({
        status: "failed",
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
