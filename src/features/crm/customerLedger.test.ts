import { describe, expect, it } from "vitest";
import { buildAuthoritativeLedgerRows, buildLedgerPrintRows, statementWarning, type AuthoritativeStatement } from "./customerLedger";

const statement: AuthoritativeStatement = {
  version: 1, status: "reconciled", diagnostics: [], reconciliation: { finalHistoryBalance: 0, contactBalance: 0 },
  rows: [
    { historyItemId: "h1", order: 1, transactionId: "1249095985", transactionType: "contact_debit", date: "2026-08-22", description: "", amountInTrl: 1_000_000, debitAmount: 1_000_000, creditAmount: 0, unmatchedDebitAmount: 1_000_000, unmatchedCreditAmount: 0, trlBalance: 1_000_000, linked: {}, allocations: [] },
    { historyItemId: "h2", order: 2, transactionId: "1249096023", transactionType: "check_in", date: "2026-08-22", description: "", amountInTrl: 1_000_000, debitAmount: 0, creditAmount: 1_000_000, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 0, linked: { checkId: "1001339640" }, check: { serialNumber: "C-1", bank: "Banka", dueDate: "2026-08-31", paymentStatus: "unpaid" }, allocations: [] },
  ],
};

describe("authoritative customer ledger", () => {
  it("renders exactly one balance row per transaction in Paraşüt order", () => {
    const rows = buildAuthoritativeLedgerRows(statement, "1068984956");
    expect(rows.map((row) => row.transactionId)).toEqual(["1249095985", "1249096023"]);
    expect(rows[0]).toMatchObject({ transactionType: "supplier_payment", debit: 1_000_000, credit: 0, balance: 1_000_000 });
    expect(rows[1]).toMatchObject({ transactionType: "received_check", debit: 0, credit: 1_000_000, balance: 0, dueDate: "2026-08-31" });
    expect(rows[1].description).toContain("unpaid");
  });

  it("keeps allocations subordinate and zero-impact", () => {
    const withAllocations = structuredClone(statement);
    withAllocations.rows[1].allocations = [{ id: "p1", payableId: "i1", amount: 400_000, currency: "TRY", balanceImpacting: false }];
    const rows = buildAuthoritativeLedgerRows(withAllocations, "x");
    expect(rows).toHaveLength(2);
    expect(rows[1].allocations?.[0].balanceImpacting).toBe(false);
  });

  it("rejects duplicate/missing identities instead of date or amount deduplication", () => {
    const duplicate = structuredClone(statement); duplicate.rows[1].transactionId = duplicate.rows[0].transactionId;
    expect(() => buildAuthoritativeLedgerRows(duplicate, "x")).toThrow("Duplicate Paraşüt transaction id");
  });

  it("preserves unknown types visibly without inventing a direction, and never leaks the raw enum into the description", () => {
    const unknown = structuredClone(statement); unknown.rows = [{ ...unknown.rows[0], transactionId: "u1", transactionType: "future_type" }];
    const row = buildAuthoritativeLedgerRows(unknown, "x")[0];
    expect(row).toMatchObject({ transactionType: "unknown", rawTransactionType: "future_type", debit: 0, credit: 0 });
    expect(row.description).toBe("Bilinmeyen Paraşüt İşlemi");
  });

  it("uses the backend-resolved displayDescription for known types instead of the raw Paraşüt enum", () => {
    const withDocuments: AuthoritativeStatement = {
      version: 1, status: "reconciled", diagnostics: [], reconciliation: { finalHistoryBalance: 0, contactBalance: 0 },
      rows: [
        { historyItemId: "h1", order: 1, transactionId: "1020079633", transactionType: "sales_invoice", date: "2026-01-01", description: "", displayDescription: "HD02024000000037", documentNumber: "HD02024000000037", amountInTrl: 1000, debitAmount: 1000, creditAmount: 0, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 1000, linked: {}, allocations: [] },
        { historyItemId: "h2", order: 2, transactionId: "1009645883", transactionType: "purchase_bill", date: "2026-01-02", description: "", displayDescription: "PIN2024000000032", documentNumber: "PIN2024000000032", amountInTrl: 200, debitAmount: 0, creditAmount: 200, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 800, linked: {}, allocations: [] },
        { historyItemId: "h3", order: 3, transactionId: "1001079721", transactionType: "contact_opening_balance_debit", date: "2024-01-01", description: "", displayDescription: "Firmanın borcu var", amountInTrl: 500, debitAmount: 500, creditAmount: 0, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 1300, linked: {}, allocations: [] },
        { historyItemId: "h4", order: 4, transactionId: "cc1", transactionType: "contact_credit", date: "2026-01-03", description: "", displayDescription: "Tahsilat", amountInTrl: 300, debitAmount: 0, creditAmount: 300, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 1000, linked: {}, allocations: [] },
        { historyItemId: "h5", order: 5, transactionId: "cd1", transactionType: "contact_debit", date: "2026-01-04", description: "", displayDescription: "Tedarikçi Ödemesi", amountInTrl: 300, debitAmount: 300, creditAmount: 0, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 1300, linked: {}, allocations: [] },
      ],
    };
    const rows = buildAuthoritativeLedgerRows(withDocuments, "x");
    expect(rows.map((row) => row.description)).toEqual(["HD02024000000037", "PIN2024000000032", "Firmanın borcu var", "Tahsilat", "Tedarikçi Ödemesi"]);
    for (const row of rows) {
      expect(row.description).not.toBe(row.rawTransactionType);
    }
  });

  it("warns on unavailable, incomplete, or mathematically inconsistent history", () => {
    expect(statementWarning(null, [])).toContain("henüz senkronize");
    expect(statementWarning({ ...statement, status: "incomplete", diagnostics: ["missing_transaction:x"] }, [])).toContain("missing_transaction:x");
    const rows = buildAuthoritativeLedgerRows(statement, "x");
    expect(statementWarning(statement, rows)).toBeNull();
  });

  it("uses identical transaction ids, order, amounts, balances and totals for print", () => {
    const screen = buildAuthoritativeLedgerRows(statement, "x");
    const print = buildLedgerPrintRows(screen);
    expect(print.map(({ transactionId, debit, credit, balance }) => ({ transactionId, debit, credit, balance })))
      .toEqual(screen.map(({ transactionId, debit, credit, balance }) => ({ transactionId, debit, credit, balance })));
  });
});
