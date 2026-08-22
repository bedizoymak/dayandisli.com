import { describe, expect, it } from "vitest";
import {
  buildCustomerLedgerRows,
  buildPaymentToDocumentMap,
  deriveOpeningBalanceRow,
  filterBalanceDocuments,
  sortLedgerRows,
  type LedgerCheckInput,
  type LedgerDocumentRow,
  type LedgerPaymentRow,
  type LedgerRow,
} from "./customerLedger";

const CONTACT = "1011029161"; // arbitrary test contact id — never a hardcoded production value beyond this fixture's own scope

function invoice(overrides: Partial<Record<string, unknown>> & { parasut_id?: string } = {}): LedgerDocumentRow {
  const { parasut_id, ...attributeOverrides } = overrides;
  return {
    parasut_id: parasut_id ?? "inv-1",
    attributes: {
      invoice_no: "HD001",
      issue_date: "2026-01-10",
      currency: "TRL",
      exchange_rate: "1",
      gross_total: "100",
      net_total: "120",
      total_vat: "20",
      item_type: "invoice",
      ...attributeOverrides,
    },
    relationships: {},
  };
}

function payment(id: string, amount: string, date: string, overrides: Partial<Record<string, unknown>> = {}): LedgerPaymentRow {
  return { parasut_id: id, attributes: { amount, date, ...overrides } };
}

function check(overrides: Partial<LedgerCheckInput> = {}): LedgerCheckInput {
  return {
    id: "parasut:chk-1",
    direction: "received",
    date: "2026-02-01",
    dueDate: "2026-03-01",
    currency: "TRY",
    originalAmount: 1000,
    amountTry: 1000,
    settlementStatus: "open",
    description: "Çek 123",
    ...overrides,
  };
}

describe("filterBalanceDocuments", () => {
  it("keeps a real invoice and drops a cancelled one", () => {
    const kept = invoice({ item_type: "invoice" });
    const cancelled = invoice({ item_type: "cancelled" });
    expect(filterBalanceDocuments([kept, cancelled])).toEqual([kept]);
  });
});

describe("buildPaymentToDocumentMap", () => {
  it("maps a payment id to its parent document via relationships.payments.data", () => {
    const document: LedgerDocumentRow = {
      parasut_id: "inv-1",
      attributes: { invoice_no: "HD001" },
      relationships: { payments: { data: [{ id: "pay-1" }, { id: "pay-2" }] } },
    };
    const map = buildPaymentToDocumentMap([document]);
    expect(map.get("pay-1")?.attributes?.invoice_no).toBe("HD001");
    expect(map.get("pay-2")?.attributes?.invoice_no).toBe("HD001");
  });
});

describe("buildCustomerLedgerRows — accounting directions", () => {
  it("1. tax-inclusive sales invoice -> Debit, using net_total (the real payable amount), not gross_total", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [invoice({ gross_total: "72000", net_total: "86400", total_vat: "14400" })],
      payments: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ transactionType: "sales_invoice", debit: 86400, credit: 0 });
  });

  it("2. tax-exempt sales invoice -> Debit, net_total equals gross_total when total_vat is 0", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [invoice({ gross_total: "50000", net_total: "50000", total_vat: "0" })],
      payments: [],
    });
    expect(rows[0]).toMatchObject({ transactionType: "sales_invoice", debit: 50000, credit: 0 });
  });

  it("3. purchase invoice -> Credit (not debit)", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [],
      payments: [],
      supplierDocuments: [invoice({ invoice_no: "PIN2024", gross_total: "449800", net_total: "539760", total_vat: "89960" })],
      supplierPayments: [],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ transactionType: "purchase_bill", debit: 0, credit: 539760 });
  });

  it("4. customer collection -> Credit", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [invoice()],
      payments: [payment("p1", "30000", "2026-01-11")],
    });
    const collection = rows.find((r) => r.transactionType === "customer_collection");
    expect(collection).toMatchObject({ debit: 0, credit: 30000 });
  });

  it("5. supplier payment -> Debit (not credit)", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [],
      payments: [],
      supplierDocuments: [invoice({ invoice_no: "PIN2024" })],
      supplierPayments: [payment("sp1", "250000", "2024-03-15")],
    });
    const supplierPayment = rows.find((r) => r.transactionType === "supplier_payment");
    expect(supplierPayment).toMatchObject({ debit: 250000, credit: 0 });
  });

  it("6. received check -> Credit", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [],
      payments: [],
      receivedChecks: [check({ id: "parasut:1", direction: "received", originalAmount: 5000, amountTry: 5000 })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ transactionType: "received_check", debit: 0, credit: 5000 });
  });

  it("7. issued check -> Debit", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [],
      payments: [],
      issuedChecks: [check({ id: "parasut:2", direction: "issued", originalAmount: 3000, amountTry: 3000 })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ transactionType: "issued_check", debit: 3000, credit: 0 });
  });
});

