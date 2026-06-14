import {
  createErrorSummary,
  type ErrorSummary,
} from "./sync-observability.ts";
import type {
  SupportedSyncResource,
  SyncExecutionPlan,
} from "./sync-execution-plan.ts";

export interface ExecutionFailureReport {
  status: "failed";
  mode: SyncExecutionPlan["mode"];
  planned_count: number;
  completed_count: number;
  completed_resources: SupportedSyncResource[];
  failed_resource: SupportedSyncResource;
  remaining_resources: SupportedSyncResource[];
  error: ErrorSummary;
}

type ErrorDescriptor = {
  code?: unknown;
  message?: unknown;
  retryable?: unknown;
};

const FORBIDDEN_MARKERS =
  /\b(?:request_metadata|raw_payload|service_role_key)\b\s*[:=]\s*\S+/gi;

function normalizedError(error: unknown): ErrorSummary {
  const descriptor =
    error instanceof Error
      ? {
          code: error.name,
          message: error.message,
          retryable: false,
        }
      : ((error ?? {}) as ErrorDescriptor);
  const summary = createErrorSummary({
    code: descriptor.code,
    message: descriptor.message ?? "Unexpected execution error",
    retryable: descriptor.retryable === true,
  });

  return {
    code: summary.code?.replace(FORBIDDEN_MARKERS, "[REDACTED]") ?? null,
    message: summary.message.replace(FORBIDDEN_MARKERS, "[REDACTED]"),
    retryable: summary.retryable,
  };
}

export function createExecutionFailureReport(input: {
  plan: SyncExecutionPlan;
  completedResources: readonly SupportedSyncResource[];
  failedResource: SupportedSyncResource;
  error: unknown;
}): ExecutionFailureReport {
  const failedIndex = input.plan.resources.indexOf(input.failedResource);
  if (failedIndex < 0) {
    throw new Error(
      `Failed resource is not part of the execution plan: ${input.failedResource}`,
    );
  }

  const expectedCompleted = input.plan.resources.slice(0, failedIndex);
  if (
    expectedCompleted.length !== input.completedResources.length ||
    expectedCompleted.some(
      (resource, index) => resource !== input.completedResources[index],
    )
  ) {
    throw new Error("Completed resources do not match execution plan order");
  }

  return {
    status: "failed",
    mode: input.plan.mode,
    planned_count: input.plan.count,
    completed_count: input.completedResources.length,
    completed_resources: [...input.completedResources],
    failed_resource: input.failedResource,
    remaining_resources: input.plan.resources.slice(failedIndex + 1),
    error: normalizedError(input.error),
  };
}
