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
  it("list (checks): archived=false keeps all 40 real-style NULL source_archived rows visible", async () => {
    const seed = seedTwoCompanies();
    seed["parasut.checks"] = Array.from({ length: 40 }, (_, index) => ({
      parasut_id: String(index + 1),
      company_id: COMPANY_A,
      attributes: {
        serial_number: `CHECK-${index + 1}`,
        due_date: "2026-09-01",
        currency: "TRL",
        remaining: "100",
      },
      relationships: {},
      source_archived: null,
      last_seen_at: "2026-08-14T00:00:00Z",
      synced_at: "2026-08-14T00:00:00Z",
    }));
    const admin = createFakeSupabaseAdmin(seed);

    const result = await handleList(
      admin,
      { resource: "checks", page: 1, pageSize: 100, filters: { archived: false } },
      COMPANY_A,
    );

    expect(result.total).toBe(40);
    expect(result.rows).toHaveLength(40);
    expect(result.rows.every((row) => row.source_archived === null)).toBe(true);
  });

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
      // USD, the closed row, and the archived row are excluded from the money total. document_count counts every
      // NON-ARCHIVED row for the company regardless of open/overdue state — the parent-deleted (archived) bill is
      // excluded from the count too, since Paraşüt no longer knows it (source-isolation rule, 2026-08-25).
      // unscheduled (no due_date, open): id10 (TRL 1000), id11 (TRY 500), id13 (USD 9999, money excluded but still counted), id14 (TRY 500, partially paid, no due_date) — unscheduled_total = 2000, unscheduled_count = 4.
      expect(resultD).toEqual({ outstanding_total: 2200, overdue_total: 200, unscheduled_total: 2000, overdue_count: 1, unscheduled_count: 4, document_count: 6, check_count: 0 });

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

  describe("source isolation: archived rows never enter customer financial aggregates", () => {
    const COMPANY_G = "66666666-6666-4666-8666-666666666666";

    it("a parent-archived purchase bill is excluded from payables totals AND from document_count, while NULL-archived (live) cheques still count", async () => {
      const seed = seedTwoCompanies();
      seed["parasut.purchase_bills"] = [
        {
          parasut_id: "970",
          company_id: COMPANY_G,
          attributes: { invoice_no: "PB-G-LIVE", currency: "TRY", remaining: "500", due_date: "2026-09-01", issue_date: "2026-07-01" },
          relationships: {},
          source_archived: false,
          last_seen_at: "2026-07-01T00:00:00Z",
          synced_at: "2026-07-01T00:00:00Z",
        },
        {
          parasut_id: "971",
          company_id: COMPANY_G,
          attributes: { invoice_no: "PB-G-DELETED-IN-PARENT", currency: "TRY", remaining: "7000", due_date: "2026-09-01", issue_date: "2026-07-01" },
          relationships: {},
          source_archived: true,
          last_seen_at: "2026-07-01T00:00:00Z",
          synced_at: "2026-07-01T00:00:00Z",
        },
      ];
      const admin = createFakeSupabaseAdmin(seed);

      const result = await handlePayablesSummary(admin, COMPANY_G);

      // The archived bill's 7.000 must appear in neither the totals nor the
      // raw document count — Paraşüt no longer knows this document.
      expect(result.outstanding_total).toBe(500);
      expect(result.document_count).toBe(1);
    });

    it("customer detail returns received cheques whose source_archived is NULL (the checks mirror never stores false) — regression for the eq(false) empty-panel defect", async () => {
      const seed = seedTwoCompanies();
      seed["parasut.checks"] = [
        {
          parasut_id: "980",
          company_id: COMPANY_A,
          attributes: { serial_number: "3127841", is_in: true, issued_by_parasut_id: "500", remaining: "451107.89", currency: "TRY", due_date: "2026-09-04" },
          relationships: {},
          // Live checks are stored with NULL — Paraşüt's checks resource has
          // no archived attribute for the sync to mirror (see
          // server/parasut/upsert-resource.ts). An eq(source_archived, false)
          // read here returned zero cheques for every customer.
          source_archived: null,
          last_seen_at: "2026-08-14T00:00:00Z",
          synced_at: "2026-08-14T00:00:00Z",
        },
      ];
      const admin = createFakeSupabaseAdmin(seed);

      const detail = await handleDetail(admin, "customers", "500", COMPANY_A);
      if (!detail || !("checks" in detail)) throw new Error("unexpected detail shape");
      expect(detail.checks).toHaveLength(1);
      expect(detail.checks[0].parasut_id).toBe("980");
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
  it("check detail resolves an exact company-scoped mirror record", async () => {
    const seed = seedTwoCompanies();
    seed["parasut.checks"] = [
      { parasut_id: "check-1", company_id: COMPANY_A, attributes: { serial_number: "A-1" }, relationships: {}, source_archived: null },
      { parasut_id: "check-1", company_id: COMPANY_B, attributes: { serial_number: "B-1" }, relationships: {}, source_archived: null },
    ];
    const admin = createFakeSupabaseAdmin(seed);

    const detailA = await handleDetail(admin, "checks", "check-1", COMPANY_A);
    const detailB = await handleDetail(admin, "checks", "check-1", COMPANY_B);

    expect(((detailA as { record: FakeRow }).record.attributes as FakeRow).serial_number).toBe("A-1");
    expect(((detailB as { record: FakeRow }).record.attributes as FakeRow).serial_number).toBe("B-1");
  });

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

  it("customer detail: a dual-role contact (customer with account_type=\"customer\" who is also the supplier on a purchase_bill) returns both sides — reproduces the PİNO MAKİNE finding in ACCOUNT_STATEMENT_AND_PARASUT_SYNC_AUDIT.md", async () => {
    const admin = createFakeSupabaseAdmin({
      "parasut.contacts": [
        { parasut_id: "500", company_id: COMPANY_A, attributes: { name: "Dual Role Co", account_type: "customer", trl_balance: "927109.11" }, relationships: {} },
      ],
      "parasut.sales_invoices": [
        {
          parasut_id: "900",
          company_id: COMPANY_A,
          attributes: { invoice_no: "HD001", currency: "TRY", net_total: "86400", gross_total: "72000", total_vat: "14400", issue_date: "2026-01-10" },
          relationships: { contact: { data: { id: "500", type: "contacts" } }, payments: { data: [] } },
          source_archived: false,
          last_seen_at: "2026-01-10T00:00:00Z",
        },
      ],
      "parasut.purchase_bills": [
        {
          parasut_id: "950",
          company_id: COMPANY_A,
          attributes: { invoice_no: "PIN2024", currency: "TRY", net_total: "539760", gross_total: "449800", total_vat: "89960", issue_date: "2024-03-14" },
          relationships: { supplier: { data: { id: "500", type: "contacts" } }, payments: { data: [{ id: "sp1", type: "payments" }] } },
          source_archived: false,
          last_seen_at: "2024-03-14T00:00:00Z",
        },
      ],
      "parasut.payments": [
        { parasut_id: "sp1", company_id: COMPANY_A, attributes: { amount: "539760", date: "2024-03-15" }, relationships: {} },
      ],
      "parasut.checks": [],
    });

    const detail = await handleDetail(admin, "customers", "500", COMPANY_A);

    expect((detail?.recentDocuments as FakeRow[])).toHaveLength(1);
    expect(((detail?.recentDocuments as FakeRow[])[0].attributes as FakeRow).invoice_no).toBe("HD001");
    expect((detail?.supplierDocuments as FakeRow[])).toHaveLength(1);
    expect(((detail?.supplierDocuments as FakeRow[])[0].attributes as FakeRow).invoice_no).toBe("PIN2024");
    expect((detail?.supplierPayments as FakeRow[])).toHaveLength(1);
    expect(((detail?.supplierPayments as FakeRow[])[0].attributes as FakeRow).amount).toBe("539760");
  });

  it("customer detail: authoritative statement returns rows in Paraşüt's oldest-first order with human-readable descriptions, never the raw enum or the transaction id as order", async () => {
    const admin = createFakeSupabaseAdmin({
      "parasut.contacts": [
        { parasut_id: "500", company_id: COMPANY_A, attributes: { name: "Dual Role Co", account_type: "customer", trl_balance: "800" }, relationships: {} },
      ],
      // Deliberately seeded in ARRIVAL order (newest-first, as Paraşüt
      // actually returns them) with statement_order already reversed by the
      // sync layer — proves the handler trusts statement_order, not
      // insertion order or the transaction id (which here equals parasut_id).
      "parasut.transaction_history_items": [
        { parasut_id: "1020079633", company_id: COMPANY_A, contact_parasut_id: "500", transaction_parasut_id: "1020079633", statement_order: -1, transaction_date: "2026-01-10", trl_balance: 800, source_archived: false },
        { parasut_id: "1001079721", company_id: COMPANY_A, contact_parasut_id: "500", transaction_parasut_id: "1001079721", statement_order: -400000, transaction_date: "2024-01-01", trl_balance: 500, source_archived: false },
      ],
      "parasut.transactions": [
        { parasut_id: "1020079633", company_id: COMPANY_A, attributes: {}, relationships: {}, transaction_type: "sales_invoice", date: "2026-01-10", description: "", debit_amount: 300, credit_amount: 0, sales_invoice_parasut_id: "si-1" },
        { parasut_id: "1001079721", company_id: COMPANY_A, attributes: {}, relationships: {}, transaction_type: "contact_opening_balance_debit", date: "2024-01-01", description: "", debit_amount: 500, credit_amount: 0, opening_balance_parasut_id: "ob-1" },
      ],
      "parasut.sales_invoices": [
        { parasut_id: "si-1", company_id: COMPANY_A, attributes: { invoice_no: "HD02024000000037" }, relationships: {} },
      ],
      "parasut.opening_balances": [
        { parasut_id: "ob-1", company_id: COMPANY_A, description: "Firmanın borcu var" },
      ],
      "parasut.purchase_bills": [],
      "parasut.checks": [],
      "parasut.payments": [],
    });

    const detail = await handleDetail(admin, "customers", "500", COMPANY_A);
    const statement = detail?.statement as { status: string; rows: Array<Record<string, unknown>> };

    expect(statement.status).toBe("reconciled");
    // Oldest (2024-01-01 opening balance) first, despite arriving second and
    // despite its transaction id (1001079721) being numerically larger than
    // the newer row's (1020079633) — proves order is never id-derived.
    expect(statement.rows.map((row) => row.transactionId)).toEqual(["1001079721", "1020079633"]);
    expect(statement.rows.map((row) => row.date)).toEqual(["2024-01-01", "2026-01-10"]);
    expect(statement.rows[0].displayDescription).toBe("Firmanın borcu var");
    expect(statement.rows[1].displayDescription).toBe("HD02024000000037");
    expect(statement.rows[1].documentNumber).toBe("HD02024000000037");
    for (const row of statement.rows) {
      expect(row.displayDescription).not.toBe(row.transactionType);
    }
  });

  it("customer detail: renders the check's drawee bank name from bank_identifier (P3) and combines invoice number with its own free-text description (P4)", async () => {
    const admin = createFakeSupabaseAdmin({
      "parasut.contacts": [
        { parasut_id: "500", company_id: COMPANY_A, attributes: { name: "Co", account_type: "customer", trl_balance: "1000" }, relationships: {} },
      ],
      "parasut.transaction_history_items": [
        { parasut_id: "h1", company_id: COMPANY_A, contact_parasut_id: "500", transaction_parasut_id: "txn-invoice", statement_order: -2, transaction_date: "2023-12-12", trl_balance: 57960, source_archived: false },
        { parasut_id: "h2", company_id: COMPANY_A, contact_parasut_id: "500", transaction_parasut_id: "txn-check", statement_order: -1, transaction_date: "2024-04-04", trl_balance: 1000, source_archived: false },
      ],
      "parasut.transactions": [
        { parasut_id: "txn-invoice", company_id: COMPANY_A, attributes: {}, relationships: {}, transaction_type: "sales_invoice", date: "2023-12-12", description: "", debit_amount: 57960, credit_amount: 0, sales_invoice_parasut_id: "si-1" },
        { parasut_id: "txn-check", company_id: COMPANY_A, attributes: {}, relationships: {}, transaction_type: "check_in", date: "2024-04-04", description: "", debit_amount: 0, credit_amount: 96270, check_parasut_id: "check-1" },
      ],
      "parasut.sales_invoices": [
        { parasut_id: "si-1", company_id: COMPANY_A, attributes: { invoice_no: "CH02023000000001", description: "Hira Parts Parça Üretimi" }, relationships: {} },
      ],
      "parasut.purchase_bills": [],
      "parasut.opening_balances": [],
      "parasut.checks": [
        // Paraşüt's own bank_name is genuinely empty; bank_identifier is the real, always-populated field.
        { parasut_id: "check-1", company_id: COMPANY_A, attributes: { bank_name: "", bank_identifier: "ZIRAATBANKASI", serial_number: "006995", due_date: "2024-04-04", payment_status: "paid" }, relationships: {} },
      ],
      "parasut.payments": [],
    });

    const detail = await handleDetail(admin, "customers", "500", COMPANY_A);
    const statement = detail?.statement as { rows: Array<Record<string, unknown>> };

    expect(statement.rows[0].displayDescription).toBe("CH02023000000001 — Hira Parts Parça Üretimi");
    const checkRow = statement.rows[1].check as { bank: string | null };
    expect(checkRow.bank).toBe("Ziraat Bankası");
  });

  it("customer detail: falls back to the raw bank_identifier for an unmapped bank code instead of hiding it", async () => {
    const admin = createFakeSupabaseAdmin({
      "parasut.contacts": [
        { parasut_id: "500", company_id: COMPANY_A, attributes: { name: "Co", account_type: "customer", trl_balance: "0" }, relationships: {} },
      ],
      "parasut.transaction_history_items": [
        { parasut_id: "h1", company_id: COMPANY_A, contact_parasut_id: "500", transaction_parasut_id: "txn-check", statement_order: -1, transaction_date: "2024-04-04", trl_balance: 0, source_archived: false },
      ],
      "parasut.transactions": [
        { parasut_id: "txn-check", company_id: COMPANY_A, attributes: {}, relationships: {}, transaction_type: "check_in", date: "2024-04-04", description: "", debit_amount: 0, credit_amount: 100, check_parasut_id: "check-1" },
      ],
      "parasut.sales_invoices": [],
      "parasut.purchase_bills": [],
      "parasut.opening_balances": [],
      "parasut.checks": [
        { parasut_id: "check-1", company_id: COMPANY_A, attributes: { bank_name: "", bank_identifier: "SOME_FUTURE_BANK", serial_number: "1", due_date: "2024-04-04", payment_status: "unpaid" }, relationships: {} },
      ],
      "parasut.payments": [],
    });

    const detail = await handleDetail(admin, "customers", "500", COMPANY_A);
    const statement = detail?.statement as { rows: Array<Record<string, unknown>> };
    const checkRow = statement.rows[0].check as { bank: string | null };
    expect(checkRow.bank).toBe("SOME_FUTURE_BANK");
  });

  it("customer detail: preserves statement_order exactly even when transaction_date goes backward — ledger rebuild contract rule 4 forbids date-based reordering or validation", async () => {
    const admin = createFakeSupabaseAdmin({
      "parasut.contacts": [
        { parasut_id: "500", company_id: COMPANY_A, attributes: { name: "Co", account_type: "customer", trl_balance: "0" }, relationships: {} },
      ],
      "parasut.transaction_history_items": [
        { parasut_id: "a", company_id: COMPANY_A, contact_parasut_id: "500", transaction_parasut_id: "a", statement_order: -2, transaction_date: "2026-06-01", trl_balance: 100, source_archived: false },
        { parasut_id: "b", company_id: COMPANY_A, contact_parasut_id: "500", transaction_parasut_id: "b", statement_order: -1, transaction_date: "2025-01-01", trl_balance: 0, source_archived: false },
      ],
      "parasut.transactions": [
        { parasut_id: "a", company_id: COMPANY_A, attributes: {}, relationships: {}, transaction_type: "contact_credit", date: "2026-06-01", description: "", debit_amount: 0, credit_amount: 100 },
        { parasut_id: "b", company_id: COMPANY_A, attributes: {}, relationships: {}, transaction_type: "contact_debit", date: "2025-01-01", description: "", debit_amount: 100, credit_amount: 0 },
      ],
      "parasut.sales_invoices": [],
      "parasut.purchase_bills": [],
      "parasut.opening_balances": [],
      "parasut.checks": [],
      "parasut.payments": [],
    });
    const detail = await handleDetail(admin, "customers", "500", COMPANY_A);
    const statement = detail?.statement as { status: string; diagnostics: string[]; rows: Array<{ transactionId: string }> };
    // statement_order is authoritative regardless of the (display-only)
    // transaction_date going backward — no date_regression diagnostic, no
    // reordering, "a" (statement_order -2) stays before "b" (-1).
    expect(statement.diagnostics.some((d) => d.startsWith("date_regression:"))).toBe(false);
    expect(statement.status).toBe("reconciled");
    expect(statement.rows.map((r) => r.transactionId)).toEqual(["a", "b"]);
  });

  it("customer detail: authoritative statement flags a row with no resolvable transaction_date as a diagnostic instead of silently rendering an empty date", async () => {
    const admin = createFakeSupabaseAdmin({
      "parasut.contacts": [
        { parasut_id: "500", company_id: COMPANY_A, attributes: { name: "Co", account_type: "customer", trl_balance: "0" }, relationships: {} },
      ],
      "parasut.transaction_history_items": [
        { parasut_id: "a", company_id: COMPANY_A, contact_parasut_id: "500", transaction_parasut_id: "a", statement_order: -1, transaction_date: null, trl_balance: 100, source_archived: false },
      ],
      "parasut.transactions": [
        { parasut_id: "a", company_id: COMPANY_A, attributes: {}, relationships: {}, transaction_type: "contact_credit", description: "", debit_amount: 0, credit_amount: 100 },
      ],
      "parasut.sales_invoices": [],
      "parasut.purchase_bills": [],
      "parasut.opening_balances": [],
      "parasut.checks": [],
      "parasut.payments": [],
    });
    const detail = await handleDetail(admin, "customers", "500", COMPANY_A);
    const statement = detail?.statement as { status: string; diagnostics: string[] };
    expect(statement.diagnostics.some((d) => d.startsWith("missing_transaction_date:"))).toBe(true);
  });

  it("customer detail: a null statement_order or trl_balance fails the whole statement closed — never renders a partial ledger (ledger rebuild contract rule 11)", async () => {
    const admin = createFakeSupabaseAdmin({
      "parasut.contacts": [
        { parasut_id: "500", company_id: COMPANY_A, attributes: { name: "Co", account_type: "customer", trl_balance: "0" }, relationships: {} },
      ],
      "parasut.transaction_history_items": [
        { parasut_id: "a", company_id: COMPANY_A, contact_parasut_id: "500", transaction_parasut_id: "a", statement_order: 0, transaction_date: "2026-01-01", trl_balance: 100, source_archived: false },
        { parasut_id: "b", company_id: COMPANY_A, contact_parasut_id: "500", transaction_parasut_id: "b", statement_order: null, transaction_date: "2026-01-02", trl_balance: 200, source_archived: false },
      ],
      "parasut.transactions": [
        { parasut_id: "a", company_id: COMPANY_A, attributes: {}, relationships: {}, transaction_type: "contact_credit", date: "2026-01-01", description: "", debit_amount: 0, credit_amount: 100 },
        { parasut_id: "b", company_id: COMPANY_A, attributes: {}, relationships: {}, transaction_type: "contact_credit", date: "2026-01-02", description: "", debit_amount: 0, credit_amount: 100 },
      ],
      "parasut.sales_invoices": [],
      "parasut.purchase_bills": [],
      "parasut.opening_balances": [],
      "parasut.checks": [],
      "parasut.payments": [],
    });
    const detail = await handleDetail(admin, "customers", "500", COMPANY_A);
    const statement = detail?.statement as { status: string; rows: unknown[]; diagnostics: string[] };
    expect(statement.status).toBe("unavailable");
    expect(statement.rows).toHaveLength(0);
    expect(statement.diagnostics).toContain("sync_integrity_failure");
  });

  it("customer detail (P2, 2026-08-24 production QA): a contact with zero transaction_history_items rows and NO completed sync is genuinely 'not yet synced' — status stays unavailable", async () => {
    const admin = createFakeSupabaseAdmin({
      "parasut.contacts": [
        { parasut_id: "500", company_id: COMPANY_A, attributes: { name: "Co", account_type: "customer", trl_balance: "0" }, relationships: {} },
      ],
      "parasut.transaction_history_items": [],
      "parasut.transactions": [],
      "parasut.sales_invoices": [],
      "parasut.purchase_bills": [],
      "parasut.opening_balances": [],
      "parasut.checks": [],
      "parasut.payments": [],
      "parasut.sync_runs": [],
    });
    const detail = await handleDetail(admin, "customers", "500", COMPANY_A);
    const statement = detail?.statement as { status: string; rows: unknown[]; diagnostics: string[] };
    expect(statement.status).toBe("unavailable");
    expect(statement.rows).toHaveLength(0);
    expect(statement.diagnostics).toContain("authoritative_history_not_synced");
  });

  it("customer detail (P2, 2026-08-24 production QA): a contact with zero rows but a COMPLETED transaction-history sync run is a genuinely empty real account, never 'not synchronized'", async () => {
    const admin = createFakeSupabaseAdmin({
      "parasut.contacts": [
        { parasut_id: "500", company_id: COMPANY_A, attributes: { name: "Co", account_type: "customer", trl_balance: "0" }, relationships: {} },
      ],
      "parasut.transaction_history_items": [],
      "parasut.transactions": [],
      "parasut.sales_invoices": [],
      "parasut.purchase_bills": [],
      "parasut.opening_balances": [],
      "parasut.checks": [],
      "parasut.payments": [],
      "parasut.sync_runs": [
        {
          id: "run-history-500",
          company_id: COMPANY_A,
          resource_type: "transaction_history_items",
          status: "completed",
          request_metadata: { endpoint: "/v4/999/contacts/500/transaction_history_items" },
          started_at: "2026-08-24T00:00:00Z",
          completed_at: "2026-08-24T00:00:05Z",
        },
      ],
    });
    const detail = await handleDetail(admin, "customers", "500", COMPANY_A);
    const statement = detail?.statement as { status: string; rows: unknown[]; diagnostics: string[] };
    expect(statement.status).toBe("reconciled");
    expect(statement.rows).toHaveLength(0);
    expect(statement.diagnostics ?? []).not.toContain("authoritative_history_not_synced");
  });

  it("customer detail (P0/P2, 2026-08-24 production QA): a confirmed-empty history whose contact still has a nonzero real trl_balance is flagged as a real mismatch, never silently treated as reconciled zero", async () => {
    const admin = createFakeSupabaseAdmin({
      "parasut.contacts": [
        { parasut_id: "500", company_id: COMPANY_A, attributes: { name: "bediz test", account_type: "customer", trl_balance: "-5000000" }, relationships: {} },
      ],
      "parasut.transaction_history_items": [],
      "parasut.transactions": [],
      "parasut.sales_invoices": [],
      "parasut.purchase_bills": [],
      "parasut.opening_balances": [],
      "parasut.checks": [],
      "parasut.payments": [],
      "parasut.sync_runs": [
        {
          id: "run-history-500",
          company_id: COMPANY_A,
          resource_type: "transaction_history_items",
          status: "completed",
          request_metadata: { endpoint: "/v4/999/contacts/500/transaction_history_items" },
          started_at: "2026-08-24T00:00:00Z",
          completed_at: "2026-08-24T00:00:05Z",
        },
      ],
    });
    const detail = await handleDetail(admin, "customers", "500", COMPANY_A);
    const statement = detail?.statement as { status: string; rows: unknown[]; diagnostics: string[] };
    expect(statement.status).toBe("incomplete");
    expect(statement.diagnostics).toContain("contact_balance_mismatch");
  });

  it("customer detail: a statement row is never dropped because its linked sales_invoice is absent from the mirror (LEFT JOIN semantics, contract rules 9/10)", async () => {
    const admin = createFakeSupabaseAdmin({
      "parasut.contacts": [
        { parasut_id: "500", company_id: COMPANY_A, attributes: { name: "Co", account_type: "customer", trl_balance: "300" }, relationships: {} },
      ],
      "parasut.transaction_history_items": [
        { parasut_id: "h1", company_id: COMPANY_A, contact_parasut_id: "500", transaction_parasut_id: "txn-orphan", statement_order: 0, transaction_date: "2026-01-01", trl_balance: 300, source_archived: false },
      ],
      "parasut.transactions": [
        // References a sales_invoice_parasut_id that has no matching row in
        // parasut.sales_invoices at all — the linked document is genuinely
        // absent from the mirror, not merely archived.
        { parasut_id: "txn-orphan", company_id: COMPANY_A, attributes: {}, relationships: {}, transaction_type: "sales_invoice", date: "2026-01-01", description: "Fallback text", amount_in_trl: 300, debit_amount: 300, credit_amount: 0, sales_invoice_parasut_id: "si-missing" },
      ],
      "parasut.sales_invoices": [],
      "parasut.purchase_bills": [],
      "parasut.opening_balances": [],
      "parasut.checks": [],
      "parasut.payments": [],
    });
    const detail = await handleDetail(admin, "customers", "500", COMPANY_A);
    const statement = detail?.statement as { status: string; rows: Array<Record<string, unknown>> };
    // The row must still be present and correctly amounted — never removed
    // just because its linked document row can't be resolved.
    expect(statement.rows).toHaveLength(1);
    expect(statement.rows[0]).toMatchObject({ transactionId: "txn-orphan", amountInTrl: 300 });
    expect(statement.rows[0].displayDescription).toBe("Fallback text");
  });

  it("supplier detail never fetches supplierDocuments/supplierPayments — that dual-role fetch is customer-detail-only (no supplier-facing statement screen exists to consume it)", async () => {
    const admin = createFakeSupabaseAdmin(seedTwoCompanies());
    const detail = await handleDetail(admin, "suppliers", "600", COMPANY_A);
    expect(detail?.supplierDocuments).toEqual([]);
    expect(detail?.supplierPayments).toEqual([]);
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

describe("handleSyncStatus — PHASE 1B health snapshot", () => {
  // The shared fixture's runs are dated 2026-07-01, deliberately OUTSIDE the
  // 24h health window — so these tests inject their own fresh-dated runs.
  function seedWithFreshRuns(statusA: string): Record<string, FakeRow[]> {
    const seed = seedTwoCompanies();
    const freshAt = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    const completedAt = new Date(Date.now() - 4 * 60 * 1000).toISOString();
    const resourceTypes = ["accounts", "contacts", "products", "sales_invoices", "purchase_bills", "checks", "transaction_history_items"];
    const existing = seed["parasut.sync_runs"] ?? [];
    seed["parasut.sync_runs"] = existing.concat(
      ([] as unknown as FakeRow[]).concat(
        ...resourceTypes.map((resource_type, index) => {
          const startedAt = new Date(Date.parse(freshAt) - index * 1000).toISOString();
          return [
            {
              id: `fresh-a-${resource_type}`,
              company_id: COMPANY_A,
              parasut_company_id: "666034",
              resource_type,
              trigger_type: "scheduled",
              status: statusA,
              started_at: startedAt,
              completed_at: statusA === "running" ? null : completedAt,
              request_metadata: {},
            },
            {
              id: `fresh-b-${resource_type}`,
              company_id: COMPANY_B,
              parasut_company_id: "666035",
              resource_type,
              trigger_type: "scheduled",
              status: "completed",
              started_at: startedAt,
              completed_at: completedAt,
              request_metadata: {},
            },
          ] as unknown as FakeRow[];
        }),
      ),
    );
    return seed;
  }

  it("attaches a machine-readable health snapshot computed from the bounded window, honoring the pause flag", async () => {
    const admin = createFakeSupabaseAdmin(seedWithFreshRuns("completed"));
    const healthy = await handleSyncStatus(admin, { emergencyPauseActive: false }, COMPANY_A);
    expect(healthy.health).toBeDefined();
    expect(healthy.health.status).toBe("ok");
    expect(healthy.health.resources.length).toBeGreaterThan(0);
    const contacts = healthy.health.resources.find((r) => r.resourceType === "contacts");
    expect(contacts?.freshness).toBe("fresh");
    expect(contacts?.lastSuccessfulSyncAt).not.toBeNull();

    const paused = await handleSyncStatus(admin, { emergencyPauseActive: true }, COMPANY_A);
    expect(paused.health.status).toBe("paused");
    expect(paused.health.emergencyPauseActive).toBe(true);
    expect(paused.health.alerts.some((alert) => alert.code === "SYNC_PAUSED")).toBe(true);
  });

  it("health window is company-scoped and reflects per-company run outcomes", async () => {
    const admin = createFakeSupabaseAdmin(seedWithFreshRuns("failed"));
    const statusB = await handleSyncStatus(admin, { emergencyPauseActive: false }, COMPANY_B);
    const contactsB = statusB.health.resources.find((r) => r.resourceType === "contacts");
    expect(contactsB?.latestStatus).toBe("completed"); // B's even-indexed resources completed
    const statusA = await handleSyncStatus(admin, { emergencyPauseActive: false }, COMPANY_A);
    const contactsA = statusA.health.resources.find((r) => r.resourceType === "contacts");
    expect(contactsA?.latestStatus).toBe("failed"); // A's resources failed
    expect(statusA.health.alerts.some((alert) => alert.code === "LAST_RUN_FAILED")).toBe(true);
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
