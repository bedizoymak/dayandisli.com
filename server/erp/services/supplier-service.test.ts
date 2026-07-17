import { describe, expect, it } from "vitest";
import { computeOutstandingBalance, computePurchaseTotal, computePurchaseTrend, computeSupplierScore, SupplierService, type SupplierRepository } from "./supplier-service.ts";
import type { MirrorDocument, MirrorPayment } from "../types.ts";

const NOW = new Date("2026-07-15T00:00:00.000Z");

function bill(overrides: Partial<MirrorDocument>): MirrorDocument {
  return {
    id: "bill-1",
    partyId: "sup-1",
    currency: "TRY",
    netTotal: "80.00",
    grossTotal: "100.00",
    remaining: "0.00",
    totalPaid: "100.00",
    issueDate: "2026-06-01",
    dueDate: "2026-06-15",
    archived: false,
    ...overrides,
  };
}

describe("computePurchaseTotal / computeOutstandingBalance", () => {
  it("groups by currency and excludes archived bills", () => {
    const bills = [bill({ id: "a", grossTotal: "100.00" }), bill({ id: "b", grossTotal: "999.00", archived: true })];
    expect(computePurchaseTotal(bills)).toEqual([{ currency: "TRY", amount: "100.00" }]);
  });

  it("only includes bills with a positive remaining amount", () => {
    const bills = [bill({ id: "a", remaining: "40.00" }), bill({ id: "b", remaining: "0.00" })];
    expect(computeOutstandingBalance(bills)).toEqual([{ currency: "TRY", amount: "40.00" }]);
  });
});

describe("computePurchaseTrend", () => {
  it("buckets purchase totals by month and currency", () => {
    const bills = [bill({ id: "a", issueDate: "2026-06-10", grossTotal: "100.00" })];
    expect(computePurchaseTrend(bills, 12, NOW)).toEqual([{ month: "2026-06", currency: "TRY", total: "100.00", documentCount: 1 }]);
  });
});

describe("computeSupplierScore", () => {
  it("returns a neutral score with null onTimePaymentRatio when there is no payment history", () => {
    const score = computeSupplierScore([], [], NOW);
    expect(score.onTimePaymentRatio).toBeNull();
    expect(score.value).toBe(65); // 0.5*70 + 1*30 (no bills => 0 overdue ratio)
  });

  it("scores a supplier with perfect on-time payments and no overdue bills near 100", () => {
    const bills = [bill({ id: "a", dueDate: "2026-06-15", remaining: "0.00" })];
    const payments: MirrorPayment[] = [{ id: "p1", documentId: "a", date: "2026-06-10", amount: "100", currency: "TRY" }];
    const score = computeSupplierScore(bills, payments, NOW);
    expect(score.onTimePaymentRatio).toBe(1);
    expect(score.overdueBillCount).toBe(0);
    expect(score.value).toBe(100);
  });

  it("counts a bill with a passed due date and remaining balance as overdue", () => {
    const bills = [bill({ id: "a", dueDate: "2026-01-01", remaining: "50.00" })];
    const score = computeSupplierScore(bills, [], NOW);
    expect(score.overdueBillCount).toBe(1);
  });
});

describe("SupplierService", () => {
  it("composes profile and analytics from the repository port", async () => {
    const bills = [bill({ id: "a", grossTotal: "300.00" })];
    const repository: SupplierRepository = {
      getSupplierProfile: async (id) => ({ id, name: "Test Supplier", email: null, phone: null, taxNumber: null }),
      getSupplierBills: async () => bills,
      getSupplierPayments: async () => [],
    };
    const service = new SupplierService(repository);

    const profile = await service.getProfile("sup-1");
    expect(profile?.name).toBe("Test Supplier");

    const analytics = await service.getAnalytics("sup-1", NOW);
    expect(analytics.supplierId).toBe("sup-1");
    expect(analytics.purchaseTotal).toEqual([{ currency: "TRY", amount: "300.00" }]);
    expect(analytics.averageLeadTimeDays).toBeNull();
    expect(analytics.billCount).toBe(1);
  });
});
