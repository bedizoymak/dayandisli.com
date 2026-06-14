import {
  createExecutionFailureReport,
  type ExecutionFailureReport,
} from "./execution-failure-report.ts";
import type {
  SupportedSyncResource,
  SyncExecutionPlan,
} from "./sync-execution-plan.ts";

export interface CompletedExecutionEnvelope {
  status: "completed";
  mode: SyncExecutionPlan["mode"];
  planned_count: number;
  completed_count: number;
  completed_resources: SupportedSyncResource[];
}

export type ExecutionResultEnvelope =
  | CompletedExecutionEnvelope
  | ExecutionFailureReport;

export function createCompletedExecutionEnvelope(
  plan: SyncExecutionPlan,
): CompletedExecutionEnvelope {
  return {
    status: "completed",
    mode: plan.mode,
    planned_count: plan.count,
    completed_count: plan.resources.length,
    completed_resources: [...plan.resources],
  };
}

export function createFailedExecutionEnvelope(input: {
  plan: SyncExecutionPlan;
  completedResources: readonly SupportedSyncResource[];
  failedResource: SupportedSyncResource;
  error: unknown;
}): ExecutionFailureReport {
  return createExecutionFailureReport(input);
}
