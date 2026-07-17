import { describe, expect, it } from "vitest";
import { computeGrossMargin, computeMovementHistory, computeProductTurnover, computePurchaseQuantity, computeSalesQuantity, ProductService, type ProductProfile, type ProductRepository } from "./product-service.ts";
import type { MirrorLineItem } from "../types.ts";

const NOW = new Date("2026-07-15T00:00:00.000Z");

function lineItem(overrides: Partial<MirrorLineItem>): MirrorLineItem {
  return {
    id: "li-1",
    documentId: "doc-1",
    productId: "prod-1",
    quantity: "1",
    unitPrice: "100.00",
    netTotal: "100.00",
    currency: "TRY",
    date: "2026-06-01",
    ...overrides,
  };
}

const product: ProductProfile = { id: "prod-1", name: "Test Product", code: "P-1", currency: "TRY", buyingPrice: "60.00", buyingCurrency: "TRY" };

describe("computeSalesQuantity / computePurchaseQuantity", () => {
  it("sums quantities exactly, including fractional amounts", () => {
    expect(computeSalesQuantity([lineItem({ quantity: "1.5" }), lineItem({ quantity: "2.5" })])).toBe("4.00");
  });

  it("returns 0.00 for no line items", () => {
    expect(computePurchaseQuantity([])).toBe("0.00");
  });
});

describe("computeProductTurnover", () => {
  it("sums net totals grouped by currency", () => {
    expect(computeProductTurnover([lineItem({ netTotal: "100.00", currency: "TRY" }), lineItem({ netTotal: "50.00", currency: "USD" })])).toEqual([
      { currency: "TRY", amount: "100.00" },
      { currency: "USD", amount: "50.00" },
    ]);
  });
});

describe("computeGrossMargin", () => {
  it("returns revenue minus known cost basis for matching currency, with exact fractional-quantity math", () => {
    const items = [lineItem({ quantity: "2.5", netTotal: "250.00", currency: "TRY" })];
    // cost = 60.00 * 2.5 = 150.00; margin = 250.00 - 150.00 = 100.00
    expect(computeGrossMargin(items, product)).toEqual([{ currency: "TRY", amount: "100.00" }]);
  });

  it("returns null when the product has no known buying price", () => {
    const unknownCostProduct: ProductProfile = { ...product, buyingPrice: null, buyingCurrency: null };
    expect(computeGrossMargin([lineItem({})], unknownCostProduct)).toBeNull();
  });

  it("returns null rather than fabricating a cross-currency margin", () => {
    const items = [lineItem({ currency: "USD" })]; // product's buyingCurrency is TRY
    expect(computeGrossMargin(items, product)).toBeNull();
  });
});

describe("computeMovementHistory", () => {
  it("merges sales (out) and purchases (in) sorted chronologically", () => {
    const sales = [lineItem({ id: "s1", date: "2026-06-10", quantity: "5" })];
    const purchases = [lineItem({ id: "p1", date: "2026-06-01", quantity: "20" })];
    const history = computeMovementHistory(sales, purchases);
    expect(history).toEqual([
      { date: "2026-06-01", direction: "in", quantity: "20", documentId: "doc-1" },
      { date: "2026-06-10", direction: "out", quantity: "5", documentId: "doc-1" },
    ]);
  });
});

describe("ProductService", () => {
  it("returns null analytics when the product doesn't exist", async () => {
    const repository: ProductRepository = { getProduct: async () => null, getProductSalesLineItems: async () => [], getProductPurchaseLineItems: async () => [] };
    const service = new ProductService(repository);
    expect(await service.getAnalytics("missing", NOW)).toBeNull();
  });

  it("composes full analytics from the repository port", async () => {
    const repository: ProductRepository = {
      getProduct: async () => product,
      getProductSalesLineItems: async () => [lineItem({ quantity: "2", netTotal: "200.00" })],
      getProductPurchaseLineItems: async () => [lineItem({ id: "p1", quantity: "10" })],
    };
    const service = new ProductService(repository);
    const analytics = await service.getAnalytics("prod-1", NOW);
    expect(analytics?.salesQuantity).toBe("2.00");
    expect(analytics?.purchaseQuantity).toBe("10.00");
    expect(analytics?.turnover).toEqual([{ currency: "TRY", amount: "200.00" }]);
    expect(analytics?.calculatedAt).toBe(NOW.toISOString());
  });
});
