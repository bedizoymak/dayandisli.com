export const RESUME_CONTRACT_VERSION = 1;

export type ResumeStrategy = "restart" | "resume";

export interface SyncRequestIdentity {
  companyId: string;
  parasutCompanyId: string;
  resourceType: string;
  endpoint: string;
  include: string[];
  pageSize: number;
}

export interface FailedSourceRun {
  id: string;
  companyId: string;
  parasutCompanyId: string;
  resourceType: string;
  status: "failed" | "partial" | "completed" | "running";
  requestMetadata: Record<string, unknown>;
}

export interface ResumeDecisionInput {
  sourceRun: FailedSourceRun | null;
  request: SyncRequestIdentity;
  acceptPageDriftRisk?: boolean;
}

export interface NewRunResumeMetadata {
  contract_version: number;
  strategy: ResumeStrategy;
  source_run_id: string | null;
  start_page: number;
  last_completed_page: number;
  reason: string;
}

export interface ResumeDecision {
  strategy: ResumeStrategy;
  startPage: number;
  reason: string;
  newRunMetadata: NewRunResumeMetadata;
}

interface StoredResumeMetadata {
  contract_version: number;
  eligible: boolean;
  source_run_id: string;
  resource_type: string;
  last_completed_page: number;
  endpoint: string;
  include: string[];
  page_size: number;
}

function normalizedInclude(include: string[]): string[] {
  return [...new Set(include)].sort();
}

function sameStrings(left: string[], right: string[]): boolean {
  const normalizedLeft = normalizedInclude(left);
  const normalizedRight = normalizedInclude(right);
  return (
    normalizedLeft.length === normalizedRight.length &&
    normalizedLeft.every((value, index) => value === normalizedRight[index])
  );
}

function storedResumeMetadata(
  metadata: Record<string, unknown>,
): StoredResumeMetadata | null {
  const value = metadata.resume;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const resume = value as Record<string, unknown>;
  if (
    resume.contract_version !== RESUME_CONTRACT_VERSION ||
    resume.eligible !== true ||
    typeof resume.source_run_id !== "string" ||
    typeof resume.resource_type !== "string" ||
    !Number.isInteger(resume.last_completed_page) ||
    (resume.last_completed_page as number) < 1 ||
    typeof resume.endpoint !== "string" ||
    !Array.isArray(resume.include) ||
    !resume.include.every((item) => typeof item === "string") ||
    !Number.isInteger(resume.page_size) ||
    (resume.page_size as number) < 1
  ) {
    return null;
  }

  return resume as unknown as StoredResumeMetadata;
}

function restart(reason: string): ResumeDecision {
  return {
    strategy: "restart",
    startPage: 1,
    reason,
    newRunMetadata: {
      contract_version: RESUME_CONTRACT_VERSION,
      strategy: "restart",
      source_run_id: null,
      start_page: 1,
      last_completed_page: 0,
      reason,
    },
  };
}

export function decideSyncResume(input: ResumeDecisionInput): ResumeDecision {
  const source = input.sourceRun;
  if (!source) return restart("no_failed_source_run");
  if (source.status !== "failed") return restart("source_run_is_not_failed");
  if (!input.acceptPageDriftRisk) return restart("page_drift_risk_not_accepted");

  const resume = storedResumeMetadata(source.requestMetadata);
  if (!resume) return restart("resume_metadata_is_invalid");
  if (resume.source_run_id !== source.id) {
    return restart("source_run_association_mismatch");
  }
  if (
    source.companyId !== input.request.companyId ||
    source.parasutCompanyId !== input.request.parasutCompanyId ||
    source.resourceType !== input.request.resourceType ||
    resume.resource_type !== input.request.resourceType
  ) {
    return restart("sync_identity_mismatch");
  }
  if (
    resume.endpoint !== input.request.endpoint ||
    resume.page_size !== input.request.pageSize ||
    !sameStrings(resume.include, input.request.include)
  ) {
    return restart("request_fingerprint_mismatch");
  }

  const startPage = resume.last_completed_page + 1;
  return {
    strategy: "resume",
    startPage,
    reason: "validated_failed_run_checkpoint",
    newRunMetadata: {
      contract_version: RESUME_CONTRACT_VERSION,
      strategy: "resume",
      source_run_id: source.id,
      start_page: startPage,
      last_completed_page: resume.last_completed_page,
      reason: "validated_failed_run_checkpoint",
    },
  };
}