describe("buildCustomerLedgerRows — opening balance derivation", () => {
  it("8. opening debit balance: derived when trl_balance exceeds the native ledger's net effect", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [invoice({ issue_date: "2026-01-05", net_total: "1000" })],
      payments: [],
      trlBalance: 1200, // 200 more than the single 1000 invoice explains
    });
    const opening = rows.find((r) => r.transactionType === "opening_balance");
    expect(opening).toMatchObject({ provenance: "derived", debit: 200, credit: 0 });
  });

  it("9. opening credit balance: negative residual derives a credit row", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [invoice({ issue_date: "2026-01-05", net_total: "1000" })],
      payments: [],
      trlBalance: 800, // 200 less than the single 1000 invoice explains
    });
    const opening = rows.find((r) => r.transactionType === "opening_balance");
    expect(opening).toMatchObject({ provenance: "derived", debit: 0, credit: 200 });
  });

  it("is omitted when trl_balance is not provided", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [invoice({ net_total: "1000" })],
      payments: [],
    });
    expect(rows.some((r) => r.transactionType === "opening_balance")).toBe(false);
  });

  it("is omitted when the residual is within rounding tolerance (native ledger already reconciles)", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [invoice({ issue_date: "2026-01-05", net_total: "1000" })],
      payments: [],
      trlBalance: 1000.004,
    });
    expect(rows.some((r) => r.transactionType === "opening_balance")).toBe(false);
  });

  it("is omitted when there is no native row to anchor a date to (ambiguous — never guessed)", () => {
    const rows = buildCustomerLedgerRows({ contactParasutId: CONTACT, documents: [], payments: [], trlBalance: 500 });
    expect(rows).toHaveLength(0);
  });

  it("deriveOpeningBalanceRow preserves its derivation inputs in derivationNote", () => {
    const nativeRows: LedgerRow[] = [
      { sourceResource: "sales_invoices", sourceId: "1", contactParasutId: CONTACT, transactionType: "sales_invoice", date: "2026-01-05", dueDate: null, currency: "TRY", originalAmount: 1000, amountTry: 1000, debit: 1000, credit: 0, description: "", relatedDocumentIds: [], cancelled: false, balanceImpacting: true, provenance: "native" },
    ];
    const row = deriveOpeningBalanceRow(nativeRows, CONTACT, 1200);
    expect(row?.derivationNote).toContain("1200.00");
    expect(row?.derivationNote).toContain("1000.00");
  });
});

describe("buildCustomerLedgerRows — dual-role contact", () => {
  it("10. customer-side and supplier-side rows both appear in one unified, date-sorted ledger", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [invoice({ issue_date: "2026-03-01" })],
      payments: [payment("p1", "50000", "2026-03-05")],
      supplierDocuments: [invoice({ invoice_no: "PIN2024", issue_date: "2024-03-14", gross_total: "449800", net_total: "539760" })],
      supplierPayments: [payment("sp1", "539760", "2024-03-15")],
    });
    expect(rows.map((r) => r.transactionType)).toEqual(["purchase_bill", "supplier_payment", "sales_invoice", "customer_collection"]);
    expect(rows.map((r) => r.date)).toEqual([...rows.map((r) => r.date)].sort());
  });
});

