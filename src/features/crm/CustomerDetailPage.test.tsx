// P1 (2026-08-24 production QA): the customer-card "Fatura Geçmişi" invoice
// link previously targeted /apps/finance/income/invoices/{invoice_no}, but
// that route requires the numeric Paraşüt invoice id
// (FinanceIncomePages.tsx's InvoiceDetailPage passes :invoiceId straight
// through as parasutId to the detail handler) — invoice_no (e.g.
// "HD02026000000071") is a human-facing document number, not a lookup key.
// This test proves the rendered href uses the numeric id, never the number.
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const invoke = vi.hoisted(() => vi.fn());
const listAllChecks = vi.hoisted(() => vi.fn());
const fetchQuotesForCustomer = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));
vi.mock("../finance/checks/checksApi", () => ({ listAllChecks }));
vi.mock("../sales/quotesApi", () => ({ fetchQuotesForCustomer }));
vi.mock("../sales/QuoteHistoryPanel", () => ({ QuoteHistoryPanel: () => null }));

import { CustomerDetailPage } from "./CustomerDetailPage";

describe("CustomerDetailPage — Fatura Geçmişi invoice links (P1, 2026-08-24 production QA)", () => {
  it("builds the invoice detail href from the document's numeric parasut_id, not the human-facing invoice_no — reproduces the PİNO HD02026000000071 -> 1091559184 mapping", async () => {
    listAllChecks.mockResolvedValue({ ok: true, data: [] });
    fetchQuotesForCustomer.mockResolvedValue({ ok: true, data: [] });
    invoke.mockImplementation((functionName: string, options: { body: { action: string; resource: string } }) => {
      if (options.body.resource === "customers") {
        return Promise.resolve({
          data: {
            contact: { parasut_id: "1011029161", attributes: { name: "PİNO MAKİNE", trl_balance: "927109.11", account_type: "customer" } },
            recentDocuments: [
              {
                parasut_id: "1091559184",
                attributes: { invoice_no: "HD02026000000071", issue_date: "2026-08-01", due_date: "2026-08-31", net_total: "1000", currency: "TRY", payment_status: "unpaid" },
                relationships: { payments: { data: [] } },
              },
            ],
            payments: [],
            supplierDocuments: [],
            supplierPayments: [],
            statement: { version: 1, status: "reconciled", rows: [], diagnostics: [] },
          },
          error: null,
        });
      }
      return Promise.resolve({ data: { rows: [] }, error: null });
    });

    render(
      <MemoryRouter>
        <CustomerDetailPage customerId="1011029161" />
      </MemoryRouter>,
    );

    const link = await waitFor(() => screen.getByTitle("Görüntüle"));
    expect(link.getAttribute("href")).toBe("/apps/finance/income/invoices/1091559184");
    expect(link.getAttribute("href")).not.toContain("HD02026000000071");
    expect(screen.getByText("HD02026000000071")).toBeInTheDocument();
  });
});
