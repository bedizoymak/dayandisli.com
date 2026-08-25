import { describe, expect, it } from "vitest";
import { buildAuthoritativeLedgerRows, buildLedgerPrintRows, statementWarning, type AuthoritativeStatement, type AuthoritativeStatementRow } from "./customerLedger";

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
    // Paid/unpaid is translated for customer-facing text (paid -> Ödendi,
    // unpaid -> Ödenmedi); row.check.paymentStatus itself stays the raw value.
    expect(rows[1].description).toContain("Ödenmedi");
    expect(rows[1].check?.paymentStatus).toBe("unpaid");
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

  it("renders an unmapped transaction type as a visible integrity error, never a guessed side or a silent zero (contract rule 8)", () => {
    const unknown = structuredClone(statement); unknown.rows = [{ ...unknown.rows[0], transactionId: "u1", transactionType: "future_type" }];
    const rows = buildAuthoritativeLedgerRows(unknown, "x");
    const row = rows[0];
    // No side map entry for "future_type" -> debit/credit stay zero (never
    // guessed from the trlBalance delta or any other inference) and the row
    // is flagged unmapped, not silently rendered as if it were fine.
    expect(row).toMatchObject({ transactionType: "unknown", rawTransactionType: "future_type", debit: 0, credit: 0, unmapped: true });
    expect(row.description).toContain("future_type");
    expect(row.description).toContain("Eşlenmemiş");
    // The row itself must still be visible (never hidden), and the
    // unmapped state must surface as a print-blocking warning.
    expect(statementWarning(unknown, rows)).toContain("future_type");
  });

  it("maps every mandatory + evidence-based transaction type to its correct side (contract rule 7/8) — debit and credit types never conflated", () => {
    const debitTypes = ["sales_invoice", "contact_debit", "contact_opening_balance_debit", "check_out"];
    const creditTypes = ["check_in", "contact_credit", "purchase_bill", "contact_opening_balance_credit"];
    for (const type of debitTypes) {
      const withType = structuredClone(statement);
      withType.rows = [{ ...withType.rows[0], transactionId: `debit-${type}`, transactionType: type }];
      const row = buildAuthoritativeLedgerRows(withType, "x")[0];
      expect(row, type).toMatchObject({ debit: 1_000_000, credit: 0, unmapped: false });
    }
    for (const type of creditTypes) {
      const withType = structuredClone(statement);
      withType.rows = [{ ...withType.rows[0], transactionId: `credit-${type}`, transactionType: type }];
      const row = buildAuthoritativeLedgerRows(withType, "x")[0];
      expect(row, type).toMatchObject({ debit: 0, credit: 1_000_000, unmapped: false });
    }
  });

  it("reads amount_in_trl directly for the side amount, never falling back to debit_amount/credit_amount (contract rule 7 — both can be populated on the same row)", () => {
    const bothPopulated = structuredClone(statement);
    // A real production shape: a contact_debit row with IDENTICAL non-null
    // debit_amount and credit_amount — only transaction_type + amount_in_trl
    // can disambiguate this, per the live PİNO evidence in the rebuild report.
    bothPopulated.rows = [{ ...bothPopulated.rows[0], transactionId: "both", transactionType: "contact_debit", amountInTrl: 250_000, debitAmount: 250_000, creditAmount: 250_000 }];
    const row = buildAuthoritativeLedgerRows(bothPopulated, "x")[0];
    expect(row).toMatchObject({ debit: 250_000, credit: 0, originalAmount: 250_000 });
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

  it("shows the exact contract-mandated stale-ledger integrity state when the card balance and the latest mirrored trl_balance disagree (P0, 2026-08-24 production QA — bediz test 1068984956)", () => {
    // Reproduces the live production shape: contact.trl_balance is fresh
    // (-5,000,000) but transaction_history_items is 2 days stale (closing 0)
    // — the backend flags this as contact_balance_mismatch.
    const stale: AuthoritativeStatement = {
      ...statement,
      status: "incomplete",
      diagnostics: ["contact_balance_mismatch"],
      reconciliation: { finalHistoryBalance: 0, contactBalance: -5_000_000 },
    };
    const rows = buildAuthoritativeLedgerRows(stale, "1068984956");
    expect(statementWarning(stale, rows)).toBe("Cari hareketler güncel değil; Paraşüt senkronizasyonu bekleniyor.");
  });

  it("shows a normal (null) warning once the mirrored history is confirmed fresh and matching (fresh-matching-ledger regression, P0)", () => {
    const fresh: AuthoritativeStatement = {
      ...statement,
      status: "reconciled",
      diagnostics: [],
      reconciliation: { finalHistoryBalance: 0, contactBalance: 0 },
    };
    const rows = buildAuthoritativeLedgerRows(fresh, "1068984956");
    expect(statementWarning(fresh, rows)).toBeNull();
  });

  it("uses identical transaction ids, order, amounts, balances and totals for print", () => {
    const screen = buildAuthoritativeLedgerRows(statement, "x");
    const print = buildLedgerPrintRows(screen);
    expect(print.map(({ transactionId, debit, credit, balance }) => ({ transactionId, debit, credit, balance })))
      .toEqual(screen.map(({ transactionId, debit, credit, balance }) => ({ transactionId, debit, credit, balance })));
  });

  it("never invents a synthetic/derived opening-balance row when Paraşüt's own statement has none", () => {
    // No contact_opening_balance_* row anywhere in the input — buildAuthoritativeLedgerRows
    // must not plug one in to explain a nonzero starting balance; row count
    // must exactly equal the authoritative input length.
    const noOpeningBalance = structuredClone(statement);
    const rows = buildAuthoritativeLedgerRows(noOpeningBalance, "x");
    expect(rows).toHaveLength(noOpeningBalance.rows.length);
    expect(rows.some((row) => row.transactionType === "opening_balance")).toBe(false);
  });

  it("keeps same-date checks distinct by their own identity, never merged or deduplicated", () => {
    const sameDateChecks: AuthoritativeStatement = {
      version: 1, status: "reconciled", diagnostics: [], reconciliation: { finalHistoryBalance: 0, contactBalance: 0 },
      rows: [
        { historyItemId: "h1", order: 1, transactionId: "8110409", transactionType: "check_in", date: "2025-03-24", description: "", amountInTrl: 100, debitAmount: 0, creditAmount: 100, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 100, linked: { checkId: "8110409" }, check: { serialNumber: "8110409", bank: "Ziraat Bankası", dueDate: "2025-03-24", paymentStatus: "unpaid" }, allocations: [] },
        { historyItemId: "h2", order: 2, transactionId: "8110410", transactionType: "check_in", date: "2025-03-24", description: "", amountInTrl: 200, debitAmount: 0, creditAmount: 200, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 300, linked: { checkId: "8110410" }, check: { serialNumber: "8110410", bank: "Akbank", dueDate: "2025-03-24", paymentStatus: "unpaid" }, allocations: [] },
      ],
    };
    const rows = buildAuthoritativeLedgerRows(sameDateChecks, "x");
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.transactionId)).toEqual(["8110409", "8110410"]);
    expect(rows[0].description).toContain("8110409");
    expect(rows[0].description).toContain("Ziraat Bankası");
    expect(rows[1].description).toContain("8110410");
    expect(rows[1].description).toContain("Akbank");
  });

  it("renders the check's drawee bank name in the description (P3)", () => {
    const rows = buildAuthoritativeLedgerRows(statement, "x");
    expect(rows[1].description).toContain("Banka");
  });

  it("renders both the invoice number and its free-text description when both are available (P4)", () => {
    const withInvoiceDescription: AuthoritativeStatement = {
      version: 1, status: "reconciled", diagnostics: [], reconciliation: { finalHistoryBalance: 0, contactBalance: 0 },
      rows: [
        { historyItemId: "h1", order: 1, transactionId: "1039435811", transactionType: "sales_invoice", date: "2023-12-12", description: "", displayDescription: "CH02023000000001 — Hira Parts Parça Üretimi", documentNumber: "CH02023000000001", amountInTrl: 57960, debitAmount: 57960, creditAmount: 0, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 57960, linked: {}, allocations: [] },
      ],
    };
    const rows = buildAuthoritativeLedgerRows(withInvoiceDescription, "x");
    expect(rows[0].description).toContain("CH02023000000001");
    expect(rows[0].description).toContain("Hira Parts Parça Üretimi");
  });
});

