import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import SyncRunDetailPage from "./SyncRunDetailPage";
import { useParasutSyncRunDetail } from "../api/queries";
import { useERPAuth } from "@/contexts/ERPAuthContext";

vi.mock("../api/queries", () => ({
  useParasutSyncRunDetail: vi.fn(),
}));

vi.mock("@/contexts/ERPAuthContext", () => ({
  useERPAuth: vi.fn(),
}));

const mockedUseDetail = vi.mocked(useParasutSyncRunDetail);
const mockedUseAuth = vi.mocked(useERPAuth);

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
    mockedUseDetail.mockReturnValue({ data: undefined, isLoading: false, isError: false, error: null, refetch: vi.fn() } as ReturnType<typeof useParasutSyncRunDetail>);
    renderAtRun();
    expect(screen.getByText("Bu alana erişim yetkiniz yok")).toBeInTheDocument();
  });

  it("shows a loading state while fetching", () => {
    mockedUseAuth.mockReturnValue({ hasPermission: () => true } as ReturnType<typeof useERPAuth>);
    mockedUseDetail.mockReturnValue({ data: undefined, isLoading: true, isError: false, error: null, refetch: vi.fn() } as ReturnType<typeof useParasutSyncRunDetail>);
    renderAtRun();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows an error state with retry when the fetch fails", () => {
    mockedUseAuth.mockReturnValue({ hasPermission: () => true } as ReturnType<typeof useERPAuth>);
    mockedUseDetail.mockReturnValue({ data: undefined, isLoading: false, isError: true, error: new Error("network"), refetch: vi.fn() } as ReturnType<typeof useParasutSyncRunDetail>);
    renderAtRun();
    expect(screen.getByRole("alert")).toHaveTextContent("network");
  });

  it("renders run statistics, checkpoint, company scope, and errors table without any secret-bearing field", () => {
    mockedUseAuth.mockReturnValue({ hasPermission: () => true } as ReturnType<typeof useERPAuth>);
    mockedUseDetail.mockReturnValue({
      data: {
        run: baseRun,
        errors: [
          { id: "err-1", sync_run_id: "run-a", resource_type: "purchase_bills", parasut_id: "123", http_status: 500, error_code: "server_error", sanitized_message: "Bearer [REDACTED]", retryable: true, occurred_at: "2026-07-15T21:25:00.000Z" },
        ],
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as ReturnType<typeof useParasutSyncRunDetail>);

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
    mockedUseDetail.mockReturnValue({ data: { run: baseRun, errors: [] }, isLoading: false, isError: false, error: null, refetch: vi.fn() } as ReturnType<typeof useParasutSyncRunDetail>);
    renderAtRun();
    expect(screen.getByText("Bu çalışmada hata kaydedilmedi.")).toBeInTheDocument();
  });
});
