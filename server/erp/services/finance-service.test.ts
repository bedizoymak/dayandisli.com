import { describe, expect, it } from "vitest";
import { computeCashPosition, computeMonthlySummary, computeOverduePayables, computeOverdueReceivables, computeTotalPayables, computeTotalReceivables, FinanceService, type FinanceRepository } from "./finance-service.ts";
import type { MirrorAccount, MirrorDocument } from "../types.ts";

const NOW = new Date("2026-07-15T00:00:00.000Z");

function doc(overrides: Partial<MirrorDocument>): MirrorDocument {
  return {
    id: "d1",
    partyId: "p1",
    currency: "TRY",
    netTotal: "100.00",
    grossTotal: "120.00",
    remaining: "50.00",
    totalPaid: "70.00",
    issueDate: "2026-06-01",
    dueDate: "2026-06-15",
    archived: false,
    ...overrides,
  };
}

describe("computeTotalReceivables / computeTotalPayables", () => {
  it("sums only open (positive remaining, non-archived) documents by currency", () => {
    const docs = [doc({ id: "a", remaining: "50.00" }), doc({ id: "b", remaining: "0.00" }), doc({ id: "c", remaining: "999.00", archived: true })];
    expect(computeTotalReceivables(docs)).toEqual([{ currency: "TRY", amount: "50.00" }]);
    expect(computeTotalPayables(docs)).toEqual([{ currency: "TRY", amount: "50.00" }]);
  });
});

describe("computeOverdueReceivables / computeOverduePayables", () => {
  it("only counts open documents whose due date has passed", () => {
    const docs = [doc({ id: "past-due", dueDate: "2026-01-01", remaining: "100.00" }), doc({ id: "not-due", dueDate: "2026-12-31", remaining: "50.00" }), doc({ id: "no-due-date", dueDate: null, remaining: "10.00" })];
    const overdue = computeOverdueReceivables(docs, NOW);
    expect(overdue.count).toBe(1);
    expect(overdue.totals).toEqual([{ currency: "TRY", amount: "100.00" }]);
  });

  it("never counts a fully-paid document as overdue even if its due date passed", () => {
    const docs = [doc({ id: "paid", dueDate: "2026-01-01", remaining: "0.00" })];
    expect(computeOverduePayables(docs, NOW).count).toBe(0);
  });
});

describe("computeCashPosition", () => {
  it("sums non-archived account balances by currency", () => {
    const accounts: MirrorAccount[] = [
      { id: "a1", name: "Bank A", currency: "TRY", balance: "1000.00", archived: false },
      { id: "a2", name: "Bank B", currency: "TRY", balance: "500.00", archived: false },
      { id: "a3", name: "Old", currency: "TRY", balance: "999.00", archived: true },
    ];
    expect(computeCashPosition(accounts)).toEqual([{ currency: "TRY", amount: "1500.00" }]);
  });
});

describe("computeMonthlySummary", () => {
  it("buckets document totals by month and currency", () => {
    const docs = [doc({ id: "a", issueDate: "2026-06-05", grossTotal: "120.00" }), doc({ id: "b", issueDate: "2026-06-20", grossTotal: "80.00" })];
    expect(computeMonthlySummary(docs, 12, NOW)).toEqual([{ month: "2026-06", currency: "TRY", total: "200.00", documentCount: 2 }]);
  });
});

describe("FinanceService", () => {
  it("composes a full company-wide summary from the repository port", async () => {
    const repository: FinanceRepository = {
      getAllReceivableDocuments: async () => [doc({ id: "inv", remaining: "500.00" })],
      getAllPayableDocuments: async () => [doc({ id: "bill", remaining: "200.00" })],
      getAccounts: async () => [{ id: "a1", name: "Main", currency: "TRY", balance: "10000.00", archived: false }],
    };
    const service = new FinanceService(repository);
    const summary = await service.getSummary(NOW);

    expect(summary.totalReceivables).toEqual([{ currency: "TRY", amount: "500.00" }]);
    expect(summary.totalPayables).toEqual([{ currency: "TRY", amount: "200.00" }]);
    expect(summary.cashPosition).toEqual([{ currency: "TRY", amount: "10000.00" }]);
    expect(summary.calculatedAt).toBe(NOW.toISOString());
  });
});