// Mandatory PİNO reconciliation gate (ledger rebuild contract, 2026-08-23).
// Every row below is the exact live production data for PİNO MAKİNE
// (contact_parasut_id 1011029161), fetched read-only from
// parasut.transaction_history_items LEFT JOIN parasut.transactions and
// recorded verbatim in CLAUDE_CODE_CUSTOMER_LEDGER_REBUILD_REPORT.md — not
// synthesized, not adjusted to make the assertions pass.
describe("PİNO reconciliation gate (mandatory, contract-required)", () => {
  const pinoRows: AuthoritativeStatementRow[] = [
    { historyItemId: "p1", order: 1, transactionId: "1113769850", transactionType: "contact_opening_balance_debit", date: "2024-01-01", description: "", amountInTrl: 31840, debitAmount: 31840, creditAmount: 0, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 31840, linked: {}, allocations: [] },
    { historyItemId: "p2", order: 2, transactionId: "1053118657", transactionType: "purchase_bill", date: "2024-03-14", description: "", amountInTrl: 539760, debitAmount: 0, creditAmount: 539760, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: -507920, linked: {}, allocations: [] },
    { historyItemId: "p3", order: 3, transactionId: "1053119069", transactionType: "contact_debit", date: "2024-03-15", description: "", amountInTrl: 250000, debitAmount: 250000, creditAmount: 250000, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: -257920, linked: {}, allocations: [] },
    { historyItemId: "p4", order: 4, transactionId: "1053451860", transactionType: "contact_debit", date: "2024-03-18", description: "", amountInTrl: 100000, debitAmount: 100000, creditAmount: 100000, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: -157920, linked: {}, allocations: [] },
    { historyItemId: "p5", order: 5, transactionId: "1055140150", transactionType: "sales_invoice", date: "2024-03-28", description: "", amountInTrl: 86400, debitAmount: 86400, creditAmount: 0, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: -71520, linked: {}, allocations: [] },
    { historyItemId: "p6", order: 6, transactionId: "1066601682", transactionType: "sales_invoice", date: "2024-06-07", description: "", amountInTrl: 121440, debitAmount: 121440, creditAmount: 0, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 49920, linked: {}, allocations: [] },
    { historyItemId: "p7", order: 7, transactionId: "1072015377", transactionType: "contact_credit", date: "2024-07-11", description: "", amountInTrl: 30000, debitAmount: 30000, creditAmount: 30000, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 19920, linked: {}, allocations: [] },
    { historyItemId: "p8", order: 8, transactionId: "1075089879", transactionType: "contact_credit", date: "2024-07-30", description: "", amountInTrl: 19920, debitAmount: 19920, creditAmount: 19920, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 0, linked: {}, allocations: [] },
    { historyItemId: "p9", order: 9, transactionId: "1102046568", transactionType: "sales_invoice", date: "2024-12-16", description: "", amountInTrl: 405060, debitAmount: 405060, creditAmount: 0, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 405060, linked: {}, allocations: [] },
    { historyItemId: "p10", order: 10, transactionId: "1113788767", transactionType: "check_in", date: "2025-02-08", description: "", amountInTrl: 400000, debitAmount: 0, creditAmount: 400000, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 5060, linked: {}, allocations: [] },
    { historyItemId: "p11", order: 11, transactionId: "1120488156", transactionType: "contact_debit", date: "2025-03-14", description: "", amountInTrl: 189760, debitAmount: 189760, creditAmount: 189760, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 194820, linked: {}, allocations: [] },
    { historyItemId: "p12", order: 12, transactionId: "1145823212", transactionType: "sales_invoice", date: "2025-07-11", description: "", amountInTrl: 321600, debitAmount: 321600, creditAmount: 0, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 516420, linked: {}, allocations: [] },
    { historyItemId: "p13", order: 13, transactionId: "1149036813", transactionType: "contact_credit", date: "2025-07-28", description: "", amountInTrl: 100000, debitAmount: 100000, creditAmount: 100000, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 416420, linked: {}, allocations: [] },
    { historyItemId: "p14", order: 14, transactionId: "1179268982", transactionType: "check_in", date: "2025-12-02", description: "", amountInTrl: 73345, debitAmount: 0, creditAmount: 73345, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 343075, linked: {}, allocations: [] },
    { historyItemId: "p15", order: 15, transactionId: "1179269242", transactionType: "check_in", date: "2025-12-02", description: "", amountInTrl: 17858, debitAmount: 0, creditAmount: 17858, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 325217, linked: {}, allocations: [] },
    { historyItemId: "p16", order: 16, transactionId: "1202613003", transactionType: "contact_credit", date: "2026-03-03", description: "", amountInTrl: 70000, debitAmount: 70000, creditAmount: 70000, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 255217, linked: {}, allocations: [] },
    { historyItemId: "p17", order: 17, transactionId: "1218486764", transactionType: "sales_invoice", date: "2026-04-30", description: "", amountInTrl: 323400, debitAmount: 323400, creditAmount: 0, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 578617, linked: {}, allocations: [] },
    { historyItemId: "p18", order: 18, transactionId: "1220743734", transactionType: "contact_credit", date: "2026-05-08", description: "", amountInTrl: 90000, debitAmount: 90000, creditAmount: 90000, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 488617, linked: {}, allocations: [] },
    { historyItemId: "p19", order: 19, transactionId: "1223700704", transactionType: "sales_invoice", date: "2026-05-19", description: "", amountInTrl: 166800, debitAmount: 166800, creditAmount: 0, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 655417, linked: {}, allocations: [] },
    { historyItemId: "p20", order: 20, transactionId: "1228711605", transactionType: "sales_invoice", date: "2026-06-09", description: "", amountInTrl: 462000, debitAmount: 462000, creditAmount: 0, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 1117417, linked: {}, allocations: [] },
    { historyItemId: "p21", order: 21, transactionId: "1235416861", transactionType: "sales_invoice", date: "2026-07-02", description: "", amountInTrl: 460800, debitAmount: 460800, creditAmount: 0, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 1578217, linked: {}, allocations: [] },
    { historyItemId: "p22", order: 22, transactionId: "1241403260", transactionType: "check_in", date: "2026-07-24", description: "", amountInTrl: 451107.89, debitAmount: 0, creditAmount: 451107.89, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 1127109.11, linked: {}, allocations: [] },
    { historyItemId: "p23", order: 23, transactionId: "1245892816", transactionType: "contact_credit", date: "2026-08-10", description: "", amountInTrl: 200000, debitAmount: 200000, creditAmount: 200000, unmatchedDebitAmount: 0, unmatchedCreditAmount: 0, trlBalance: 927109.11, linked: {}, allocations: [] },
  ];
  const pinoStatement: AuthoritativeStatement = {
    version: 1, status: "reconciled", diagnostics: [],
    reconciliation: { finalHistoryBalance: 927109.11, contactBalance: 927109.11 },
    rows: pinoRows,
  };

  it("produces exactly 23 rows, no duplicates, no dropped rows", () => {
    const rows = buildAuthoritativeLedgerRows(pinoStatement, "1011029161");
    expect(rows).toHaveLength(23);
    expect(new Set(rows.map((r) => r.transactionId)).size).toBe(23);
  });

  it("matches the mandatory row-type census exactly (8/6/4/3/1/1 = 23)", () => {
    const rows = buildAuthoritativeLedgerRows(pinoStatement, "1011029161");
    const census = rows.reduce<Record<string, number>>((acc, r) => { acc[r.rawTransactionType] = (acc[r.rawTransactionType] ?? 0) + 1; return acc; }, {});
    expect(census).toEqual({
      sales_invoice: 8,
      contact_credit: 6,
      check_in: 4,
      contact_debit: 3,
      purchase_bill: 1,
      contact_opening_balance_debit: 1,
    });
  });

  it("matches the mandatory totals exactly: debit 2,919,100.00 / credit 1,991,990.89 / closing 927,109.11", () => {
    const rows = buildAuthoritativeLedgerRows(pinoStatement, "1011029161");
    const totalDebit = rows.reduce((sum, r) => sum + r.debit, 0);
    const totalCredit = rows.reduce((sum, r) => sum + r.credit, 0);
    const closingBalance = rows[rows.length - 1].balance;
    expect(totalDebit).toBeCloseTo(2_919_100.00, 2);
    expect(totalCredit).toBeCloseTo(1_991_990.89, 2);
    expect(closingBalance).toBeCloseTo(927_109.11, 2);
  });

  it("has zero unmapped rows and no reconciliation warning for the real PİNO dataset", () => {
    const rows = buildAuthoritativeLedgerRows(pinoStatement, "1011029161");
    expect(rows.every((r) => !r.unmapped)).toBe(true);
    expect(statementWarning(pinoStatement, rows)).toBeNull();
  });

  it("preserves Paraşüt statement_order exactly — no date-based reordering", () => {
    const rows = buildAuthoritativeLedgerRows(pinoStatement, "1011029161");
    expect(rows.map((r) => r.transactionId)).toEqual(pinoRows.map((r) => r.transactionId));
  });

  it("uses identical rows/totals for print as for screen (same row model)", () => {
    const rows = buildAuthoritativeLedgerRows(pinoStatement, "1011029161");
    const printRows = buildLedgerPrintRows(rows);
    expect(printRows.map((r) => ({ transactionId: r.transactionId, debit: r.debit, credit: r.credit, balance: r.balance })))
      .toEqual(rows.map((r) => ({ transactionId: r.transactionId, debit: r.debit, credit: r.credit, balance: r.balance })));
  });
});

