// SupplierService — ERP business layer. Mirrors CustomerService's structure
// for the purchase side. See ERP_BUSINESS_ARCHITECTURE.md.
import { isPositiveDecimal } from "../decimal.ts";
import { buildMonthlyTrend, groupSumByCurrency } from "../aggregation.ts";
import { computePaymentBehavior } from "./customer-service.ts";
import type { CurrencyAmount, MirrorDocument, MirrorPayment, SupplierAnalyticsResult, SupplierProfile, SupplierScore, TrendPoint } from "../types.ts";
import type { AccountingProvider } from "../providers/accounting-provider.ts";

export type { SupplierProfile };

/** The narrow slice of AccountingProvider this service needs — satisfied structurally by any real provider, so tests only need to fake these three methods. */
export type SupplierRepository = Pick<AccountingProvider, "getSupplierProfile" | "getSupplierBills" | "getSupplierPayments">;

export function computePurchaseTotal(bills: MirrorDocument[]): CurrencyAmount[] {
  const active = bills.filter((bill) => !bill.archived);
  return groupSumByCurrency(active, (bill) => bill.grossTotal, (bill) => bill.currency);
}

export function computeOutstandingBalance(bills: MirrorDocument[]): CurrencyAmount[] {
  const open = bills.filter((bill) => !bill.archived && isPositiveDecimal(bill.remaining));
  return groupSumByCurrency(open, (bill) => bill.remaining, (bill) => bill.currency);
}

export function computePurchaseTrend(bills: MirrorDocument[], months: number, now: Date): TrendPoint[] {
  return buildMonthlyTrend(bills, months, now, (bill) => bill.grossTotal, (bill) => bill.issueDate, (bill) => bill.currency);
}

/**
 * Heuristic 0-100 score from the only two signals currently available in the
 * mirror: how reliably the ERP paid this supplier on time, and how many of
 * their bills are currently overdue. This is NOT a validated business
 * formula — it exists as an initial ERP-owned metric to be refined once
 * `supplier_scores` (a public.* table, a later phase) lets a human override
 * or tune it. Formula: 70% weight on-time payment ratio + 30% weight
 * (1 - overdue ratio), scaled to 0-100. Returns `onTimePaymentRatio: null`
 * when there is no resolved payment history at all (never fabricates a ratio
 * from zero data).
 */
export function computeSupplierScore(bills: MirrorDocument[], payments: MirrorPayment[], now: Date): SupplierScore {
  const behavior = computePaymentBehavior(bills, payments);
  const resolvedCount = behavior.onTimeCount + behavior.lateCount;
  const onTimePaymentRatio = resolvedCount > 0 ? behavior.onTimeCount / resolvedCount : null;

  const activeBills = bills.filter((bill) => !bill.archived);
  const overdueBillCount = activeBills.filter((bill) => isPositiveDecimal(bill.remaining) && bill.dueDate !== null && new Date(bill.dueDate) < now).length;
  const overdueRatio = activeBills.length > 0 ? overdueBillCount / activeBills.length : 0;

  const paymentComponent = (onTimePaymentRatio ?? 0.5) * 70; // neutral midpoint when no history yet
  const overdueComponent = (1 - overdueRatio) * 30;
  const value = Math.round(paymentComponent + overdueComponent);

  return { value, onTimePaymentRatio, overdueBillCount };
}

export class SupplierService {
  constructor(private readonly provider: SupplierRepository) {}

  async getProfile(supplierId: string): Promise<SupplierProfile | null> {
    return this.provider.getSupplierProfile(supplierId);
  }

  async getAnalytics(supplierId: string, now: Date = new Date()): Promise<SupplierAnalyticsResult> {
    const [bills, payments] = await Promise.all([this.provider.getSupplierBills(supplierId), this.provider.getSupplierPayments(supplierId)]);

    return {
      supplierId,
      purchaseTotal: computePurchaseTotal(bills),
      outstandingBalance: computeOutstandingBalance(bills),
      billCount: bills.filter((bill) => !bill.archived).length,
      purchaseTrend: computePurchaseTrend(bills, 12, now),
      paymentBehavior: computePaymentBehavior(bills, payments),
      averageLeadTimeDays: null,
      score: computeSupplierScore(bills, payments, now),
      calculatedAt: now.toISOString(),
    };
  }
}
