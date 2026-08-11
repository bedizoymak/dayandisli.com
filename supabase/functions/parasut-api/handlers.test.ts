import { describe, expect, it } from "vitest";
import { createFakeSupabaseAdmin, type FakeRow } from "./fakeSupabaseAdmin.ts";
import {
  handleDashboard,
  handleDetail,
  handleList,
  handlePayablesSummary,
  handlePaymentsList,
  handleReceivablesSummary,
  handleReports,
  handleSyncStatus,
  handleVatSummary,
  resolveContactNames,
} from "./handlers.ts";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";

/**
 * Two companies, deliberately sharing the SAME `parasut_id` on every
 * resource (contacts "500"/"600", products "700", invoices "900",
 * purchase bills "950", payments "800"/"850"). This is the actual
 * cross-tenant collision scenario: two different Paraşüt accounts (one per
 * ERP-internal company) can perfectly well both have a contact numbered
 * "500" — `company_id` is the only thing that tells them apart. If a
 * handler ever queries by `parasut_id` without `company_id`, these tests
 * will return the wrong company's row and fail.
 */
function seedTwoCompanies(): Record<string, FakeRow[]> {
  return {
    "parasut.contacts": [
      { parasut_id: "500", company_id: COMPANY_A, attributes: { name: "A Customer", account_type: "customer", trl_balance: "0" }, relationships: {} },
      { parasut_id: "500", company_id: COMPANY_B, attributes: { name: "B Customer", account_type: "customer", trl_balance: "0" }, relationships: {} },
      { parasut_id: "600", company_id: COMPANY_A, attributes: { name: "A Supplier", account_type: "supplier", trl_balance: "0" }, relationships: {} },
    ],
    "parasut.products": [
      { parasut_id: "700", company_id: COMPANY_A, attributes: { name: "A Product" }, relationships: {} },
      { parasut_id: "700", company_id: COMPANY_B, attributes: { name: "B Product" }, relationships: {} },
    ],
    "parasut.sales_invoices": [
      {
        parasut_id: "900",
        company_id: COMPANY_A,
        // Deliberately "TRL" — Paraşüt's legacy Turkish-lira code, which real production sales_invoices rows use (see handleReceivablesSummary's TURKISH_LIRA_CURRENCY_CODES).
        attributes: { invoice_no: "INV-A-1", currency: "TRL", net_total: "100", gross_total: "120", total_vat: "20", remaining: "120", total_paid: "0", issue_date: "2026-07-01", archived: false },
        relationships: { contact: { data: { id: "500", type: "contacts" } }, details: { data: [] }, payments: { data: [{ id: "800", type: "payments" }] } },
        source_archived: false,
        last_seen_at: "2026-07-01T00:00:00Z",
        synced_at: "2026-07-01T00:00:00Z",
      },
      {
        parasut_id: "900",
        company_id: COMPANY_B,
        attributes: { invoice_no: "INV-B-1", currency: "TRY", net_total: "999", gross_total: "999", total_vat: "0", remaining: "999", total_paid: "0", issue_date: "2026-07-01", archived: false },
        relationships: { contact: { data: { id: "500", type: "contacts" } }, details: { data: [] }, payments: { data: [{ id: "800", type: "payments" }] } },
        source_archived: false,
        last_seen_at: "2026-07-01T00:00:00Z",
        synced_at: "2026-07-01T00:00:00Z",
      },
    ],
    "parasut.purchase_bills": [
      {
        parasut_id: "950",
        company_id: COMPANY_A,
        attributes: { invoice_no: "PB-A-1", currency: "TRY", net_total: "50", gross_total: "60", total_vat: "10", remaining: "60", total_paid: "0", issue_date: "2026-07-01", archived: false },
        relationships: { supplier: { data: { id: "600", type: "contacts" } }, details: { data: [] }, payments: { data: [] } },
        source_archived: false,
        last_seen_at: "2026-07-01T00:00:00Z",
        synced_at: "2026-07-01T00:00:00Z",
      },
    ],
    "parasut.sales_invoice_details": [],
    "parasut.purchase_bill_details": [],
    "parasut.payments": [
      { parasut_id: "800", company_id: COMPANY_A, attributes: { amount: "120", currency: "TRY", date: "2026-07-01", notes: "A payment" }, relationships: {} },
      { parasut_id: "800", company_id: COMPANY_B, attributes: { amount: "999", currency: "TRY", date: "2026-07-01", notes: "B payment" }, relationships: {} },
    ],
    "parasut.accounts": [
      { parasut_id: "300", company_id: COMPANY_A, attributes: { name: "A Bank", account_type: "bank", balance: "1000", currency: "TRY" }, relationships: {} },
      { parasut_id: "300", company_id: COMPANY_B, attributes: { name: "B Bank", account_type: "bank", balance: "9999", currency: "TRY" }, relationships: {} },
    ],
    "parasut.sales_offers": [
      { id: "offer-a", parasut_id: "400", company_id: COMPANY_A, content: "A Offer", status: "open", gross_total: "120", currency: "TRL", issue_date: "2026-07-01", raw_payload: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z" },
      { id: "offer-b", parasut_id: "400", company_id: COMPANY_B, content: "B Offer", status: "won", gross_total: "999", currency: "TRL", issue_date: "2026-07-01", raw_payload: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z" },
    ],
    "parasut.sync_runs": [
      { id: "run-a", company_id: COMPANY_A, resource_type: "contacts", status: "completed", started_at: "2026-07-01T00:00:00Z", completed_at: "2026-07-01T00:01:00Z", records_inserted: 1, records_updated: 0, records_unchanged: 0, error_count: 0, page_count: 1 },
      { id: "run-b", company_id: COMPANY_B, resource_type: "contacts", status: "failed", started_at: "2026-07-01T00:00:00Z", completed_at: "2026-07-01T00:01:00Z", records_inserted: 0, records_updated: 0, records_unchanged: 0, error_count: 1, page_count: 1 },
    ],
    "parasut.sync_errors": [
      { id: "err-a", company_id: COMPANY_A, sync_run_id: "run-a", resource_type: "contacts", sanitized_message: "A error", occurred_at: "2026-07-01T00:00:30Z" },
      { id: "err-b", company_id: COMPANY_B, sync_run_id: "run-b", resource_type: "contacts", sanitized_message: "B error", occurred_at: "2026-07-01T00:00:30Z" },
    ],
  };
}

describe("handleList — cross-company isolation", () => {
  it("dashboard: never includes another company's rows or aggregates", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const result = await handleDashboard(admin, COMPANY_A);
    expect(result.accounts).toHaveLength(1);
    expect((result.accounts[0] as FakeRow).company_id).toBe(COMPANY_A);
    expect(result.recentActivity.invoices).toHaveLength(1);
    expect((result.recentActivity.invoices[0] as FakeRow).company_id).toBe(COMPANY_A);
    // the sole surviving invoice must be company A's, not company B's, despite sharing parasut_id "900"
    expect(((result.recentActivity.invoices[0] as FakeRow).attributes as FakeRow).invoice_no).toBe("INV-A-1");
    expect(result.recentActivity.syncRuns).toHaveLength(1);
    expect((result.recentActivity.syncRuns[0] as FakeRow).id).toBe("run-a");
  });

  it("receivables-summary: matches company A's own open sales invoices only, never company B's — TRL (company A) and TRY (company B) both count as Turkish lira", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const resultA = await handleReceivablesSummary(admin, COMPANY_A);
    // Neither seed row has a due_date, so it's counted as both open and unscheduled (computeOpenDocumentSummary's own definition).
    expect(resultA).toEqual({ outstanding_total: 120, overdue_total: 0, unscheduled_total: 120, overdue_count: 0, unscheduled_count: 1, invoice_count: 1, check_count: 0 });

    const resultB = await handleReceivablesSummary(admin, COMPANY_B);
    expect(resultB).toEqual({ outstanding_total: 999, overdue_total: 0, unscheduled_total: 999, overdue_count: 0, unscheduled_count: 1, invoice_count: 1, check_count: 0 });
  });

  describe("receivables-summary: TRL/TRY currency-code handling", () => {
    const COMPANY_C = "33333333-3333-4333-8333-333333333333";

    function seedMixedCurrencyCompany(): Record<string, FakeRow[]> {
      return {
        "parasut.sales_invoices": [
          // Open, not overdue (no due_date) — TRL, must be counted as Turkish lira.
          { parasut_id: "1", company_id: COMPANY_C, attributes: { invoice_no: "HD-1", currency: "TRL", remaining: "1000.00", archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
          // Open, not overdue — TRY, must ALSO be counted as Turkish lira and summed together with the TRL row above.
          { parasut_id: "2", company_id: COMPANY_C, attributes: { invoice_no: "HD-2", currency: "TRY", remaining: "500.00", archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
          // Open, overdue (due_date in the past) — TRL, must land in overdue_total/overdue_count.
          { parasut_id: "3", company_id: COMPANY_C, attributes: { invoice_no: "HD-3", currency: "TRL", remaining: "200.00", due_date: "2020-01-01", archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
          // Open, not overdue — USD, must be fully excluded from the TRY-formatted totals (no conversion, no accidental inclusion).
          { parasut_id: "4", company_id: COMPANY_C, attributes: { invoice_no: "HD-4", currency: "USD", remaining: "9999.00", archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
          // Closed (remaining 0) — must be excluded entirely regardless of currency.
          { parasut_id: "5", company_id: COMPANY_C, attributes: { invoice_no: "HD-5", currency: "TRL", remaining: "0.00", archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
        ],
      };
    }

    it("sums TRL and TRY together, excludes USD, and never leaks another company's rows", async () => {
      const seed = seedTwoCompanies();
      seed["parasut.sales_invoices"] = [...seed["parasut.sales_invoices"], ...seedMixedCurrencyCompany()["parasut.sales_invoices"]];
      const admin = createFakeSupabaseAdmin(seed);

      const resultC = await handleReceivablesSummary(admin, COMPANY_C);
      // outstanding_total = 1000 (TRL) + 500 (TRY) + 200 (overdue TRL) = 1700; USD and the closed row are excluded from the money total.
      // unscheduled (no due_date, open): id1 (TRL 1000), id2 (TRY 500), id4 (USD 9999, money excluded but still counted) — unscheduled_total = 1500, unscheduled_count = 3.
      expect(resultC).toEqual({ outstanding_total: 1700, overdue_total: 200, unscheduled_total: 1500, overdue_count: 1, unscheduled_count: 3, invoice_count: 5, check_count: 0 });

      // Company isolation: company A/B's own receivables-summary results (proven above) are unaffected by company C's data existing in the same fake admin.
      const resultA = await handleReceivablesSummary(admin, COMPANY_A);
      expect(resultA).toEqual({ outstanding_total: 120, overdue_total: 0, unscheduled_total: 120, overdue_count: 0, unscheduled_count: 1, invoice_count: 1, check_count: 0 });
    });
  });

  it("payables-summary: matches company A's own open purchase bills only, never company B's (which has none)", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const resultA = await handlePayablesSummary(admin, COMPANY_A);
    // The seed row has no due_date, so it's counted as both open and unscheduled.
    expect(resultA).toEqual({ outstanding_total: 60, overdue_total: 0, unscheduled_total: 60, overdue_count: 0, unscheduled_count: 1, document_count: 1, check_count: 0 });

    const resultB = await handlePayablesSummary(admin, COMPANY_B);
    expect(resultB).toEqual({ outstanding_total: 0, overdue_total: 0, unscheduled_total: 0, overdue_count: 0, unscheduled_count: 0, document_count: 0, check_count: 0 });
  });

  describe("payables-summary: TRL/TRY currency handling, partial payment, and archived exclusion", () => {
    const COMPANY_D = "44444444-4444-4444-8444-444444444444";

    function seedMixedPayablesCompany(): FakeRow[] {
      return [
        // Open, not overdue (no due_date) — TRL, must be counted as Turkish lira.
        { parasut_id: "10", company_id: COMPANY_D, attributes: { invoice_no: "PB-1", currency: "TRL", remaining: "1000.00", archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
        // Open, not overdue — TRY, must ALSO be counted as Turkish lira and summed together with the TRL row above.
        { parasut_id: "11", company_id: COMPANY_D, attributes: { invoice_no: "PB-2", currency: "TRY", remaining: "500.00", archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
        // Open, overdue (due_date in the past) — TRL, must land in overdue_total/overdue_count.
        { parasut_id: "12", company_id: COMPANY_D, attributes: { invoice_no: "PB-3", currency: "TRL", remaining: "200.00", due_date: "2020-01-01", archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
        // Open, not overdue — USD, must be fully excluded from the TRY-formatted totals (no conversion, no accidental inclusion).
        { parasut_id: "13", company_id: COMPANY_D, attributes: { invoice_no: "PB-4", currency: "USD", remaining: "9999.00", archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
        // Partially paid — net_total 800, total_paid 300, remaining 500 (> 0) — still open, must be included at its remaining balance.
        { parasut_id: "14", company_id: COMPANY_D, attributes: { invoice_no: "PB-5", currency: "TRY", net_total: "800.00", total_paid: "300.00", remaining: "500.00", archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
        // Fully paid / closed (remaining 0) — must be excluded entirely regardless of currency.
        { parasut_id: "15", company_id: COMPANY_D, attributes: { invoice_no: "PB-6", currency: "TRL", remaining: "0.00", archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
        // source_archived (deleted upstream in Paraşüt) with a nonzero remaining — must be excluded, exactly like isOpenDocument's archived check.
        { parasut_id: "16", company_id: COMPANY_D, attributes: { invoice_no: "PB-7", currency: "TRL", remaining: "5000.00", archived: false }, relationships: {}, source_archived: true, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
      ];
    }

    it("sums TRL and TRY together, includes partially paid rows at their remaining balance, excludes USD and archived rows, and never leaks another company's rows", async () => {
      const seed = seedTwoCompanies();
      seed["parasut.purchase_bills"] = [...seed["parasut.purchase_bills"], ...seedMixedPayablesCompany()];
      const admin = createFakeSupabaseAdmin(seed);

      const resultD = await handlePayablesSummary(admin, COMPANY_D);
      // outstanding_total = 1000 (TRL) + 500 (TRY) + 200 (overdue TRL) + 500 (partially paid TRY) = 2200;
      // USD, the closed row, and the archived row are excluded from the money total. document_count counts every row for the company regardless of open/overdue state, including the archived one.
      // unscheduled (no due_date, open): id10 (TRL 1000), id11 (TRY 500), id13 (USD 9999, money excluded but still counted), id14 (TRY 500, partially paid, no due_date) — unscheduled_total = 2000, unscheduled_count = 4.
      expect(resultD).toEqual({ outstanding_total: 2200, overdue_total: 200, unscheduled_total: 2000, overdue_count: 1, unscheduled_count: 4, document_count: 7, check_count: 0 });

      // Company isolation: company A's own payables-summary result (proven above) is unaffected by company D's data existing in the same fake admin.
      const resultA = await handlePayablesSummary(admin, COMPANY_A);
      expect(resultA).toEqual({ outstanding_total: 60, overdue_total: 0, unscheduled_total: 60, overdue_count: 0, unscheduled_count: 1, document_count: 1, check_count: 0 });
    });
  });

  describe("receivables-summary / payables-summary: cheque (checks) combination", () => {
    const COMPANY_F = "66666666-6666-4666-8666-666666666666";

    function seedChequeCompany(): Record<string, FakeRow[]> {
      return {
        "parasut.sales_invoices": [
          { parasut_id: "30", company_id: COMPANY_F, attributes: { invoice_no: "HD-30", currency: "TRY", remaining: "2000.00", archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
          // Foreign currency — excluded from the invoice money total (turkishLiraTotal), unlike cheques below.
          { parasut_id: "31", company_id: COMPANY_F, attributes: { invoice_no: "HD-31", currency: "USD", remaining: "5000.00", archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
        ],
        "parasut.purchase_bills": [
          { parasut_id: "40", company_id: COMPANY_F, attributes: { invoice_no: "PB-40", currency: "TRY", remaining: "1500.00", archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
        ],
        "parasut.checks": [
          // Received (is_in), open, unscheduled.
          { parasut_id: "1", company_id: COMPANY_F, attributes: { is_in: true, is_out: false, currency: "TRL", remaining_in_trl: "3000.00" }, relationships: {}, source_archived: null, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
          // Received (is_in), overdue.
          { parasut_id: "2", company_id: COMPANY_F, attributes: { is_in: true, is_out: false, currency: "TRL", remaining_in_trl: "700.00", due_date: "2020-01-01" }, relationships: {}, source_archived: null, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
          // Received (is_in), fully cashed/closed (remaining_in_trl 0) — excluded from every money total, still counted in check_count.
          { parasut_id: "3", company_id: COMPANY_F, attributes: { is_in: true, is_out: false, currency: "TRL", remaining_in_trl: "0.00" }, relationships: {}, source_archived: null, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
          // Given (is_out), overdue — must contribute to payables only, never receivables.
          { parasut_id: "4", company_id: COMPANY_F, attributes: { is_in: false, is_out: true, currency: "TRL", remaining_in_trl: "900.00", due_date: "2020-01-01" }, relationships: {}, source_archived: null, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
          // Given (is_out), open/unscheduled — must contribute to payables only, never receivables.
          { parasut_id: "5", company_id: COMPANY_F, attributes: { is_in: false, is_out: true, currency: "TRL", remaining_in_trl: "400.00" }, relationships: {}, source_archived: null, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
          // Received (is_in), foreign currency — UNLIKE sales_invoices/purchase_bills, cheques use Paraşüt's own remaining_in_trl conversion and are NOT excluded from the TRY total.
          { parasut_id: "6", company_id: COMPANY_F, attributes: { is_in: true, is_out: false, currency: "USD", remaining_in_trl: "1234.00" }, relationships: {}, source_archived: null, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
        ],
      };
    }

    it("receivables-summary combines open sales invoices with open received (is_in) cheques, excludes given (is_out) cheques, and includes foreign-currency cheques via remaining_in_trl", async () => {
      const admin = createFakeSupabaseAdmin(seedChequeCompany());
      const result = await handleReceivablesSummary(admin, COMPANY_F);

      // outstanding_total = 2000 (TRY invoice; USD invoice excluded) + 3000 + 700 + 1234 (open received cheques, incl. the USD-denominated one via remaining_in_trl) = 6934
      // overdue_total = 0 (invoices) + 700 (received cheque #2) = 700
      // unscheduled_total = 2000 (TRY invoice, no due_date) + 3000 + 1234 (received cheques #1, #6, no due_date) = 6234
      // overdue_count = 0 (invoices) + 1 (cheque #2) = 1
      // unscheduled_count = 2 (both invoices lack due_date) + 2 (cheques #1, #6) = 4
      // invoice_count = 2 (both sales_invoices rows); check_count = 4 (is_in rows #1,#2,#3,#6 only — is_out #4/#5 excluded)
      expect(result).toEqual({
        outstanding_total: 6934,
        overdue_total: 700,
        unscheduled_total: 6234,
        overdue_count: 1,
        unscheduled_count: 4,
        invoice_count: 2,
        check_count: 4,
      });
    });

    it("payables-summary combines open purchase bills with open given (is_out) cheques and excludes received (is_in) cheques", async () => {
      const admin = createFakeSupabaseAdmin(seedChequeCompany());
      const result = await handlePayablesSummary(admin, COMPANY_F);

      // outstanding_total = 1500 (purchase bill) + 900 + 400 (open given cheques) = 2800
      // overdue_total = 0 (bill) + 900 (given cheque #4) = 900
      // unscheduled_total = 1500 (bill, no due_date) + 400 (given cheque #5, no due_date) = 1900
      // overdue_count = 0 + 1 = 1; unscheduled_count = 1 + 1 = 2
      // document_count = 1; check_count = 2 (is_out rows #4, #5 only — is_in #1/#2/#3/#6 excluded)
      expect(result).toEqual({
        outstanding_total: 2800,
        overdue_total: 900,
        unscheduled_total: 1900,
        overdue_count: 1,
        unscheduled_count: 2,
        document_count: 1,
        check_count: 2,
      });
    });

    it("company isolation: another company's cheques never contribute to this company's receivables/payables summary", async () => {
      const seed = seedChequeCompany();
      seed["parasut.checks"] = [
        ...seed["parasut.checks"],
        { parasut_id: "99", company_id: COMPANY_A, attributes: { is_in: true, is_out: false, currency: "TRL", remaining_in_trl: "999999.00" }, relationships: {}, source_archived: null, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
      ];
      const admin = createFakeSupabaseAdmin(seed);

      const resultF = await handleReceivablesSummary(admin, COMPANY_F);
      expect(resultF.outstanding_total).toBe(6934); // unaffected by company A's huge cheque

      const resultA = await handleReceivablesSummary(admin, COMPANY_A);
      expect(resultA.check_count).toBe(1); // only company A's own cheque, not company F's
    });
  });

  describe("overdue business-date boundary — the ₺30,000 production defect (shared isOverdue predicate, not special-cased per resource)", () => {
    const COMPANY_H = "77777777-7777-4777-8777-777777777777";

    function istanbulDateString(date: Date): string {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
    }

    // Computed from real wall-clock time (not a fixed date) since
    // handleReceivablesSummary/handlePayablesSummary use `new Date()`
    // internally and are not date-injectable — matches the same pattern
    // already used by the vat-summary current-month tests above.
    const businessToday = istanbulDateString(new Date());
    const businessYesterday = istanbulDateString(new Date(Date.now() - 24 * 60 * 60 * 1000));

    it("receivables-summary: a sales invoice due yesterday with a stale days_overdue=0 is still counted overdue (the exact reported ₺30,000 defect)", async () => {
      const admin = createFakeSupabaseAdmin({
        "parasut.sales_invoices": [
          {
            parasut_id: "1",
            company_id: COMPANY_H,
            attributes: { invoice_no: "HD-DEFECT", currency: "TRY", remaining: "30000.00", due_date: businessYesterday, days_overdue: 0, archived: false },
            relationships: {},
            source_archived: false,
            last_seen_at: "2026-07-01T00:00:00Z",
            synced_at: "2026-07-01T00:00:00Z",
          },
        ],
      });
      const result = await handleReceivablesSummary(admin, COMPANY_H);
      expect(result.overdue_total).toBe(30000);
      expect(result.overdue_count).toBe(1);
    });

    it("receivables-summary: a sales invoice due today (not yet overdue) is excluded from overdue_total", async () => {
      const admin = createFakeSupabaseAdmin({
        "parasut.sales_invoices": [
          {
            parasut_id: "2",
            company_id: COMPANY_H,
            attributes: { invoice_no: "HD-TODAY", currency: "TRY", remaining: "5000.00", due_date: businessToday, archived: false },
            relationships: {},
            source_archived: false,
            last_seen_at: "2026-07-01T00:00:00Z",
            synced_at: "2026-07-01T00:00:00Z",
          },
        ],
      });
      const result = await handleReceivablesSummary(admin, COMPANY_H);
      expect(result.overdue_total).toBe(0);
      expect(result.overdue_count).toBe(0);
      expect(result.outstanding_total).toBe(5000); // still open, just not overdue
    });

    it("payables-summary: the SAME shared predicate applies to purchase bills — a bill due yesterday with stale days_overdue=0 is overdue too (not special-cased to sales invoices)", async () => {
      const admin = createFakeSupabaseAdmin({
        "parasut.purchase_bills": [
          {
            parasut_id: "1",
            company_id: COMPANY_H,
            attributes: { invoice_no: "PB-DEFECT", currency: "TRY", remaining: "12000.00", due_date: businessYesterday, days_overdue: 0, archived: false },
            relationships: {},
            source_archived: false,
            last_seen_at: "2026-07-01T00:00:00Z",
            synced_at: "2026-07-01T00:00:00Z",
          },
        ],
      });
      const result = await handlePayablesSummary(admin, COMPANY_H);
      expect(result.overdue_total).toBe(12000);
      expect(result.overdue_count).toBe(1);
    });

    it("receivables-summary: a received cheque due yesterday with stale days_overdue=0 is overdue too (checks reuse the identical shared predicate)", async () => {
      const admin = createFakeSupabaseAdmin({
        "parasut.checks": [
          {
            parasut_id: "1",
            company_id: COMPANY_H,
            attributes: { is_in: true, is_out: false, currency: "TRL", remaining_in_trl: "8000.00", due_date: businessYesterday, days_overdue: 0 },
            relationships: {},
            source_archived: null,
            last_seen_at: "2026-07-01T00:00:00Z",
            synced_at: "2026-07-01T00:00:00Z",
          },
        ],
      });
      const result = await handleReceivablesSummary(admin, COMPANY_H);
      expect(result.overdue_total).toBe(8000);
      expect(result.overdue_count).toBe(1);
    });
  });

  describe("vat-summary: current-month business rule", () => {
    it("previous month's rows do not contribute (the shared fixture's invoices are dated 2026-07-01, always outside the real current calendar month)", async () => {
      const admin = createFakeSupabaseAdmin(seedTwoCompanies());
      const resultA = await handleVatSummary(admin, COMPANY_A);
      expect(resultA).toEqual({ sales_vat: 0, purchase_vat: 0, vat_this_month: 0 });
    });

    const COMPANY_E = "55555555-5555-4555-8555-555555555555";

    function currentMonthDate(day: string): string {
      return `${new Date().toISOString().slice(0, 7)}-${day}`;
    }

    it("nets current-month sales VAT against purchase VAT, combines TRL+TRY as Turkish lira, excludes archived and prior-month rows, and never leaks another company's rows", async () => {
      const seed = seedTwoCompanies();
      seed["parasut.sales_invoices"] = [
        ...seed["parasut.sales_invoices"],
        // Current month, TRL — must count toward sales_vat.
        { parasut_id: "20", company_id: COMPANY_E, attributes: { invoice_no: "HD-20", currency: "TRL", total_vat: "1000.00", issue_date: currentMonthDate("05"), archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
        // Current month, TRY — must ALSO count toward sales_vat, combined with the TRL row above.
        { parasut_id: "21", company_id: COMPANY_E, attributes: { invoice_no: "HD-21", currency: "TRY", total_vat: "500.00", issue_date: currentMonthDate("06"), archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
        // Current month but source_archived — must be excluded entirely.
        { parasut_id: "22", company_id: COMPANY_E, attributes: { invoice_no: "HD-22", currency: "TRL", total_vat: "9999.00", issue_date: currentMonthDate("07"), archived: true }, relationships: {}, source_archived: true, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
        // Prior month — must be excluded.
        { parasut_id: "23", company_id: COMPANY_E, attributes: { invoice_no: "HD-23", currency: "TRL", total_vat: "7777.00", issue_date: "2020-01-15", archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
      ];
      seed["parasut.purchase_bills"] = [
        ...seed["parasut.purchase_bills"],
        // Current month, TRL — must count toward purchase_vat.
        { parasut_id: "24", company_id: COMPANY_E, attributes: { invoice_no: "PB-20", currency: "TRL", total_vat: "300.00", issue_date: currentMonthDate("05"), archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
        // Current month, TRY — must ALSO count toward purchase_vat, combined with the TRL row above.
        { parasut_id: "25", company_id: COMPANY_E, attributes: { invoice_no: "PB-21", currency: "TRY", total_vat: "100.00", issue_date: currentMonthDate("08"), archived: false }, relationships: {}, source_archived: false, last_seen_at: "2026-07-01T00:00:00Z", synced_at: "2026-07-01T00:00:00Z" },
      ];
      const admin = createFakeSupabaseAdmin(seed);

      const resultE = await handleVatSummary(admin, COMPANY_E);
      // sales_vat = 1000 (TRL) + 500 (TRY) = 1500 (archived row and prior-month row excluded)
      // purchase_vat = 300 (TRL) + 100 (TRY) = 400
      // vat_this_month = sales_vat - purchase_vat = 1100
      expect(resultE).toEqual({ sales_vat: 1500, purchase_vat: 400, vat_this_month: 1100 });

      // Company isolation: company A's own vat-summary result (all zero, proven above) is unaffected by company E's data existing in the same fake admin.
      const resultA = await handleVatSummary(admin, COMPANY_A);
      expect(resultA).toEqual({ sales_vat: 0, purchase_vat: 0, vat_this_month: 0 });
    });
  });

  it("list (sales_invoices): only returns the active company's invoice, with the correctly-scoped contact name", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const result = await handleList(admin, { resource: "sales_invoices" }, COMPANY_A);
    expect(result.rows).toHaveLength(1);
    expect((result.rows[0] as FakeRow & { partyName: string }).partyName).toBe("A Customer");

    const resultB = await handleList(admin, { resource: "sales_invoices" }, COMPANY_B);
    expect(resultB.rows).toHaveLength(1);
    expect((resultB.rows[0] as FakeRow & { partyName: string }).partyName).toBe("B Customer");
  });

  it("list (customers): a customer numbered 500 in company A is a completely different row from company B's 500", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const resultA = await handleList(admin, { resource: "customers" }, COMPANY_A);
    const resultB = await handleList(admin, { resource: "customers" }, COMPANY_B);
    expect(resultA.rows).toHaveLength(1);
    expect(resultB.rows).toHaveLength(1);
    expect(((resultA.rows[0] as FakeRow).attributes as FakeRow).name).toBe("A Customer");
    expect(((resultB.rows[0] as FakeRow).attributes as FakeRow).name).toBe("B Customer");
  });

  it("list (accounts): company B's bank balance never leaks into company A's result set", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const result = await handleList(admin, { resource: "accounts" }, COMPANY_A);
    expect(result.rows).toHaveLength(1);
    expect(((result.rows[0] as FakeRow).attributes as FakeRow).balance).toBe("1000");
  });

  it("list (products): product numbered 700 resolves to each company's own distinct name", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const resultA = await handleList(admin, { resource: "products" }, COMPANY_A);
    const resultB = await handleList(admin, { resource: "products" }, COMPANY_B);
    expect(resultA.rows).toHaveLength(1);
    expect(resultB.rows).toHaveLength(1);
    expect(((resultA.rows[0] as FakeRow).attributes as FakeRow).name).toBe("A Product");
    expect(((resultB.rows[0] as FakeRow).attributes as FakeRow).name).toBe("B Product");
  });

  it("list (suppliers): company A's supplier '600' is invisible to company B, which has no supplier at all", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const resultA = await handleList(admin, { resource: "suppliers" }, COMPANY_A);
    const resultB = await handleList(admin, { resource: "suppliers" }, COMPANY_B);
    expect(resultA.rows).toHaveLength(1);
    expect(resultB.rows).toHaveLength(0);
  });

  it("list (purchase_bills): only company A has a purchase bill; company B's list is empty despite sharing no data", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const resultA = await handleList(admin, { resource: "purchase_bills" }, COMPANY_A);
    const resultB = await handleList(admin, { resource: "purchase_bills" }, COMPANY_B);
    expect(resultA.rows).toHaveLength(1);
    expect((resultA.rows[0] as FakeRow & { partyName: string }).partyName).toBe("A Supplier");
    expect(resultB.rows).toHaveLength(0);
  });

  it("list (sales_offers): typed columns are normalized without exposing raw_payload and remain tenant scoped", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const resultA = await handleList(admin, { resource: "sales_offers", filters: { archived: false } }, COMPANY_A);
    const resultB = await handleList(admin, { resource: "sales_offers", filters: { archived: false } }, COMPANY_B);
    expect(resultA.rows).toHaveLength(1);
    expect(resultB.rows).toHaveLength(1);
    expect((resultA.rows[0] as FakeRow).attributes).toMatchObject({ content: "A Offer", gross_total: "120" });
    expect((resultB.rows[0] as FakeRow).attributes).toMatchObject({ content: "B Offer", gross_total: "999" });
    expect(resultA.rows[0]).not.toHaveProperty("raw_payload");
  });
});

describe("resolveContactNames — company-aware relationship resolution", () => {
  it("resolves parasut_id '500' to the correct company's contact name, never the other company's", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const namesA = await resolveContactNames(admin, ["500"], COMPANY_A);
    const namesB = await resolveContactNames(admin, ["500"], COMPANY_B);
    expect(namesA.get("500")).toBe("A Customer");
    expect(namesB.get("500")).toBe("B Customer");
  });
});

describe("handleDetail — exact company_id + exact parasut_id, never maybeSingle() on parasut_id alone", () => {
  it("sales invoice detail: parasut_id '900' resolves to the ACTIVE company's invoice and its own contact, never the other company's", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const detailA = await handleDetail(admin, "sales_invoices", "900", COMPANY_A);
    const detailB = await handleDetail(admin, "sales_invoices", "900", COMPANY_B);
    expect(detailA?.header).toMatchObject({ company_id: COMPANY_A });
    expect((detailA?.header as FakeRow).attributes).toMatchObject({ invoice_no: "INV-A-1" });
    expect((detailA?.contact as FakeRow | null)?.attributes).toMatchObject({ name: "A Customer" });

    expect(detailB?.header).toMatchObject({ company_id: COMPANY_B });
    expect((detailB?.header as FakeRow).attributes).toMatchObject({ invoice_no: "INV-B-1" });
    expect((detailB?.contact as FakeRow | null)?.attributes).toMatchObject({ name: "B Customer" });
  });

  it("purchase bill detail: resolves the correct company's supplier, not the other company's contact with the same id", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const detail = await handleDetail(admin, "purchase_bills", "950", COMPANY_A);
    expect((detail?.contact as FakeRow | null)?.attributes).toMatchObject({ name: "A Supplier" });
  });

  it("customer detail: returns null (not another company's row) when the id only exists for a different company", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    // "600" only exists for company A as a supplier; company B has no row with that id at all.
    const detail = await handleDetail(admin, "customers", "600", COMPANY_B);
    expect(detail).toBeNull();
  });

  it("supplier detail: company A's supplier '600' is invisible when queried as company B, which has no row with that id", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const ownerDetail = await handleDetail(admin, "suppliers", "600", COMPANY_A);
    const otherDetail = await handleDetail(admin, "suppliers", "600", COMPANY_B);
    expect((ownerDetail?.contact as FakeRow | undefined)?.attributes).toMatchObject({ name: "A Supplier" });
    expect(otherDetail).toBeNull();
  });

  it("product detail: parasut_id '700' resolves to the requesting company's own product", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const detailA = await handleDetail(admin, "products", "700", COMPANY_A);
    const detailB = await handleDetail(admin, "products", "700", COMPANY_B);
    expect(((detailA as { record: FakeRow })?.record.attributes as FakeRow).name).toBe("A Product");
    expect(((detailB as { record: FakeRow })?.record.attributes as FakeRow).name).toBe("B Product");
  });

  it("account detail: parasut_id '300' resolves to the requesting company's own bank balance, never the other company's", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const detailA = await handleDetail(admin, "accounts", "300", COMPANY_A);
    const detailB = await handleDetail(admin, "accounts", "300", COMPANY_B);
    expect(((detailA as { record: FakeRow })?.record.attributes as FakeRow).balance).toBe("1000");
    expect(((detailB as { record: FakeRow })?.record.attributes as FakeRow).balance).toBe("9999");
  });

  it("payment detail: parasut_id '800' resolves to the requesting company's own payment amount", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const detailA = await handleDetail(admin, "payments", "800", COMPANY_A);
    const detailB = await handleDetail(admin, "payments", "800", COMPANY_B);
    expect(((detailA as { record: FakeRow })?.record.attributes as FakeRow).amount).toBe("120");
    expect(((detailB as { record: FakeRow })?.record.attributes as FakeRow).amount).toBe("999");
  });

  it("sync run detail: run 'run-a' belongs to company A and is invisible to company B", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const detailForOwner = await handleDetail(admin, "sync_runs", "run-a", COMPANY_A);
    const detailForOther = await handleDetail(admin, "sync_runs", "run-a", COMPANY_B);
    expect(detailForOwner?.run).toMatchObject({ id: "run-a" });
    expect((detailForOwner?.errors as FakeRow[])[0]).toMatchObject({ sanitized_message: "A error" });
    expect(detailForOther).toBeNull();
  });
});

describe("handlePaymentsList — collections/payments resolved only from the active company's documents", () => {
  it("collections: company A sees only its own payment linked to its own invoice, with its own contact name", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const result = await handlePaymentsList(admin, "collection", 1, 25, COMPANY_A);
    expect(result.rows).toHaveLength(1);
    const row = result.rows[0] as FakeRow & { partyName: string; documentNo: string };
    expect(row.partyName).toBe("A Customer");
    expect(row.documentNo).toBe("INV-A-1");
    expect((row.attributes as FakeRow).amount).toBe("120");
  });

  it("payments: company B never sees company A's purchase-bill-linked payment", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const result = await handlePaymentsList(admin, "payment", 1, 25, COMPANY_B);
    expect(result.rows).toHaveLength(0);
  });
});

describe("handleReports — aggregations never cross company boundaries", () => {
  it("sales summary and customer balances only reflect the active company", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const reportA = await handleReports(admin, COMPANY_A);
    expect(reportA.salesSummary).toEqual([{ currency: "TRL", count: 1, net: "100.00", vat: "20.00", gross: "120.00" }]);
    expect(reportA.customerBalances).toHaveLength(1);
    expect((reportA.customerBalances[0] as FakeRow).attributes).toMatchObject({ name: "A Customer" });

    const reportB = await handleReports(admin, COMPANY_B);
    expect(reportB.salesSummary).toEqual([{ currency: "TRY", count: 1, net: "999.00", vat: "0.00", gross: "999.00" }]);
  });
});

describe("handleSyncStatus — sync runs and errors are exact-company scoped", () => {
  it("company A sees only its own sync run and error, never company B's failed run", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const status = await handleSyncStatus(admin, {}, COMPANY_A);
    expect(status.runs).toHaveLength(1);
    expect((status.runs[0] as FakeRow).id).toBe("run-a");
    expect(status.errors).toHaveLength(1);
    expect((status.errors[0] as FakeRow).sanitized_message).toBe("A error");
    expect(status.latestRunPerResource.find((entry) => entry.resourceType === "contacts")?.latestRun).toMatchObject({ id: "run-a" });
  });

  it("company B sees its own failed run, not company A's completed one", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const status = await handleSyncStatus(admin, {}, COMPANY_B);
    expect(status.runs).toHaveLength(1);
    expect((status.runs[0] as FakeRow).id).toBe("run-b");
    expect((status.runs[0] as FakeRow).status).toBe("failed");
  });
});

describe("handleList (customers/suppliers) — deletion-reconciliation default visibility", () => {
  function seedWithArchivedCustomer(): Record<string, FakeRow[]> {
    const seed = seedTwoCompanies();
    seed["parasut.contacts"] = [
      ...seed["parasut.contacts"],
      {
        parasut_id: "999",
        company_id: COMPANY_A,
        attributes: { name: "Deleted Test Customer", account_type: "customer", trl_balance: "0" },
        relationships: {},
        source_archived: true,
      },
    ];
    return seed;
  }

  it("excludes an archived (deleted-from-Paraşüt) contact from the default customers list", async () => {
    const admin = createFakeSupabaseAdmin(seedWithArchivedCustomer());
    const result = await handleList(admin, { resource: "customers" }, COMPANY_A);
    const names = result.rows.map((row) => ((row as FakeRow).attributes as FakeRow).name);
    expect(names).not.toContain("Deleted Test Customer");
  });

  it("still includes the archived contact when filters.archived === true is passed explicitly", async () => {
    const admin = createFakeSupabaseAdmin(seedWithArchivedCustomer());
    const result = await handleList(admin, { resource: "customers", filters: { archived: true } }, COMPANY_A);
    const names = result.rows.map((row) => ((row as FakeRow).attributes as FakeRow).name);
    expect(names).toContain("Deleted Test Customer");
  });

  it("does not exclude archived rows for an unrelated resource (payments) by default — this default is scoped to customers/suppliers only", async () => {
    const seed = seedTwoCompanies();
    seed["parasut.payments"] = [
      ...seed["parasut.payments"],
      { parasut_id: "801", company_id: COMPANY_A, attributes: { amount: "1", currency: "TRY", date: "2026-07-01", notes: "old archived payment" }, relationships: {}, source_archived: true },
    ];
    const admin = createFakeSupabaseAdmin(seed);
    const result = await handleList(admin, { resource: "payments" }, COMPANY_A);
    const notes = result.rows.map((row) => ((row as FakeRow).attributes as FakeRow).notes);
    expect(notes).toContain("old archived payment");
  });
});
