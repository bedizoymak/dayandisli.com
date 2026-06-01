# Phase 13 E-Commerce and Shop Foundation Report

## Objective

Phase 13 builds the ERP-side e-commerce foundation for a future `shop.dayandisli.com` structure.

The implementation extends the existing public shop tables and adds ERP management screens for product visibility, categories, orders, customers, campaigns, carts, and payment statuses.

## Existing Shop Reuse

Existing Supabase tables reused:

- `products`
- `product_images`
- `orders`
- `order_items`
- `order_counter`

Existing shop frontend remains available through the current feature flag and public routes. No subdomain deployment was performed.

## Supabase Foundation

Created migration:

- `supabase/migrations/20260601145219_phase13_ecommerce_shop_foundation.sql`

New tables:

- `shop_categories`
- `shop_campaigns`
- `shop_carts`
- `shop_cart_items`
- `shop_payment_statuses`

Extended `products`:

- `shop_category_id`
- `inventory_item_id`
- `is_shop_visible`

Extended `orders`:

- `stakeholder_id`
- `sales_order_id`
- `invoice_id`
- `payment_id`
- `campaign_id`
- `payment_status`

These fields prepare the operational flow:

```text
E-Commerce Order
-> Sales Order
-> Inventory
-> Invoice
-> Collection
```

## ERP Screens Implemented

Implemented in:

- `src/features/erp/ecommerce/ECommercePage.tsx`

Screens/tabs:

- Ürünler
- Kategoriler
- Siparişler
- Müşteriler
- Kampanyalar
- Sepetler
- Ödeme Durumları

Capabilities:

- Product visibility management
- Category creation and activation/deactivation
- Order search and filtering
- Order status and payment status visibility
- E-commerce order to sales order conversion foundation
- Customer visibility from orders
- Campaign creation and activation/deactivation
- Cart monitoring foundation
- Payment status creation and tracking

All visible ERP UI text is Turkish.

## ERP API Updates

Updated:

- `src/features/erp/shared/erpApi.ts`
- `src/features/erp/shared/types.ts`

Added APIs for:

- Shop products
- Shop categories
- Shop orders
- Shop order items
- Shop campaigns
- Shop carts
- Shop payment statuses
- E-commerce order to sales order conversion

The conversion flow currently:

- Creates or links a stakeholder
- Creates a sales order from the e-commerce order
- Copies order items into sales order items
- Links the shop order to the sales order
- Writes an audit log

Invoice, stock reservation, and collection automation are intentionally left as future steps.

## Future Subdomain Readiness

Updated:

- `src/lib/domains.ts`

Added:

- `DEFAULT_SHOP_BASE_URL`
- `getShopBaseUrl()`
- `isShopDomain()`
- `buildShopUrl()`

`shop.dayandisli.com` is prepared as a runtime domain concept, but no deployment or DNS change was made.

## Application Integration

Updated:

- `src/features/erp/apps/applicationRegistry.ts`
- `src/features/erp/index.tsx`
- `src/features/erp/shared/permissions.ts`

The E-Ticaret app now points to ERP commerce routes:

- `/commerce`
- `/commerce/kategoriler`
- `/commerce/siparisler`
- `/commerce/musteriler`
- `/commerce/kampanyalar`
- `/commerce/sepetler`
- `/commerce/odemeler`

Permission keys are registered through the existing application registry and centralized permission catalog.

## Data Rules

Business data remains in Supabase.

Media may continue to use the existing public media/product image model. No FTP-based business data storage was introduced.

## Validation

Command run:

```bash
npm run build
```

Result:

- Build succeeded.
- Existing Browserslist warning remains.
- Existing `pdfjs-dist` eval warning remains.
- Existing jsPDF dynamic/static import warning remains from the Phase 12 export foundation.
- Existing large chunk warning remains.

## Risks

- New shop tables need production RLS review before broad external use.
- Public cart persistence is foundation-only; current public cart still uses the existing frontend cart context.
- Payment status tracking is manual/foundation-level and not integrated with a payment provider.
- Order-to-sales-order conversion does not yet decrement inventory, create invoices, or record collections automatically.
- Product-to-inventory linkage is prepared but not enforced.
- `shop.dayandisli.com` requires deployment, DNS, routing, and environment configuration in a later phase.

## Recommendations

- Add server-side checkout/cart persistence before public subdomain rollout.
- Add payment provider integration only after payment rules are finalized.
- Add automated invoice and collection creation from paid shop orders.
- Add inventory reservation or deduction rules for confirmed shop orders.
- Add RLS policies specific to public shop versus ERP admin access.
- Add branded order confirmation and customer email workflow.

## Proposed Phase 14 Scope

Recommended Phase 14: Website Management and Public Content Administration.

Suggested scope:

- ERP-side website content screens.
- Public media library refinement.
- SEO metadata management.
- Site page visibility controls.
- Product media/category publishing workflow.
- Preparation for shop subdomain routing and public catalog rollout.

