import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const listAllChecks = vi.hoisted(() => vi.fn());
const invoke = vi.hoisted(() => vi.fn());

const checksResult = {
  ok: true as const,
  data: [{
      id: "parasut:1001",
      source: "parasut" as const,
      sourceLabel: "Paraşüt" as const,
      direction: "issued" as const,
      party: { parasutId: null, localQuoteCustomerId: null, name: null, assigned: false },
      bankName: "ISBANK",
      checkNumber: "CHK-TODAY",
      issueDate: null,
      dueDate: today,
      currency: "TRY" as const,
      originalAmount: 900,
      remainingAmount: 900,
      settlementStatus: "open",
      effectiveStatus: "due_today" as const,
      paidAt: null,
      notes: null,
      syncedAt: "2026-08-15T00:00:00Z",
      editable: false,
      statusEditable: false,
    }],
};

vi.mock("@/features/finance/checks/checksApi", () => ({ listAllChecks }));
vi.mock("@/features/erp-shell/erpIdentity", () => ({
  useErpIdentity: () => ({ erpUser: { email: "finance.user@dayandisli.com" }, hasPermission: () => true }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

const DashboardPage = (await import("./DashboardPage")).default;

function renderDashboard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("Dashboard cheque reminders", () => {
  it("renders an open due cheque as a separate upcoming payment without guessing its party", async () => {
    listAllChecks.mockResolvedValueOnce(checksResult);
    invoke.mockResolvedValue({ data: null, error: { message: "Edge Function returned a non-2xx status code" } });
    renderDashboard();

    await waitFor(() => expect(screen.getByText(/CHK-TODAY/)).toBeInTheDocument());
    expect(screen.getByText(/Bugün vadeli çek · Verilen Çek/)).toBeInTheDocument();
    expect(screen.getByText(/Taraf atanmadı/)).toBeInTheDocument();
    expect(screen.getByText(/₺900,00/)).toBeInTheDocument();
    expect(listAllChecks).toHaveBeenCalledWith({ filters: { openOnly: true } });
  });
});

describe("Dashboard market-data widgets", () => {
  const MARKET_PAYLOAD = {
    currency: { usdTry: 47.89, usdTryPreviousClose: 47.23, eurTry: 55.56, eurTryPreviousClose: 55.56, rateDate: "2026-08-20", source: "TCMB" },
    gold: { gramTry: 4850.32, gramTryPreviousClose: null, updatedAt: "2026-08-21T11:00:00.000Z", source: "metalpriceapi.com" },
    weather: {
      temperatureC: 29.4,
      apparentTemperatureC: 30.1,
      weatherCode: 1000,
      condition: "Açık",
      isDay: true,
      location: "İstanbul",
      updatedAt: "2026-08-21T11:00:00.000Z",
      source: "Tomorrow.io",
    },
    fetchedAt: "2026-08-21T11:00:00.000Z",
    errors: { currency: null, gold: null, weather: null },
  };

  it("replaces the placeholder dashes with live FX, gold and weather values", async () => {
    listAllChecks.mockResolvedValueOnce({ ok: true, data: [] });
    invoke.mockResolvedValueOnce({ data: MARKET_PAYLOAD, error: null });
    renderDashboard();

    await waitFor(() => expect(screen.getByText("₺47,89")).toBeInTheDocument());
    expect(screen.getByText("₺55,56")).toBeInTheDocument();
    expect(screen.getByText("₺4.850,32")).toBeInTheDocument();
    expect(screen.getByText("29°")).toBeInTheDocument();
    expect(screen.getByText("Açık")).toBeInTheDocument();
    expect(screen.getByText(/▲ \+1,40%/)).toBeInTheDocument();
  });

  it("keeps the dash placeholders (no crash, no error banner) when the edge function fails", async () => {
    listAllChecks.mockResolvedValueOnce({ ok: true, data: [] });
    invoke.mockResolvedValue({ data: null, error: { message: "Edge Function returned a non-2xx status code" } });
    renderDashboard();

    await waitFor(() => expect(screen.getByText(/Günaydın|İyi günler|İyi akşamlar/)).toBeInTheDocument());
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
