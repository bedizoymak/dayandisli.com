import { describe, expect, it } from "vitest";
import {
  RESUME_CONTRACT_VERSION,
  decideSyncResume,
  type FailedSourceRun,
  type SyncRequestIdentity,
} from "./sync-resume-policy.ts";

const request: SyncRequestIdentity = {
  companyId: "company-1",
  parasutCompanyId: "666034",
  resourceType: "contacts",
  endpoint: "/v4/666034/contacts",
  include: [],
  pageSize: 25,
};

function failedRun(
  overrides: Partial<FailedSourceRun> = {},
): FailedSourceRun {
  return {
    id: "run-1",
    companyId: "company-1",
    parasutCompanyId: "666034",
    resourceType: "contacts",
    status: "failed",
    requestMetadata: {
      resume: {
        contract_version: RESUME_CONTRACT_VERSION,
        eligible: true,
        source_run_id: "run-1",
        resource_type: "contacts",
        last_completed_page: 4,
        endpoint: "/v4/666034/contacts",
        include: [],
        page_size: 25,
      },
    },
    ...overrides,
  };
}

describe("decideSyncResume", () => {
  it("restarts when no failed source run exists", () => {
    const decision = decideSyncResume({ sourceRun: null, request });

    expect(decision).toMatchObject({
      strategy: "restart",
      startPage: 1,
      reason: "no_failed_source_run",
    });
  });

  it("restarts unless page drift risk is explicitly accepted", () => {
    const decision = decideSyncResume({
      sourceRun: failedRun(),
      request,
    });

    expect(decision.reason).toBe("page_drift_risk_not_accepted");
  });

  it("resumes from the page after a validated checkpoint", () => {
    const decision = decideSyncResume({
      sourceRun: failedRun(),
      request,
      acceptPageDriftRisk: true,
    });

    expect(decision).toEqual({
      strategy: "resume",
      startPage: 5,
      reason: "validated_failed_run_checkpoint",
      newRunMetadata: {
        contract_version: RESUME_CONTRACT_VERSION,
        strategy: "resume",
        source_run_id: "run-1",
        start_page: 5,
        last_completed_page: 4,
        reason: "validated_failed_run_checkpoint",
      },
    });
  });

  it("restarts when the source association does not match", () => {
    const sourceRun = failedRun();
    sourceRun.requestMetadata = {
      resume: {
        ...(sourceRun.requestMetadata.resume as Record<string, unknown>),
        source_run_id: "different-run",
      },
    };

    const decision = decideSyncResume({
      sourceRun,
      request,
      acceptPageDriftRisk: true,
    });

    expect(decision.reason).toBe("source_run_association_mismatch");
  });

  it("restarts for a different tenant or resource", () => {
    const decision = decideSyncResume({
      sourceRun: failedRun(),
      request: { ...request, companyId: "company-2" },
      acceptPageDriftRisk: true,
    });

    expect(decision.reason).toBe("sync_identity_mismatch");
  });

  it("restarts when endpoint, includes, or page size changes", () => {
    const changedRequest = {
      ...request,
      include: ["details"],
    };

    const decision = decideSyncResume({
      sourceRun: failedRun(),
      request: changedRequest,
      acceptPageDriftRisk: true,
    });

    expect(decision.reason).toBe("request_fingerprint_mismatch");
  });

  it("treats include ordering as equivalent", () => {
    const source = failedRun();
    source.requestMetadata = {
      resume: {
        ...(source.requestMetadata.resume as Record<string, unknown>),
        include: ["payments", "details"],
      },
    };

    const decision = decideSyncResume({
      sourceRun: source,
      request: { ...request, include: ["details", "payments"] },
      acceptPageDriftRisk: true,
    });

    expect(decision.strategy).toBe("resume");
  });

  it("restarts when checkpoint metadata is incomplete", () => {
    const decision = decideSyncResume({
      sourceRun: failedRun({ requestMetadata: { resume: { eligible: true } } }),
      request,
      acceptPageDriftRisk: true,
    });

    expect(decision.reason).toBe("resume_metadata_is_invalid");
  });

  it("associates only failed source runs with new runs", () => {
    const decision = decideSyncResume({
      sourceRun: failedRun({ status: "partial" }),
      request,
      acceptPageDriftRisk: true,
    });

    expect(decision.strategy).toBe("restart");
    expect(decision.newRunMetadata.source_run_id).toBeNull();
  });
});