describe("buildCustomerLedgerRows — check/allocation deduplication", () => {
  it("11+13. a check allocated across multiple invoices appears ONCE at its full face value; the fragments are excluded from the credit total (no double counting)", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [invoice({ parasut_id: "inv-a" }), invoice({ parasut_id: "inv-b" })],
      payments: [payment("f1", "86400", "2025-02-08"), payment("f2", "71520", "2025-02-08"), payment("f3", "210240", "2025-02-08")],
      receivedChecks: [check({ id: "parasut:chk-feb", date: "2025-02-08", originalAmount: 400000, amountTry: 400000 })],
    });
    const checkRow = rows.find((r) => r.transactionType === "received_check");
    const collectionRows = rows.filter((r) => r.transactionType === "customer_collection");
    expect(checkRow).toMatchObject({ credit: 400000 }); // face value, not the 368,160 fragment sum
    expect(collectionRows).toHaveLength(0); // fragments fully subsumed
    expect(checkRow?.relatedDocumentIds.sort()).toEqual(["f1", "f2", "f3"]);
    expect(rows.reduce((sum, r) => sum + r.credit, 0)).toBe(400000); // never double-counted
  });

  it("12. a check partially settling an opening balance still shows its full face value even though fragments sum to less", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [invoice()],
      payments: [payment("f1", "368160", "2025-02-08")], // real check was 400,000; only this much is invoice-linked
      receivedChecks: [check({ id: "parasut:chk-feb", date: "2025-02-08", originalAmount: 400000, amountTry: 400000 })],
    });
    const checkRow = rows.find((r) => r.transactionType === "received_check");
    expect(checkRow?.credit).toBe(400000);
    expect(rows.some((r) => r.transactionType === "customer_collection")).toBe(false);
  });

  it("does not merge same-day fragments when no backing check exists for that date (fuzzy date-only matching is never applied)", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [invoice()],
      payments: [payment("f1", "37509.11", "2026-08-10"), payment("f2", "162490.89", "2026-08-10")],
      receivedChecks: [], // no check backs this date
    });
    const collectionRows = rows.filter((r) => r.transactionType === "customer_collection");
    expect(collectionRows).toHaveLength(2);
    expect(collectionRows.reduce((sum, r) => sum + r.credit, 0)).toBe(200000);
  });

  it("skips attribution entirely when two checks share the same date for the same contact (ambiguous — never guessed)", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [invoice()],
      payments: [payment("f1", "500", "2026-05-01")],
      receivedChecks: [
        check({ id: "parasut:chk-a", date: "2026-05-01", originalAmount: 300, amountTry: 300 }),
        check({ id: "parasut:chk-b", date: "2026-05-01", originalAmount: 200, amountTry: 200 }),
      ],
    });
    expect(rows.filter((r) => r.transactionType === "received_check")).toHaveLength(2);
    const collection = rows.find((r) => r.transactionType === "customer_collection");
    expect(collection).toBeDefined(); // the fragment stays standalone, not silently dropped
    expect(rows.reduce((sum, r) => sum + r.credit, 0)).toBe(300 + 200 + 500);
  });
});

