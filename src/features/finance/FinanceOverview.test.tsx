import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

const { FinanceOverview } = await import("./FinanceOverview.tsx");

const RECEIVABLES_OK = { outstanding_total: 100, overdue_total: 10, unscheduled_total: 0, overdue_count: 1, unscheduled_count: 0, invoice_count: 1, check_count: 0 };
const PAYABLES_OK = { outstanding_total: 50, overdue_total: 5, unscheduled_total: 0, overdue_count: 1, unscheduled_count: 0, document_count: 1, check_count: 0 };
const VAT_OK = { vat_this_month: 20, sales_vat: 20, purchase_vat: 0 };

const LIVE_ACCOUNTS = [
  { parasut_id: "1000215424", attributes: { name: "Kasa Hesabı", balance: "6235457.75", account_type: "cash", currency: "TRL", bank_identifier: null, archived: false }, source_archived: false },
  { parasut_id: "1000340089", attributes: { name: "HAYRETTİN DAYAN", balance: "4438251.9", account_type: "bank", currency: "TRL", bank_identifier: "ISBANK", archived: false }, source_archived: false },
  { parasut_id: "1000340091", attributes: { name: "HAYRETTİN DAYAN CEHA DİŞLİ SANAYİ", balance: "0.0", account_type: "bank", currency: "TRL", bank_identifier: "KUVEYTTURK", archived: false }, source_archived: false },
];

/** Dispatches parasut-api mock responses by action/resource, mirroring FinanceOverview's real invocation shape. */
function mockInvokeImplementation(accountsResult: { data: unknown; error: unknown }) {
  invoke.mockImplementation((_fn: string, opts: { body: { action: string; resource?: string } }) => {
    if (opts.body.action === "receivables-summary") return Promise.resolve({ data: RECEIVABLES_OK, error: null });
    if (opts.body.action === "payables-summary") return Promise.resolve({ data: PAYABLES_OK, error: null });
    if (opts.body.action === "vat-summary") return Promise.resolve({ data: VAT_OK, error: null });
    if (opts.body.action === "list" && opts.body.resource === "accounts") return Promise.resolve(accountsResult);
    return Promise.resolve({ data: null, error: { message: "unexpected action in test" } });
  });
}

function renderOverview() {
  return render(
    <MemoryRouter>
      <FinanceOverview />
    </MemoryRouter>,
  );
}

