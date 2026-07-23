import { describe, expect, it } from "vitest";
import { createFakeSupabaseAdmin, type FakeRow } from "./fakeSupabaseAdmin.ts";
import {
  handleDashboard,
  handleDetail,
  handleList,
  handlePaymentsList,
  handleReports,
  handleSyncStatus,
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
        attributes: { invoice_no: "INV-A-1", currency: "TRY", net_total: "100", gross_total: "120", total_vat: "20", remaining: "120", total_paid: "0", issue_date: "2026-07-01", archived: false },
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
    expect(reportA.salesSummary).toEqual([{ currency: "TRY", count: 1, net: "100.00", vat: "20.00", gross: "120.00" }]);
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
