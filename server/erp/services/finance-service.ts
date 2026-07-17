// FinanceService — ERP business layer. Company-wide (not per-party) view over
// receivables/payables/cash. See ERP_BUSINESS_ARCHITECTURE.md.
import { isPositiveDecimal } from "../decimal.ts";
import { buildMonthlyTrend, groupSumByCurrency } from "../aggregation.ts";
import type { CurrencyAmount, FinanceSummary, MirrorAccount, MirrorDocument, TrendPoint } from "../types.ts";
import type { AccountingProvider } from "../providers/accounting-provider.ts";

/** The narrow slice of AccountingProvider this service needs — satisfied structurally by any real provider, so tests only need to fake these three methods. */
export type FinanceRepository = Pick<AccountingProvider, "getAllReceivableDocuments" | "getAllPayableDocuments" | "getAccounts">;

function openDocuments(documents: MirrorDocument[]): MirrorDocument[] {
  return documents.filter((doc) => !doc.archived && isPositiveDecimal(doc.remaining));
}

function overdueDocuments(documents: MirrorDocument[], now: Date): MirrorDocument[] {
  return openDocuments(documents).filter((doc) => doc.dueDate !== null && new Date(doc.dueDate) < now);
}

export function computeTotalReceivables(invoices: MirrorDocument[]): CurrencyAmount[] {
  const open = openDocuments(invoices);
  return groupSumByCurrency(open, (doc) => doc.remaining, (doc) => doc.currency);
}

export function computeTotalPayables(bills: MirrorDocument[]): CurrencyAmount[] {
  const open = openDocuments(bills);
  return groupSumByCurrency(open, (doc) => doc.remaining, (doc) => doc.currency);
}

export function computeOverdueReceivables(invoices: MirrorDocument[], now: Date): { totals: CurrencyAmount[]; count: number } {
  const overdue = overdueDocuments(invoices, now);
  return { totals: groupSumByCurrency(overdue, (doc) => doc.remaining, (doc) => doc.currency), count: overdue.length };
}

export function computeOverduePayables(bills: MirrorDocument[], now: Date): { totals: CurrencyAmount[]; count: number } {
  const overdue = overdueDocuments(bills, now);
  return { totals: groupSumByCurrency(overdue, (doc) => doc.remaining, (doc) => doc.currency), count: overdue.length };
}

export function computeCashPosition(accounts: MirrorAccount[]): CurrencyAmount[] {
  const active = accounts.filter((account) => !account.archived);
  return groupSumByCurrency(active, (account) => account.balance, (account) => account.currency);
}

export function computeMonthlySummary(documents: MirrorDocument[], months: number, now: Date): TrendPoint[] {
  const active = documents.filter((doc) => !doc.archived);
  return buildMonthlyTrend(active, months, now, (doc) => doc.grossTotal, (doc) => doc.issueDate, (doc) => doc.currency);
}

export class FinanceService {
  constructor(private readonly provider: FinanceRepository) {}

  async getSummary(now: Date = new Date()): Promise<FinanceSummary> {
    const [invoices, bills, accounts] = await Promise.all([this.provider.getAllReceivableDocuments(), this.provider.getAllPayableDocuments(), this.provider.getAccounts()]);

    const overdueReceivables = computeOverdueReceivables(invoices, now);
    const overduePayables = computeOverduePayables(bills, now);

    return {
      totalReceivables: computeTotalReceivables(invoices),
      totalPayables: computeTotalPayables(bills),
      overdueReceivables: overdueReceivables.totals,
      overduePayables: overduePayables.totals,
      overdueReceivableCount: overdueReceivables.count,
      overduePayableCount: overduePayables.count,
      cashPosition: computeCashPosition(accounts),
      monthlyReceivablesSummary: computeMonthlySummary(invoices, 12, now),
      monthlyPayablesSummary: computeMonthlySummary(bills, 12, now),
      calculatedAt: now.toISOString(),
    };
  }
}
