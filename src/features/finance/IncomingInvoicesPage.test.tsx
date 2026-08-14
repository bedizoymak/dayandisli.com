import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

const { IncomingInvoicesPage } = await import("./FinanceExpensePages.tsx");

const E_INVOICES = [
  {
    attributes: {
      external_id: "IN-001",
      direction: "inbound",
      contact_name: "ERDEMİR METAL SANAYİ",
      status: "accepted",
      response_type: "e_invoice",
      issue_date: "2026-01-05",
      net_total: 1000,
      currency: "TRL",
      invoice_parasut_id: "500001",
    },
  },
  {
    attributes: {
      external_id: "OUT-001",
      direction: "outbound",
      contact_name: "DAYAN DİŞLİ",
      status: "sent",
      response_type: "e_invoice",
      issue_date: "2026-01-06",
      net_total: 2000,
      currency: "TRL",
      invoice_parasut_id: "500002",
    },
  },
];

// One inbound e-invoice with a real linked purchase-bill parasut_id, one
// inbound e-invoice with no linked purchase bill at all (invoice_parasut_id
// absent — the real Paraşüt relationships.invoice.data relation only exists
// when the incoming e-invoice was actually turned into a purchase bill).
const E_INVOICES_MIXED_LINKS = [
  {
    attributes: {
      external_id: "IN-LINKED",
      direction: "inbound",
      contact_name: "LINKED TEDARIKCI",
      status: "successful",
      response_type: "accepted",
      issue_date: "2026-01-05",
      net_total: 1000,
      currency: "TRL",
      invoice_parasut_id: "700001",
    },
  },
  {
    attributes: {
      external_id: "IN-UNLINKED",
      direction: "inbound",
      contact_name: "UNLINKED TEDARIKCI",
      status: "successful",
      response_type: "accepted",
      issue_date: "2026-01-06",
      net_total: 2000,
      currency: "TRL",
      invoice_parasut_id: null,
    },
  },
];

function mockInvoke(rows: typeof E_INVOICES) {
  invoke.mockImplementation((_fn: string, opts: { body: { action: string; resource?: string; page?: number } }) => {
    if (opts.body.action === "list" && opts.body.resource === "e_invoices") {
      if ((opts.body.page ?? 1) > 1) return Promise.resolve({ data: { rows: [], total: rows.length }, error: null });
      return Promise.resolve({ data: { rows, total: rows.length }, error: null });
    }
    return Promise.resolve({ data: null, error: { message: "unexpected action in test" } });
  });
}

describe("IncomingInvoicesPage — real inbound e_invoices direction filter", () => {
  it("shows the inbound record and excludes the outbound record", async () => {
    mockInvoke(E_INVOICES);
    render(
      <MemoryRouter>
        <IncomingInvoicesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("ERDEMİR METAL SANAYİ")).toBeInTheDocument());
    expect(screen.queryByText("DAYAN DİŞLİ")).not.toBeInTheDocument();
    expect(document.querySelectorAll(".expense-table.incoming tbody tr")).toHaveLength(1);
  });
});

describe("IncomingInvoicesPage — canonical purchase-bill navigation", () => {
  it("links the invoice number and row action to the real purchase-bill route only when invoice_parasut_id is present", async () => {
    mockInvoke(E_INVOICES_MIXED_LINKS);
    render(
      <MemoryRouter>
        <IncomingInvoicesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("LINKED TEDARIKCI")).toBeInTheDocument());

    const linkedRow = screen.getByText("LINKED TEDARIKCI").closest("tr")!;
    const linkedInvoiceLink = linkedRow.querySelector("a.expense-cell-link");
    expect(linkedInvoiceLink).not.toBeNull();
    expect(linkedInvoiceLink).toHaveAttribute("href", "/apps/finance/expense/list/700001");
    expect(linkedRow.querySelectorAll("a").length).toBe(2); // invoice-number link + row-action eye link

    const unlinkedRow = screen.getByText("UNLINKED TEDARIKCI").closest("tr")!;
    expect(unlinkedRow.querySelectorAll("a")).toHaveLength(0);
    expect(unlinkedRow.textContent).toContain("IN-UNLINKED");
  });

  it("never navigates by invoice number or sender name — only the canonical invoice_parasut_id", async () => {
    mockInvoke(E_INVOICES_MIXED_LINKS);
    render(
      <MemoryRouter>
        <IncomingInvoicesPage />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByText("LINKED TEDARIKCI")).toBeInTheDocument());
    const links = Array.from(document.querySelectorAll(".expense-table.incoming tbody a")) as HTMLAnchorElement[];
    for (const link of links) {
      expect(link.getAttribute("href")).toBe("/apps/finance/expense/list/700001");
    }
  });
});
