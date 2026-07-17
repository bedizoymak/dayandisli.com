// CustomerService — ERP business layer. Consumes already-fetched mirror data
// via a repository port (implemented by an adapter in a later phase); never
// touches parasut.* directly, never imports Paraşüt-specific modules.
import { isPositiveDecimal } from "../decimal.ts";
import { buildMonthlyTrend, groupSumByCurrency } from "../aggregation.ts";
import type { CurrencyAmount, CustomerAnalyticsResult, CustomerProfile, MirrorDocument, MirrorPayment, PaymentBehavior, TrendPoint } from "../types.ts";
import type { AccountingProvider } from "../providers/accounting-provider.ts";

export type { CustomerProfile };

/** The narrow slice of AccountingProvider this service needs — satisfied structurally by any real provider, so tests only need to fake these three methods. */
export type CustomerRepository = Pick<AccountingProvider, "getCustomerProfile" | "getCustomerInvoices" | "getCustomerPayments">;

/** Sum of non-archived invoice gross totals, grouped by currency. Never combines currencies. */
export function computeTurnover(invoices: MirrorDocument[]): CurrencyAmount[] {
  const active = invoices.filter((invoice) => !invoice.archived);
  return groupSumByCurrency(active, (invoice) => invoice.grossTotal, (invoice) => invoice.currency);
}

/** Sum of remaining balance on non-archived invoices that still have a positive remaining amount. */
export function computeOutstandingBalance(invoices: MirrorDocument[]): CurrencyAmount[] {
  const open = invoices.filter((invoice) => !invoice.archived && isPositiveDecimal(invoice.remaining));
  return groupSumByCurrency(open, (invoice) => invoice.remaining, (invoice) => invoice.currency);
}

export function computeLastInvoice(invoices: MirrorDocument[]): { date: string | null; id: string | null } {
  if (invoices.length === 0) return { date: null, id: null };
  const latest = [...invoices].sort((a, b) => b.issueDate.localeCompare(a.issueDate))[0];
  return { date: latest.issueDate, id: latest.id };
}

export function computeSalesTrend(invoices: MirrorDocument[], months: number, now: Date): TrendPoint[] {
  return buildMonthlyTrend(invoices, months, now, (invoice) => invoice.grossTotal, (invoice) => invoice.issueDate, (invoice) => invoice.currency);
}

/**
 * Matches each payment to its invoice by id and compares the payment date to
 * the invoice's due date. Payments with no matching invoice, or matching an
 * invoice with no due date, are counted separately as `unresolvedCount` —
 * never silently folded into onTime/late.
 */
export function computePaymentBehavior(invoices: MirrorDocument[], payments: MirrorPayment[]): PaymentBehavior {
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  let onTimeCount = 0;
  let lateCount = 0;
  let delaySumDays = 0;
  let delayCount = 0;
  let unresolvedCount = 0;

  for (const payment of payments) {
    const invoice = invoiceById.get(payment.documentId);
    if (!invoice || !invoice.dueDate) {
      unresolvedCount++;
      continue;
    }
    const delayDays = Math.round((new Date(payment.date).getTime() - new Date(invoice.dueDate).getTime()) / 86_400_000);
    if (delayDays <= 0) {
      onTimeCount++;
    } else {
      lateCount++;
      delaySumDays += delayDays;
      delayCount++;
    }
  }

  return {
    onTimeCount,
    lateCount,
    averageDelayDays: delayCount > 0 ? Math.round(delaySumDays / delayCount) : null,
    unresolvedCount,
  };
}

export class CustomerService {
  constructor(private readonly provider: CustomerRepository) {}

  async getProfile(customerId: string): Promise<CustomerProfile | null> {
    return this.provider.getCustomerProfile(customerId);
  }

  async getAnalytics(customerId: string, now: Date = new Date()): Promise<CustomerAnalyticsResult> {
    const [invoices, payments] = await Promise.all([this.provider.getCustomerInvoices(customerId), this.provider.getCustomerPayments(customerId)]);
    const lastInvoice = computeLastInvoice(invoices);

    return {
      customerId,
      turnover: computeTurnover(invoices),
      outstandingBalance: computeOutstandingBalance(invoices),
      lastInvoiceDate: lastInvoice.date,
      lastInvoiceId: lastInvoice.id,
      invoiceCount: invoices.filter((invoice) => !invoice.archived).length,
      salesTrend: computeSalesTrend(invoices, 12, now),
      paymentBehavior: computePaymentBehavior(invoices, payments),
      calculatedAt: now.toISOString(),
    };
  }
}