describe("buildCustomerLedgerRows — exclusions and ordering", () => {
  it("15. cancelled sales invoice is excluded", () => {
    const rows = buildCustomerLedgerRows({ contactParasutId: CONTACT, documents: [invoice({ item_type: "cancelled" })], payments: [] });
    expect(rows).toHaveLength(0);
  });

  it("16. a cancelled/returned check is excluded (non-balance-impacting)", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [],
      payments: [],
      receivedChecks: [check({ settlementStatus: "cancelled" }), check({ id: "parasut:ret", settlementStatus: "returned" })],
    });
    expect(rows).toHaveLength(0);
  });

  it("a foreign-currency check with no supplied TRY amount is shown but never contributes a fabricated debit/credit", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [],
      payments: [],
      receivedChecks: [check({ currency: "USD", originalAmount: 1000, amountTry: null })],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ debit: 0, credit: 0, balanceImpacting: false });
  });

  it("a foreign-currency check WITH a supplied TRY amount counts normally", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [],
      payments: [],
      receivedChecks: [check({ currency: "USD", originalAmount: 1000, amountTry: 34000 })],
    });
    expect(rows[0]).toMatchObject({ debit: 0, credit: 34000, balanceImpacting: true });
  });

  it("17. foreign-currency invoice converts net_total to TRY using the invoice's own exchange_rate", () => {
    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: [invoice({ currency: "USD", exchange_rate: "34", net_total: "1000", gross_total: "800" })],
      payments: [],
    });
    expect(rows[0].debit).toBe(34000);
    expect(rows[0].originalAmount).toBe(1000);
  });

  it("18. same-day rows sort deterministically (opening balance first, then by stable sourceId)", () => {
    const sorted = sortLedgerRows([
      { sourceResource: "payments", sourceId: "z-payment", contactParasutId: CONTACT, transactionType: "customer_collection", date: "2026-01-01", dueDate: null, currency: "TRY", originalAmount: 1, amountTry: 1, debit: 0, credit: 1, description: "", relatedDocumentIds: [], cancelled: false, balanceImpacting: true, provenance: "native" },
      { sourceResource: "sales_invoices", sourceId: "a-invoice", contactParasutId: CONTACT, transactionType: "sales_invoice", date: "2026-01-01", dueDate: null, currency: "TRY", originalAmount: 1, amountTry: 1, debit: 1, credit: 0, description: "", relatedDocumentIds: [], cancelled: false, balanceImpacting: true, provenance: "native" },
      { sourceResource: "opening_balance", sourceId: "opening-balance:x", contactParasutId: CONTACT, transactionType: "opening_balance", date: "2026-01-01", dueDate: null, currency: "TRY", originalAmount: 1, amountTry: 1, debit: 1, credit: 0, description: "", relatedDocumentIds: [], cancelled: false, balanceImpacting: true, provenance: "derived" },
    ]);
    expect(sorted.map((r) => r.sourceResource)).toEqual(["opening_balance", "sales_invoices", "payments"]);
  });

  it("rows without a date are dropped rather than corrupting the sort", () => {
    const rows = buildCustomerLedgerRows({ contactParasutId: CONTACT, documents: [invoice({ issue_date: "" })], payments: [] });
    expect(rows).toHaveLength(0);
  });

  it("14. stable deduplication: the same native record passed twice never produces two rows", () => {
    const doc = invoice({ parasut_id: "dup-1" });
    const rows = buildCustomerLedgerRows({ contactParasutId: CONTACT, documents: [doc, doc], payments: [] });
    expect(rows).toHaveLength(1);
  });
});

