import {
  createCompletedExecutionEnvelope,
  createFailedExecutionEnvelope,
  type CompletedExecutionEnvelope,
} from "./execution-result-envelope.ts";
import type { ExecutionFailureReport } from "./execution-failure-report.ts";
import type {
  SupportedSyncResource,
  SyncExecutionPlan,
} from "./sync-execution-plan.ts";

export interface CompletedExecutionComposition<Report> {
  outcome: "completed";
  envelope: CompletedExecutionEnvelope;
  reports: Report[];
}

export interface FailedExecutionComposition<Report> {
  outcome: "failed";
  envelope: ExecutionFailureReport;
  reports: Report[];
  originalError: unknown;
}

export type ExecutionResultComposition<Report> =
  | CompletedExecutionComposition<Report>
  | FailedExecutionComposition<Report>;

export async function composeExecutionResults<Report>(
  plan: SyncExecutionPlan,
  executeResource: (
    resource: SupportedSyncResource,
  ) => Report | Promise<Report>,
): Promise<ExecutionResultComposition<Report>> {
  const reports: Report[] = [];
  const completedResources: SupportedSyncResource[] = [];

  for (const resource of plan.resources) {
    try {
      const report = await executeResource(resource);
      reports.push(report);
      completedResources.push(resource);
    } catch (error) {
      return {
        outcome: "failed",
        envelope: createFailedExecutionEnvelope({
          plan,
          completedResources,
          failedResource: resource,
          error,
        }),
        reports: [...reports],
        originalError: error,
      };
    }
  }

  return {
    outcome: "completed",
    envelope: createCompletedExecutionEnvelope(plan),
    reports: [...reports],
  };
}