// ---------------------------------------------------------------------------
// GENERIC MIRROR CONTRACT — synthetic fixtures only.
// Every value below is invented for contacts that played no part in designing
// the implementation. If the engine only worked on the audited reference
// contacts, it would be a fixture-matcher, not a mirror.
// ---------------------------------------------------------------------------

function syntheticRow(overrides: Partial<AuthoritativeStatementRow> & { transactionId: string; order: number; trlBalance: number }): AuthoritativeStatementRow {
  return {
    historyItemId: `syn-${overrides.transactionId}`,
    transactionType: "sales_invoice",
    date: "2026-01-01",
    description: "",
    amountInTrl: 100,
    debitAmount: 100,
    creditAmount: 0,
    unmatchedDebitAmount: 0,
    unmatchedCreditAmount: 0,
    linked: {},
    allocations: [],
    ...overrides,
  } as AuthoritativeStatementRow;
}

describe("generic mirror contract (synthetic arbitrary contact, never used to design the engine)", () => {
  // An arbitrary Paraşüt contact id — deliberately NOT one of the audited
  // reference contacts (1011029161 / 1011029145 / 1011029140 / 1011029141).
  const ARBITRARY_CONTACT = "9900000001";

  function arbitraryContactStatement(): AuthoritativeStatement {
    return {
      version: 1,
      status: "reconciled",
      diagnostics: [],
      reconciliation: { finalHistoryBalance: 800, contactBalance: 800 },
      lastSyncedAt: "2026-08-25T00:00:00Z",
      rows: [
        // statement_order ascending == array order (the server's authoritative sequence).
        syntheticRow({ transactionId: "t-open", order: 1, trlBalance: 1000, transactionType: "contact_opening_balance_debit", amountInTrl: 1000 }),
        syntheticRow({ transactionId: "t-inv", order: 2, trlBalance: 1600, transactionType: "sales_invoice", amountInTrl: 600 }),
        syntheticRow({ transactionId: "t-bill", order: 3, trlBalance: 1300, transactionType: "purchase_bill", amountInTrl: 300 }),
        syntheticRow({ transactionId: "t-coll", order: 4, trlBalance: 1100, transactionType: "contact_credit", amountInTrl: 200 }),
        syntheticRow({ transactionId: "t-chk", order: 5, trlBalance: 600, transactionType: "check_in", amountInTrl: 500 }),
        syntheticRow({ transactionId: "t-deb", order: 6, trlBalance: 700, transactionType: "contact_debit", amountInTrl: 100 }),
        syntheticRow({ transactionId: "t-out", order: 7, trlBalance: 900, transactionType: "check_out", amountInTrl: 200 }),
        syntheticRow({ transactionId: "t-opencr", order: 8, trlBalance: 800, transactionType: "contact_opening_balance_credit", amountInTrl: 100 }),
      ],
    };
  }

  it("KPI identity holds generically: full-history debits minus credits equal the parent's closing trl_balance", () => {
    const stmt = arbitraryContactStatement();
    const rows = buildAuthoritativeLedgerRows(stmt, ARBITRARY_CONTACT);
    const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
    const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
    expect(totalDebit - totalCredit).toBeCloseTo(stmt.reconciliation!.finalHistoryBalance!, 2);
    expect(rows[rows.length - 1].balance).toBeCloseTo(stmt.reconciliation!.finalHistoryBalance!, 2);
  });

  it("allocation detail attached to any movement never changes KPI totals or balances", () => {
    const withAllocations = arbitraryContactStatement();
    withAllocations.rows[3].allocations = [
      { id: "a1", payableId: "inv-9", amount: 111.11, currency: "TRY", balanceImpacting: false },
      { id: "a2", payableId: "inv-4", amount: 88.89, currency: "TRY", balanceImpacting: false },
    ];
    const plain = buildAuthoritativeLedgerRows(arbitraryContactStatement(), ARBITRARY_CONTACT);
    const decorated = buildAuthoritativeLedgerRows(withAllocations, ARBITRARY_CONTACT);
    const totalsOf = (rows: ReturnType<typeof buildAuthoritativeLedgerRows>) => ({
      debit: rows.reduce((sum, row) => sum + row.debit, 0),
      credit: rows.reduce((sum, row) => sum + row.credit, 0),
      balances: rows.map((row) => row.balance),
    });
    expect(totalsOf(decorated)).toEqual(totalsOf(plain));
  });

  it("duplicate legal identities stay separate: two contacts sharing name/tax number produce fully independent statements", () => {
    const otherContactStatement = arbitraryContactStatement();
    otherContactStatement.rows = [syntheticRow({ transactionId: "z-shared-name-different-id", order: 1, trlBalance: 55, transactionType: "sales_invoice", amountInTrl: 55 })];
    otherContactStatement.reconciliation = { finalHistoryBalance: 55, contactBalance: 55 };

    const rowsA = buildAuthoritativeLedgerRows(arbitraryContactStatement(), ARBITRARY_CONTACT);
    const rowsB = buildAuthoritativeLedgerRows(otherContactStatement, "9900000002");

    // The read model is strictly per-contact: every row carries the contact
    // it was requested for and nothing crosses between the two populations,
    // even though the underlying legal-entity attributes would be identical.
    expect(rowsA.every((row) => row.contactParasutId === ARBITRARY_CONTACT)).toBe(true);
    expect(rowsB.every((row) => row.contactParasutId === "9900000002")).toBe(true);
    expect(rowsA.some((row) => rowsB.some((other) => other.transactionId === row.transactionId))).toBe(false);
    expect(rowsA[rowsA.length - 1].balance).toBe(800);
    expect(rowsB[rowsB.length - 1].balance).toBe(55);
  });

  it("an unknown transaction type on the arbitrary contact breaks the identity VISIBLY instead of rendering a plausible wrong total", () => {
    const degraded = arbitraryContactStatement();
    degraded.status = "incomplete";
    degraded.diagnostics = ["unmapped_transaction_type:t-deb:new_parent_type"];
    degraded.rows[5] = syntheticRow({ transactionId: "t-deb", order: 6, trlBalance: 700, transactionType: "new_parent_type", amountInTrl: 100 });
    const rows = buildAuthoritativeLedgerRows(degraded, ARBITRARY_CONTACT);
    const totalDebit = rows.reduce((sum, row) => sum + row.debit, 0);
    const totalCredit = rows.reduce((sum, row) => sum + row.credit, 0);
    // With the unmapped movement contributing no side, the naive identity no
    // longer closes — which is exactly why the warning must fire (and print
    // block) rather than presenting the numbers as authoritative.
    expect(totalDebit - totalCredit).not.toBeCloseTo(degraded.reconciliation!.finalHistoryBalance!, 2);
    expect(statementWarning(degraded, rows)).toContain("new_parent_type");
  });
});
