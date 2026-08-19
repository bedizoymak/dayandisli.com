import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckListRow } from "./types";
import { sortChecks } from "./checkDomain";

const listChecks = vi.hoisted(() => vi.fn());
const refreshParasutChecks = vi.hoisted(() => vi.fn());

vi.mock("./checksApi", () => ({ listChecks, refreshParasutChecks }));
vi.mock("@/features/erp-shell/erpIdentity", () => ({
  useErpIdentity: () => ({ roles: ["admin"] }),
}));

import { ChecksPage } from "./ChecksPage";

function row(id: string, source: "parasut" | "erp", direction: "received" | "issued", dueDate: string, status: CheckListRow["effectiveStatus"]): CheckListRow {
  return {
    id,
    source,
    sourceLabel: source === "parasut" ? "Paraşüt" : "ERP",
    direction,
    party: { parasutId: null, localQuoteCustomerId: null, name: null, assigned: false },
    bankName: "0062",
    checkNumber: id,
    issueDate: null,
    dueDate,
    currency: "TRY",
    originalAmount: id === "paid" ? 50 : 100,
    remainingAmount: status === "paid" ? 0 : 100,
    settlementStatus: status,
    effectiveStatus: status,
    paidAt: status === "paid" ? "2026-08-01T10:00:00Z" : null,
    notes: null,
    syncedAt: null,
    editable: source === "erp" && status === "open",
    statusEditable: source === "erp" && status === "open",
  };
}

const rows = [
  row("paid", "erp", "issued", "2026-08-01", "paid"),
  row("future", "parasut", "received", "2026-08-30", "upcoming"),
  row("overdue", "parasut", "received", "2026-08-10", "overdue"),
];

function tableIds() {
  return Array.from(document.querySelectorAll(".checks-table tbody tr")).map((tableRow) => within(tableRow as HTMLElement).getByRole("link").getAttribute("href")?.split("/").pop());
}

describe("ChecksPage", () => {
  beforeEach(() => {
    listChecks.mockImplementation(({ sort }: { sort?: Parameters<typeof sortChecks>[1] }) => Promise.resolve({
      ok: true,
      data: { rows: sortChecks(rows, sort, "2026-08-15"), total: rows.length, page: 1, pageSize: 100, latestSyncAt: null },
    }));
    refreshParasutChecks.mockResolvedValue({ ok: true, data: null });
  });

  it("renders combined real sources, visible directions and an explicit unassigned party", async () => {
    render(<MemoryRouter><ChecksPage /></MemoryRouter>);
    await waitFor(() => expect(document.querySelectorAll(".checks-table tbody tr")).toHaveLength(3));
    expect(screen.getAllByText("Paraşüt").length).toBeGreaterThan(0);
    expect(screen.getAllByText("ERP").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Alınan Çek").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Verilen Çek").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Taraf atanmadı")).toHaveLength(3);
    // Default buckets: overdue open, later open, then terminal.
    expect(tableIds()).toEqual(["overdue", "future", "paid"]);
  });

  it("cycles due sorting through pure chronological asc, desc, then default", async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><ChecksPage /></MemoryRouter>);
    await waitFor(() => expect(document.querySelectorAll(".checks-table tbody tr")).toHaveLength(3));
    await user.click(screen.getByRole("button", { name: "Vade sıralamasını değiştir" }));
    await waitFor(() => expect(tableIds()).toEqual(["paid", "overdue", "future"]));
    await user.click(screen.getByRole("button", { name: "Vade sıralamasını değiştir" }));
    await waitFor(() => expect(tableIds()).toEqual(["future", "overdue", "paid"]));
    await user.click(screen.getByRole("button", { name: "Vade sıralamasını değiştir" }));
    await waitFor(() => expect(tableIds()).toEqual(["overdue", "future", "paid"]));
  });
});
