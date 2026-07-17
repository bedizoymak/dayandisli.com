// ProductService — ERP business layer.
//
// NOTE on repository field names: `sales_invoice_details`/`purchase_bill_details`
// line-item attribute keys (quantity, unit price, etc.) have not yet been
// discovery-verified against real Paraşüt API captures (only the parent
// sales_invoices/purchase_bills attribute keys were confirmed — see
// PARASUT_API_DISCOVERY_REPORT.md). The `MirrorLineItem` port shape below is
// this service's own contract; the adapter built in a later phase must map
// real `parasut.sales_invoice_details`/`purchase_bill_details` columns onto
// it — do not assume the field names here match Paraşüt's without checking.
import { multiplyDecimalStrings, subtractDecimalStrings, sumDecimalStrings } from "../decimal.ts";
import { groupSumByCurrency } from "../aggregation.ts";
import type { CurrencyAmount, MirrorLineItem, ProductAnalyticsResult, ProductMovementEvent, ProductProfile } from "../types.ts";
import type { AccountingProvider } from "../providers/accounting-provider.ts";

export type { ProductProfile };

/** The narrow slice of AccountingProvider this service needs — satisfied structurally by any real provider, so tests only need to fake these three methods. */
export type ProductRepository = Pick<AccountingProvider, "getProduct" | "getProductSalesLineItems" | "getProductPurchaseLineItems">;

export function computeSalesQuantity(salesLineItems: MirrorLineItem[]): string {
  return sumDecimalStrings(salesLineItems.map((item) => item.quantity));
}

export function computePurchaseQuantity(purchaseLineItems: MirrorLineItem[]): string {
  return sumDecimalStrings(purchaseLineItems.map((item) => item.quantity));
}

export function computeProductTurnover(salesLineItems: MirrorLineItem[]): CurrencyAmount[] {
  return groupSumByCurrency(salesLineItems, (item) => item.netTotal, (item) => item.currency);
}

/**
 * Sales revenue minus (quantity sold × known buying price), only when the
 * product has a confirmed `buyingPrice` in the SAME currency as the sale —
 * cross-currency margin would require an exchange rate this service does not
 * fabricate. Returns null (not zero) when the cost basis is unknown or the
 * currencies don't match, per the project's established
 * "Hesaplanamıyor" (cannot calculate) convention rather than inventing a number.
 */
export function computeGrossMargin(salesLineItems: MirrorLineItem[], product: ProductProfile): CurrencyAmount[] | null {
  if (!product.buyingPrice || !product.buyingCurrency) return null;

  const sameCurrencyItems = salesLineItems.filter((item) => item.currency === product.buyingCurrency);
  if (sameCurrencyItems.length === 0) return null;

  const totalQuantity = sumDecimalStrings(sameCurrencyItems.map((item) => item.quantity));
  const revenue = groupSumByCurrency(sameCurrencyItems, (item) => item.netTotal, (item) => item.currency)[0]?.amount ?? "0.00";
  const cost = multiplyDecimalStrings(product.buyingPrice, totalQuantity);

  return [{ currency: product.buyingCurrency, amount: subtractDecimalStrings(revenue, cost) }];
}

export function computeMovementHistory(salesLineItems: MirrorLineItem[], purchaseLineItems: MirrorLineItem[]): ProductMovementEvent[] {
  const sales: ProductMovementEvent[] = salesLineItems.map((item) => ({ date: item.date, direction: "out" as const, quantity: item.quantity, documentId: item.documentId }));
  const purchases: ProductMovementEvent[] = purchaseLineItems.map((item) => ({ date: item.date, direction: "in" as const, quantity: item.quantity, documentId: item.documentId }));
  return [...sales, ...purchases].sort((a, b) => a.date.localeCompare(b.date));
}

export class ProductService {
  constructor(private readonly provider: ProductRepository) {}

  async getProfile(productId: string): Promise<ProductProfile | null> {
    return this.provider.getProduct(productId);
  }

  async getAnalytics(productId: string, now: Date = new Date()): Promise<ProductAnalyticsResult | null> {
    const product = await this.provider.getProduct(productId);
    if (!product) return null;

    const [salesLineItems, purchaseLineItems] = await Promise.all([this.provider.getProductSalesLineItems(productId), this.provider.getProductPurchaseLineItems(productId)]);

    return {
      productId,
      salesQuantity: computeSalesQuantity(salesLineItems),
      purchaseQuantity: computePurchaseQuantity(purchaseLineItems),
      turnover: computeProductTurnover(salesLineItems),
      grossMargin: computeGrossMargin(salesLineItems, product),
      movementHistory: computeMovementHistory(salesLineItems, purchaseLineItems),
      calculatedAt: now.toISOString(),
    };
  }
}
