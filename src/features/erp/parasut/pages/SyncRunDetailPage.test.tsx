import { describe, expect, it, vi } from "vitest";
import type { UseQueryResult } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SyncRunDetailPage from "./SyncRunDetailPage";
import { useParasutSyncRunDetail } from "../api/queries";
import type { SyncRunDetailResponse } from "../types";
import { useERPAuth } from "@/contexts/ERPAuthContext";

vi.mock("../api/queries", () => ({
  useParasutSyncRunDetail: vi.fn(),
}));

vi.mock("@/contexts/ERPAuthContext", () => ({
  useERPAuth: vi.fn(),
}));

const mockedUseDetail = vi.mocked(useParasutSyncRunDetail);
const mockedUseAuth = vi.mocked(useERPAuth);

type SyncRunDetailQueryResult = UseQueryResult<SyncRunDetailResponse, Error>;

// Fully typed factory covering every UseQueryResult field so tests can override
// just the handful of properties that matter for a given state, without
// resorting to a broad `any` cast or an incomplete/mismatched object literal.
// The tanstack query result type is a status-keyed discriminated union, so a
// single plain object literal can never satisfy it structurally across every
// possible state override — the same reason the library's own test utilities
// build mocks this way. The `unknown` step is a one-time, fully-typed factory
// boundary (not a scattered `any`); every call site keeps full type safety on
// its overrides via `Partial<SyncRunDetailQueryResult>`.
function buildQueryResult(overrides: Partial<SyncRunDetailQueryResult>): SyncRunDetailQueryResult {
  const base = {
    data: undefined,
    dataUpdatedAt: 0,
    error: null,
    errorUpdatedAt: 0,
    failureCount: 0,
    failureReason: null,
    errorUpdateCount: 0,
    isError: false,
    isFetched: true,
    isFetchedAfterMount: true,
    isFetching: false,
    isLoading: false,
    isLoadingError: false,
    isInitialLoading: false,
    isPaused: false,
    isPending: false,
    isPlaceholderData: false,
    isRefetchError: false,
    isRefetching: false,
    isStale: false,
    isSuccess: true,
    refetch: vi.fn(),
    status: "success",
    fetchStatus: "idle",
    promise: Promise.resolve(undefined as unknown as SyncRunDetailResponse),
  };

  return { ...base, ...overrides } as unknown as SyncRunDetailQueryResult;
}

function renderAtRun(runId = "run-a") {
  return render(
    <MemoryRouter initialEntries={[`/apps/parasut/senkronizasyon/${runId}`]}>
      <Routes>
        <Route path="/apps/parasut/senkronizasyon/:runId" element={<SyncRunDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const baseRun = {
  id: "run-a",
  company_id: "54b50745-89e0-4b97-adb6-4f2426fa2a2f",
  parasut_company_id: "666034",
  resource_type: "purchase_bills",
  trigger_type: "local_manual",
  status: "completed" as const,
  started_at: "2026-07-15T21:24:01.000Z",
  completed_at: "2026-07-15T21:29:45.000Z",
  page_count: 31,
  records_observed: 3378,
  records_inserted: 3378,
  records_updated: 0,
  records_unchanged: 0,
  error_count: 0,
  request_metadata: { resume: { last_completed_page: 31 } },
};

describe("SyncRunDetailPage", () => {
  it("shows the permission-denied state when the user lacks parasut.sync.view", () => {
    mockedUseAuth.mockReturnValue({ hasPermission: () => false } as ReturnType<typeof useERPAuth>);
    mockedUseDetail.mockReturnValue(buildQueryResult({ data: undefined }));
    renderAtRun();
    expect(screen.getByText("Bu alana erişim yetkiniz yok")).toBeInTheDocument();
  });

  it("shows a loading state while fetching", () => {
    mockedUseAuth.mockReturnValue({ hasPermission: () => true } as ReturnType<typeof useERPAuth>);
    mockedUseDetail.mockReturnValue(
      buildQueryResult({ data: undefined, isLoading: true, isPending: true, isSuccess: false, status: "pending", fetchStatus: "fetching" }),
    );
    renderAtRun();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows an error state with retry when the fetch fails", () => {
    mockedUseAuth.mockReturnValue({ hasPermission: () => true } as ReturnType<typeof useERPAuth>);
    mockedUseDetail.mockReturnValue(
      buildQueryResult({ data: undefined, isError: true, error: new Error("network"), isSuccess: false, status: "error", isLoadingError: true }),
    );
    renderAtRun();
    expect(screen.getByRole("alert")).toHaveTextContent("network");
  });

  it("renders run statistics, checkpoint, company scope, and errors table without any secret-bearing field", () => {
    mockedUseAuth.mockReturnValue({ hasPermission: () => true } as ReturnType<typeof useERPAuth>);
    mockedUseDetail.mockReturnValue(
      buildQueryResult({
        data: {
          run: baseRun,
          errors: [
            { id: "err-1", sync_run_id: "run-a", resource_type: "purchase_bills", parasut_id: "123", http_status: 500, error_code: "server_error", sanitized_message: "Bearer [REDACTED]", retryable: true, occurred_at: "2026-07-15T21:25:00.000Z" },
          ],
        },
      }),
    );

    const { container } = renderAtRun();

    expect(screen.getAllByText("3.378").length).toBeGreaterThan(0); // records_observed / records_inserted, Turkish thousands separator
    expect(screen.getByText("Sayfa 31")).toBeInTheDocument(); // checkpoint
    expect(screen.getByText("54b50745-89e0-4b97-adb6-4f2426fa2a2f")).toBeInTheDocument();
    expect(screen.getByText("666034")).toBeInTheDocument();
    expect(screen.getByText("Bearer [REDACTED]")).toBeInTheDocument();

    // Never render anything that looks like a live secret/token/authorization header.
    expect(container.innerHTML).not.toMatch(/authorization|access_token|refresh_token|service_role|sb_secret_/i);
  });

  it("shows the empty-errors message when the run had no errors", () => {
    mockedUseAuth.mockReturnValue({ hasPermission: () => true } as ReturnType<typeof useERPAuth>);
    mockedUseDetail.mockReturnValue(buildQueryResult({ data: { run: baseRun, errors: [] } }));
    renderAtRun();
    expect(screen.getByText("Bu çalışmada hata kaydedilmedi.")).toBeInTheDocument();
  });
});