describe("buildCustomerLedgerRows — full PİNO-shaped reconciliation (fixture mirrors the audit report's live figures, not hardcoded production data)", () => {
  it("independently reconciles total debit, total credit, and final balance", () => {
    const salesInvoices = [
      invoice({ parasut_id: "si-1", issue_date: "2024-03-28", gross_total: "72000", net_total: "86400", total_vat: "14400" }),
      invoice({ parasut_id: "si-2", issue_date: "2024-06-07", gross_total: "101200", net_total: "121440", total_vat: "20240" }),
      invoice({ parasut_id: "si-3", issue_date: "2024-12-16", gross_total: "337550", net_total: "405060", total_vat: "67510" }),
      invoice({ parasut_id: "si-4", issue_date: "2025-07-11", gross_total: "268000", net_total: "321600", total_vat: "53600" }),
      invoice({ parasut_id: "si-5", issue_date: "2026-04-30", gross_total: "269500", net_total: "323400", total_vat: "53900" }),
      invoice({ parasut_id: "si-6", issue_date: "2026-05-19", gross_total: "139000", net_total: "166800", total_vat: "27800" }),
      invoice({ parasut_id: "si-7", issue_date: "2026-06-09", gross_total: "385000", net_total: "462000", total_vat: "77000" }),
      invoice({ parasut_id: "si-8", issue_date: "2026-07-02", gross_total: "384000", net_total: "460800", total_vat: "76800" }),
    ];
    const collections = [
      payment("c1", "30000", "2024-07-11"),
      payment("c2", "19920", "2024-07-30"),
      payment("c3", "86400", "2025-02-08"),
      payment("c4", "71520", "2025-02-08"),
      payment("c5", "210240", "2025-02-08"),
      payment("c6", "100000", "2025-07-28"),
      payment("c7", "73345", "2025-12-02"),
      payment("c8", "17858", "2025-12-02"),
      payment("c9", "70000", "2026-03-03"),
      payment("c10", "90000", "2026-05-08"),
      payment("c11", "4820", "2026-07-24"),
      payment("c12", "160397", "2026-07-24"),
      payment("c13", "285890.89", "2026-07-24"),
      payment("c14", "37509.11", "2026-08-10"),
      payment("c15", "162490.89", "2026-08-10"),
    ];
    const purchaseBill = invoice({ parasut_id: "pb-1", invoice_no: "PIN2024000000032", issue_date: "2024-03-14", gross_total: "449800", net_total: "539760", total_vat: "89960" });
    const supplierPayments = [payment("sp1", "250000", "2024-03-15"), payment("sp2", "100000", "2024-03-18"), payment("sp3", "189760", "2025-03-14")];
    const receivedChecks: LedgerCheckInput[] = [
      check({ id: "parasut:chk-feb", date: "2025-02-08", dueDate: "2025-05-10", originalAmount: 400000, amountTry: 400000, settlementStatus: "paid" }),
      check({ id: "parasut:chk-jul", date: "2026-07-24", dueDate: "2026-09-04", originalAmount: 451107.89, amountTry: 451107.89, settlementStatus: "open" }),
    ];

    const rows = buildCustomerLedgerRows({
      contactParasutId: CONTACT,
      documents: salesInvoices,
      payments: collections,
      supplierDocuments: [purchaseBill],
      supplierPayments,
      receivedChecks,
      trlBalance: 927109.11,
    });

    const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0);
    const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0);
    const finalBalance = totalDebit - totalCredit;

    expect(totalDebit).toBeCloseTo(2919100.0, 2);
    expect(totalCredit).toBeCloseTo(1991990.89, 2);
    expect(finalBalance).toBeCloseTo(927109.11, 2);

    // Independent checks beyond the totals — transaction identity/type/direction/amount/date:
    const opening = rows.find((r) => r.transactionType === "opening_balance");
    expect(opening).toMatchObject({ debit: 31840, credit: 0, provenance: "derived" });

    const purchaseBillRow = rows.find((r) => r.transactionType === "purchase_bill");
    expect(purchaseBillRow).toMatchObject({ sourceId: "pb-1", credit: 539760, debit: 0 });

    const supplierPaymentRows = rows.filter((r) => r.transactionType === "supplier_payment");
    expect(supplierPaymentRows.map((r) => r.debit).sort((a, b) => a - b)).toEqual([100000, 189760, 250000]);

    const febCheck = rows.find((r) => r.sourceId === "parasut:chk-feb");
    expect(febCheck).toMatchObject({ credit: 400000, date: "2025-02-08" });

    const julCheck = rows.find((r) => r.sourceId === "parasut:chk-jul");
    expect(julCheck).toMatchObject({ credit: 451107.89, date: "2026-07-24" });

    const augCollections = rows.filter((r) => r.date === "2026-08-10");
    expect(augCollections).toHaveLength(2); // preserved as separate fragments — no backing check for that date
    expect(augCollections.reduce((sum, r) => sum + r.credit, 0)).toBeCloseTo(200000, 2);

    const invoiceRowsTotal = rows.filter((r) => r.transactionType === "sales_invoice").reduce((sum, r) => sum + r.debit, 0);
    expect(invoiceRowsTotal).toBeCloseTo(2347500.0, 2);
  });
});
