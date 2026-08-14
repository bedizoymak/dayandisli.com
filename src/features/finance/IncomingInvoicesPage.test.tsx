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

function mockInvoke() {
  invoke.mockImplementation((_fn: string, opts: { body: { action: string; resource?: string; page?: number } }) => {
    if (opts.body.action === "list" && opts.body.resource === "e_invoices") {
      if ((opts.body.page ?? 1) > 1) return Promise.resolve({ data: { rows: [], total: E_INVOICES.length }, error: null });
      return Promise.resolve({ data: { rows: E_INVOICES, total: E_INVOICES.length }, error: null });
    }
    return Promise.resolve({ data: null, error: { message: "unexpected action in test" } });
  });
}

describe("IncomingInvoicesPage — real inbound e_invoices direction filter", () => {
  it("shows the inbound record and excludes the outbound record", async () => {
    mockInvoke();
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
