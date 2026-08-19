import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const listAllChecks = vi.hoisted(() => vi.fn());

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

const DashboardPage = (await import("./DashboardPage")).default;

describe("Dashboard cheque reminders", () => {
  it("renders an open due cheque as a separate upcoming payment without guessing its party", async () => {
    listAllChecks.mockResolvedValueOnce(checksResult);
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);

    await waitFor(() => expect(screen.getByText(/CHK-TODAY/)).toBeInTheDocument());
    expect(screen.getByText(/Bugün vadeli çek · Verilen Çek/)).toBeInTheDocument();
    expect(screen.getByText(/Taraf atanmadı/)).toBeInTheDocument();
    expect(screen.getByText(/₺900,00/)).toBeInTheDocument();
    expect(listAllChecks).toHaveBeenCalledWith({ filters: { openOnly: true } });
  });
});
