import { describe, expect, it } from "vitest";
import { computeLastInvoice, computeOutstandingBalance, computePaymentBehavior, computeSalesTrend, computeTurnover, CustomerService, type CustomerRepository } from "./customer-service.ts";
import type { MirrorDocument, MirrorPayment } from "../types.ts";

const NOW = new Date("2026-07-15T00:00:00.000Z");

function invoice(overrides: Partial<MirrorDocument>): MirrorDocument {
  return {
    id: "inv-1",
    partyId: "cust-1",
    currency: "TRY",
    netTotal: "100.00",
    grossTotal: "120.00",
    remaining: "0.00",
    totalPaid: "120.00",
    issueDate: "2026-06-01",
    dueDate: "2026-06-15",
    archived: false,
    ...overrides,
  };
}

describe("computeTurnover", () => {
  it("sums gross totals per currency, excluding archived invoices", () => {
    const invoices = [
      invoice({ id: "a", currency: "TRY", grossTotal: "100.00" }),
      invoice({ id: "b", currency: "TRY", grossTotal: "200.00" }),
      invoice({ id: "c", currency: "USD", grossTotal: "50.00" }),
      invoice({ id: "d", currency: "TRY", grossTotal: "999.00", archived: true }),
    ];
    expect(computeTurnover(invoices)).toEqual([
      { currency: "TRY", amount: "300.00" },
      { currency: "USD", amount: "50.00" },
    ]);
  });

  it("returns an empty array for no invoices", () => {
    expect(computeTurnover([])).toEqual([]);
  });
});

describe("computeOutstandingBalance", () => {
  it("only sums invoices with a strictly positive remaining amount", () => {
    const invoices = [invoice({ id: "a", remaining: "50.00" }), invoice({ id: "b", remaining: "0.00" }), invoice({ id: "c", remaining: "0.00", archived: true })];
    expect(computeOutstandingBalance(invoices)).toEqual([{ currency: "TRY", amount: "50.00" }]);
  });
});

describe("computeLastInvoice", () => {
  it("returns the invoice with the latest issue date", () => {
    const invoices = [invoice({ id: "old", issueDate: "2026-01-01" }), invoice({ id: "new", issueDate: "2026-06-01" })];
    expect(computeLastInvoice(invoices)).toEqual({ date: "2026-06-01", id: "new" });
  });

  it("returns nulls for no invoices", () => {
    expect(computeLastInvoice([])).toEqual({ date: null, id: null });
  });
});

describe("computeSalesTrend", () => {
  it("buckets by month and currency within the trailing window", () => {
    const invoices = [invoice({ id: "a", issueDate: "2026-06-10", grossTotal: "100.00" }), invoice({ id: "b", issueDate: "2026-06-20", grossTotal: "50.00" }), invoice({ id: "c", issueDate: "2020-01-01", grossTotal: "999.00" })];
    const trend = computeSalesTrend(invoices, 12, NOW);
    expect(trend).toContainEqual({ month: "2026-06", currency: "TRY", total: "150.00", documentCount: 2 });
    expect(trend.find((point) => point.month === "2020-01")).toBeUndefined();
  });
});

describe("computePaymentBehavior", () => {
  it("classifies payments made on/before the due date as on-time", () => {
    const invoices = [invoice({ id: "a", dueDate: "2026-06-15" })];
    const payments: MirrorPayment[] = [{ id: "p1", documentId: "a", date: "2026-06-15", amount: "120.00", currency: "TRY" }];
    expect(computePaymentBehavior(invoices, payments)).toEqual({ onTimeCount: 1, lateCount: 0, averageDelayDays: null, unresolvedCount: 0 });
  });

  it("classifies payments made after the due date as late and averages the delay", () => {
    const invoices = [invoice({ id: "a", dueDate: "2026-06-01" }), invoice({ id: "b", dueDate: "2026-06-01" })];
    const payments: MirrorPayment[] = [
      { id: "p1", documentId: "a", date: "2026-06-06", amount: "10", currency: "TRY" }, // 5 days late
      { id: "p2", documentId: "b", date: "2026-06-11", amount: "10", currency: "TRY" }, // 10 days late
    ];
    const result = computePaymentBehavior(invoices, payments);
    expect(result.lateCount).toBe(2);
    expect(result.averageDelayDays).toBe(8); // round((5+10)/2)
  });

  it("counts payments with no matching invoice or no due date as unresolved, never as on-time", () => {
    const invoices = [invoice({ id: "a", dueDate: null })];
    const payments: MirrorPayment[] = [
      { id: "p1", documentId: "a", date: "2026-06-01", amount: "10", currency: "TRY" },
      { id: "p2", documentId: "missing", date: "2026-06-01", amount: "10", currency: "TRY" },
    ];
    const result = computePaymentBehavior(invoices, payments);
    expect(result.unresolvedCount).toBe(2);
    expect(result.onTimeCount).toBe(0);
    expect(result.lateCount).toBe(0);
  });
});

describe("CustomerService", () => {
  function makeRepository(invoices: MirrorDocument[], payments: MirrorPayment[]): CustomerRepository {
    return {
      getCustomerProfile: async (id) => ({ id, name: "Test Customer", email: null, phone: null, taxNumber: null }),
      getCustomerInvoices: async () => invoices,
      getCustomerPayments: async () => payments,
    };
  }

  it("composes profile and analytics from the repository port", async () => {
    const invoices = [invoice({ id: "a", grossTotal: "500.00", remaining: "500.00" })];
    const service = new CustomerService(makeRepository(invoices, []));

    const profile = await service.getProfile("cust-1");
    expect(profile?.name).toBe("Test Customer");

    const analytics = await service.getAnalytics("cust-1", NOW);
    expect(analytics.customerId).toBe("cust-1");
    expect(analytics.turnover).toEqual([{ currency: "TRY", amount: "500.00" }]);
    expect(analytics.outstandingBalance).toEqual([{ currency: "TRY", amount: "500.00" }]);
    expect(analytics.invoiceCount).toBe(1);
    expect(analytics.calculatedAt).toBe(NOW.toISOString());
  });

  it("returns null profile when the repository has no matching contact", async () => {
    const service = new CustomerService({ getCustomerProfile: async () => null, getCustomerInvoices: async () => [], getCustomerPayments: async () => [] });
    expect(await service.getProfile("missing")).toBeNull();
  });
});
