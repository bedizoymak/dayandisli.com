import { RESUME_CONTRACT_VERSION } from "./sync-resume-policy.ts";

export interface CheckpointRequest {
  resourceType: string;
  endpoint: string;
  include: string[];
  pageSize: number;
}

export interface ResumeCheckpointMetadata {
  contract_version: number;
  eligible: true;
  source_run_id: string;
  resource_type: string;
  endpoint: string;
  include: string[];
  page_size: number;
  last_completed_page: number;
  [key: string]: unknown;
}

export interface CheckpointPersistence {
  persistPage(): Promise<void>;
  persistCheckpoint(metadata: Record<string, unknown>): Promise<void>;
}

function assertPositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
}

export function normalizeInclude(include: string[]): string[] {
  return [...new Set(include.map((value) => value.trim()).filter(Boolean))].sort();
}

export function initializeCheckpointMetadata(
  existingMetadata: Record<string, unknown>,
  runId: string,
  request: CheckpointRequest,
): Record<string, unknown> {
  if (!runId.trim()) throw new Error("Run ID is required");
  assertPositiveInteger(request.pageSize, "Page size");

  const existingResume =
    existingMetadata.resume &&
    typeof existingMetadata.resume === "object" &&
    !Array.isArray(existingMetadata.resume)
      ? (existingMetadata.resume as Record<string, unknown>)
      : {};

  return {
    ...existingMetadata,
    resume: {
      ...existingResume,
      contract_version: RESUME_CONTRACT_VERSION,
      eligible: true,
      source_run_id: runId,
      resource_type: request.resourceType,
      endpoint: request.endpoint,
      include: normalizeInclude(request.include),
      page_size: request.pageSize,
      last_completed_page: 0,
    } satisfies ResumeCheckpointMetadata,
  };
}

export function advanceCheckpointMetadata(
  existingMetadata: Record<string, unknown>,
  completedPage: number,
): Record<string, unknown> {
  assertPositiveInteger(completedPage, "Completed page");
  const resume = existingMetadata.resume;
  if (!resume || typeof resume !== "object" || Array.isArray(resume)) {
    throw new Error("Resume metadata is required before checkpoint advancement");
  }

  const current = resume as Record<string, unknown>;
  if (current.contract_version !== RESUME_CONTRACT_VERSION) {
    throw new Error("Resume metadata contract version is unsupported");
  }

  const previousPage = current.last_completed_page;
  if (!Number.isInteger(previousPage) || (previousPage as number) < 0) {
    throw new Error("Existing checkpoint is invalid");
  }
  if (completedPage < (previousPage as number)) {
    throw new Error("Checkpoint regression is not allowed");
  }

  return {
    ...existingMetadata,
    resume: {
      ...current,
      last_completed_page: completedPage,
    },
  };
}

export async function persistPageThenCheckpoint(
  currentMetadata: Record<string, unknown>,
  completedPage: number,
  persistence: CheckpointPersistence,
): Promise<Record<string, unknown>> {
  await persistence.persistPage();
  const nextMetadata = advanceCheckpointMetadata(
    currentMetadata,
    completedPage,
  );
  await persistence.persistCheckpoint(nextMetadata);
  return nextMetadata;
}