describe("FinanceOverview — Kasa ve Bankalar live accounts", () => {
  it("replaces the demo fixture with live accounts and never shows fake demo names", async () => {
    mockInvokeImplementation({ data: { rows: LIVE_ACCOUNTS, total: 3, page: 1, pageSize: 50 }, error: null });
    renderOverview();

    await waitFor(() => expect(screen.getByText("Kasa Hesabı")).toBeInTheDocument());
    expect(screen.getByText("HAYRETTİN DAYAN")).toBeInTheDocument();
    expect(screen.getByText("HAYRETTİN DAYAN CEHA DİŞLİ SANAYİ")).toBeInTheDocument();

    expect(screen.queryByText("GARANTİ BBVA")).not.toBeInTheDocument();
    expect(screen.queryByText("AKBANK")).not.toBeInTheDocument();
    expect(screen.queryByText("KASA")).not.toBeInTheDocument();
    expect(screen.queryByText("Vadesiz TL Hesabı")).not.toBeInTheDocument();
    expect(screen.queryByText("Merkez Kasa")).not.toBeInTheDocument();
  });

  it("requests only non-archived accounts from the server (filters: { archived: false })", async () => {
    mockInvokeImplementation({ data: { rows: LIVE_ACCOUNTS, total: 3, page: 1, pageSize: 50 }, error: null });
    renderOverview();
    await waitFor(() => expect(screen.getByText("Kasa Hesabı")).toBeInTheDocument());

    const accountsCall = invoke.mock.calls.find(([, opts]) => opts.body.action === "list" && opts.body.resource === "accounts");
    expect(accountsCall?.[1].body.filters).toEqual({ archived: false });
  });

  it("renders a cash account with the cash icon/subtitle and a bank account with the bank icon/subtitle", async () => {
    mockInvokeImplementation({ data: { rows: LIVE_ACCOUNTS, total: 3, page: 1, pageSize: 50 }, error: null });
    renderOverview();
    await waitFor(() => expect(screen.getByText("Kasa Hesabı")).toBeInTheDocument());

    expect(screen.getByText("Nakit Hesap")).toBeInTheDocument(); // cash account subtitle
    expect(screen.getByText("ISBANK")).toBeInTheDocument(); // bank account subtitle uses real bank_identifier
    expect(screen.getByText("KUVEYTTURK")).toBeInTheDocument();
  });

  it("keeps a zero-balance active account visible, formatted as Turkish lira currency (not the literal TRL)", async () => {
    mockInvokeImplementation({ data: { rows: LIVE_ACCOUNTS, total: 3, page: 1, pageSize: 50 }, error: null });
    renderOverview();
    await waitFor(() => expect(screen.getByText("HAYRETTİN DAYAN CEHA DİŞLİ SANAYİ")).toBeInTheDocument());

    // The zero-balance account's card is present with a ₺-formatted value, not hidden and not the raw "TRL" string.
    const zeroBalanceCard = screen.getByText("HAYRETTİN DAYAN CEHA DİŞLİ SANAYİ").closest(".finance-bank-card");
    expect(zeroBalanceCard).not.toBeNull();
    expect(zeroBalanceCard?.textContent).toMatch(/₺/);
    expect(zeroBalanceCard?.textContent).not.toMatch(/TRL/);
  });

  it("sorts accounts by numeric balance descending, matching the live Kasa Hesabı > HAYRETTİN DAYAN > CEHA order", async () => {
    // Deliberately seeded out of order to prove the component sorts, not the fixture.
    const outOfOrder = [LIVE_ACCOUNTS[2], LIVE_ACCOUNTS[0], LIVE_ACCOUNTS[1]];
    mockInvokeImplementation({ data: { rows: outOfOrder, total: 3, page: 1, pageSize: 50 }, error: null });
    renderOverview();
    await waitFor(() => expect(screen.getByText("Kasa Hesabı")).toBeInTheDocument());

    const names = Array.from(document.querySelectorAll(".finance-bank-card span")).map((el) => el.textContent);
    expect(names).toEqual(["Kasa Hesabı", "HAYRETTİN DAYAN", "HAYRETTİN DAYAN CEHA DİŞLİ SANAYİ"]);
  });

  it("all TRL balances render with ₺ Turkish-lira formatting, not the literal currency code", async () => {
    mockInvokeImplementation({ data: { rows: LIVE_ACCOUNTS, total: 3, page: 1, pageSize: 50 }, error: null });
    renderOverview();
    await waitFor(() => expect(screen.getByText("Kasa Hesabı")).toBeInTheDocument());

    expect(screen.getByText(/₺6\.235\.457,75/)).toBeInTheDocument();
    expect(screen.getByText(/₺4\.438\.251,90/)).toBeInTheDocument();
    expect(screen.queryByText(/TRL/)).not.toBeInTheDocument();
  });

  it("a failed accounts request never falls back to the old demo balances presented as live", async () => {
    mockInvokeImplementation({ data: null, error: { message: "Edge Function returned a non-2xx status code" } });
    renderOverview();

    await waitFor(() => expect(screen.queryAllByText("—").length).toBeGreaterThan(0));
    expect(screen.queryByText("GARANTİ BBVA")).not.toBeInTheDocument();
    expect(screen.queryByText("₺4.820.000")).not.toBeInTheDocument();
    expect(screen.queryByText("₺2.150.000")).not.toBeInTheDocument();
    expect(screen.queryByText("₺185.300")).not.toBeInTheDocument();
  });

  it("does not regress the other live FinanceOverview slices (Tahsilatlar/Ödemeler/KDV) while accounts load", async () => {
    mockInvokeImplementation({ data: { rows: LIVE_ACCOUNTS, total: 3, page: 1, pageSize: 50 }, error: null });
    renderOverview();

    await waitFor(() => expect(screen.getByText(/₺100,00/)).toBeInTheDocument()); // receivables outstanding_total
    expect(screen.getByText(/₺50,00/)).toBeInTheDocument(); // payables outstanding_total
    expect(screen.getByText(/₺20,00/)).toBeInTheDocument(); // vat_this_month
    await waitFor(() => expect(screen.getByText("Kasa Hesabı")).toBeInTheDocument());
  });
});
