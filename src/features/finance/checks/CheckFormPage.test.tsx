import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CheckListRow } from "./types";

const createCheck = vi.hoisted(() => vi.fn());
const updateCheck = vi.hoisted(() => vi.fn());
const getCheckDetail = vi.hoisted(() => vi.fn());
const searchCheckParties = vi.hoisted(() => vi.fn());

vi.mock("./checksApi", () => ({ createCheck, updateCheck, getCheckDetail, searchCheckParties }));

import { CheckFormPage } from "./CheckFormPage";

const saved: CheckListRow = {
  id: "erp:created",
  source: "erp",
  sourceLabel: "ERP",
  direction: "received",
  party: { parasutId: null, localQuoteCustomerId: null, name: null, assigned: false },
  bankName: null,
  checkNumber: null,
  issueDate: null,
  dueDate: "2026-08-20",
  currency: "TRY",
  originalAmount: 1500,
  remainingAmount: 0,
  settlementStatus: "paid",
  effectiveStatus: "paid",
  paidAt: "2026-08-15T10:00:00Z",
  notes: null,
  syncedAt: null,
  editable: false,
  statusEditable: false,
};

describe("CheckFormPage", () => {
  beforeEach(() => {
    createCheck.mockResolvedValue({ ok: true, data: saved });
    updateCheck.mockResolvedValue({ ok: true, data: { ...saved, id: "erp:edit", settlementStatus: "open", effectiveStatus: "open", editable: true, statusEditable: true } });
    searchCheckParties.mockResolvedValue({ ok: true, data: [] });
  });

  it("creates a paid local check while party, issue date and check number remain genuinely optional", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={["/apps/finance/cash/checks/new"]}>
        <Routes>
          <Route path="/apps/finance/cash/checks/new" element={<CheckFormPage />} />
          <Route path="/apps/finance/cash/checks/:checkId" element={<div>Kaydedilen çek</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await user.type(screen.getByLabelText(/Vade Tarihi/), "2026-08-20");
    await user.type(screen.getByLabelText(/Tutar/), "1500");
    await user.selectOptions(screen.getByLabelText(/Başlangıç Durumu/), "paid");
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => expect(createCheck).toHaveBeenCalledTimes(1));
    expect(createCheck.mock.calls[0][0]).toMatchObject({
      direction: "received",
      dueDate: "2026-08-20",
      originalAmount: 1500,
      settlementStatus: "paid",
    });
    expect(createCheck.mock.calls[0][0]).not.toHaveProperty("contactParasutId");
    expect(createCheck.mock.calls[0][0].issueDate).toBeUndefined();
    expect(createCheck.mock.calls[0][0].checkNumber).toBeUndefined();
    expect(await screen.findByText("Kaydedilen çek")).toBeInTheDocument();
  });

  it("sends a user-selected real party when editing a local open check", async () => {
    const user = userEvent.setup();
    const editable = {
      ...saved,
      id: "erp:edit",
      party: { parasutId: "old", localQuoteCustomerId: null, name: "Eski Müşteri", assigned: true },
      checkNumber: "A1",
      settlementStatus: "open",
      effectiveStatus: "open" as const,
      remainingAmount: 1500,
      paidAt: null,
      editable: true,
      statusEditable: true,
    };
    getCheckDetail.mockResolvedValue({ ok: true, data: { record: editable, history: [] } });
    searchCheckParties.mockResolvedValue({ ok: true, data: [{ parasutId: "new", name: "Yeni Müşteri", accountType: "customer" }] });

    render(<MemoryRouter><CheckFormPage checkId="erp:edit" /></MemoryRouter>);
    await screen.findByDisplayValue("A1");
    await user.click(screen.getByRole("button", { name: "Değiştir" }));
    await user.click(await screen.findByRole("option", { name: /Yeni Müşteri/ }));
    await user.click(screen.getByRole("button", { name: "Kaydet" }));

    await waitFor(() => expect(updateCheck).toHaveBeenCalledTimes(1));
    expect(updateCheck.mock.calls[0][1]).toMatchObject({
      contactParasutId: "new",
      contactSnapshotName: "Yeni Müşteri",
    });
  });
});
