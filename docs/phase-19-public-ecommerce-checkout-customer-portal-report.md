# Phase 19 Public E-Commerce Checkout and Customer Portal Report

Date: 2026-06-02

Scope: Activate public commerce operations, checkout foundation, customer portal, inventory visibility, shipping foundations, and ERP handoff while keeping ERP ownership over operational data. No real payment provider was launched.

## Executive Summary

Phase 19 turns the public shop from catalog-only readiness into an operational order-request flow. Customers can search/filter products, add/update/remove cart items, complete a non-payment checkout, and access a Turkish customer portal foundation. Public orders now create ERP sales-order records through a database trigger so the ERP remains the operational authority.

Implemented:

- Re-enabled checkout as a four-step, non-payment flow.
- Added customer, address, shipping, and review steps.
- Added customer portal route `/hesabim`.
- Added inventory visibility labels: available, low stock, out of stock.
- Added shipping method foundation table and public read path.
- Added order/customer ownership, shipping status, tracking number, and inventory reservation fields.
- Added database trigger foundation:
  - public order -> ERP stakeholder
  - public order -> ERP sales order
  - public order item -> ERP sales order item
- Preserved Turkish visible UI.

Production readiness score for this phase: **82 / 100**

The major remaining risks are payment-provider absence by design, public order abuse controls, full customer authentication onboarding, and production-grade inventory reservation enforcement.

## Commerce Architecture

Public commerce remains based on existing ERP-managed records:

```text
ERP Products
-> products / product_images / shop_categories
-> Public shop listing and detail pages
-> Cart
-> Checkout order request
-> ERP Sales Order
```

Implemented public operations:

- Product search through `products.name`, `products.sku`, and `products.category`.
- Category navigation through `/shop/kategori/:categorySlug`.
- Category filtering against `shop_categories` and legacy `products.category`.
- Product recommendations foundation through related products by category.
- Product availability display:
  - `Stokta Var`
  - `Son {n} Adet`
  - `Stokta Yok`

Public shop routes:

| Route | Purpose |
|---|---|
| `/shop` | Product listing, search, filters |
| `/shop/kategori/:categorySlug` | Category listing |
| `/shop/:slug` | Product detail and recommendations |
| `/cart` | Persistent cart |
| `/checkout` | Non-payment checkout foundation |
| `/checkout/success` | Order confirmation |
| `/hesabim` | Customer portal foundation |

## Checkout Architecture

Checkout was restored as a payment-free order request.

Steps:

```text
Müşteri
-> Adres
-> Sevkiyat
-> Onay
-> E-Commerce Order
-> ERP Sales Order
```

Implemented checkout screens:

- `Müşteri`: customer name, company, email, phone.
- `Adres`: billing address and delivery address.
- `Sevkiyat`: shipping method selection.
- `Onay`: final review and ERP-process notice.

Payment status:

- No real payment provider is active.
- Checkout uses `payment_method = erp_review`.
- `payment_status = pending`.
- Visible text makes it clear that payment is not collected during checkout.

Persistence:

- Cart remains persistent through localStorage.
- Customer profile/address context is stored locally as a guest/customer portal foundation.
- Additive database hooks were added to `shop_carts` for future guest/authenticated cart persistence.

## Customer Portal Architecture

New screen:

- `src/features/shop/pages/CustomerPortalPage.tsx`

Route:

- `/hesabim`

Implemented tabs:

- `Siparişlerim`
- `Adreslerim`
- `Profil Bilgilerim`
- Future-ready area for invoices, support requests, and returns.

Customer visibility model:

- Authenticated users can load orders by their Supabase auth email.
- Guest users see locally stored profile/address context.
- Guest order listing is intentionally conservative because anonymous users should not get broad order-read access.
- RLS policies were narrowed so authenticated customer order reads target `customer_user_id` or matching email, with ERP admins retaining management access.

## ERP Integration Flow

Implemented database-side flow:

```text
Public checkout creates orders
-> internal trigger creates or reuses stakeholder
-> internal trigger creates sales_orders
-> order_items trigger creates sales_order_items
-> orders.sales_order_id is linked
-> orders.status becomes confirmed
-> erp_audit_logs records conversion events
```

Why database trigger:

- Guest checkout cannot safely be granted broad ERP table write permissions.
- Frontend-only conversion would either fail for guests or require unsafe client-side ERP privileges.
- Trigger-based conversion keeps the public client limited to public order creation while ERP operational records are created inside the database.

Added migration:

- `supabase/migrations/20260602071443_phase19_public_ecommerce_checkout_customer_portal.sql`

Key migration additions:

- `orders.customer_user_id`
- `orders.billing_address`
- `orders.shipping_address`
- `orders.shipping_method`
- `orders.shipping_status`
- `orders.tracking_number`
- `orders.inventory_reservation_status`
- `orders.checkout_source`
- `orders.customer_reference`
- `order_items.inventory_item_id`
- `order_items.reservation_status`
- `shop_carts.customer_user_id`
- `shop_carts.guest_cart_key`
- `shop_carts.notes`
- `shop_shipping_methods`
- internal trigger functions for ERP sales-order conversion.

## Inventory Visibility Flow

Current public inventory display uses existing product fields:

```text
products.in_stock
products.stock_quantity
-> availability label
-> cart quantity cap
-> checkout line inventory_item_id foundation
```

ERP inventory linkage:

- Product records now carry `inventory_item_id` in public shop types.
- Cart items preserve `inventoryItemId`.
- Checkout order items persist `inventory_item_id`.
- Reservation status starts as `pending`.

Remaining gap:

- Real stock reservation is not yet enforced transactionally.
- `inventory_items.current_stock` is not decremented during public checkout.
- Phase 20 should add reservation/availability RPCs or transactional database functions.

## Shipping Foundation

Added table:

- `shop_shipping_methods`

Seeded methods:

- `Firma Sevkiyatı`
- `Müşteri Teslim Alır`
- `Kargo Planlanacak`

Order shipping fields:

- `shipping_method`
- `shipping_status`
- `tracking_number`

Carrier integrations:

- Not implemented in this phase by design.
- Tracking number field is ready for ERP fulfillment updates.

## Customer Authorization Model

Current model:

- Public users can insert checkout orders.
- Authenticated users can read orders where:
  - `orders.customer_user_id = auth.uid()`, or
  - `orders.email = auth.jwt()->>'email'`, or
  - the user is an active ERP admin.
- ERP admins can manage public orders and shipping methods.
- Anonymous users do not receive broad read access to orders.

Important governance note:

- Matching authenticated customers by email is a foundation, not final production identity governance.
- A dedicated customer auth/onboarding flow should link customer profiles to `auth.users.id` before production customer self-service.

## Supabase Mapping

| Capability | Tables/functions | Phase 19 usage |
|---|---|---|
| Product catalog | `products`, `product_images` | Public listing/detail/search/recommendations |
| Categories | `shop_categories` | Category navigation and filters |
| Cart foundation | `shop_carts`, `shop_cart_items` | Schema prepared; UI remains localStorage-persistent |
| Public orders | `orders`, `order_items` | Checkout order request and line storage |
| ERP customers | `stakeholders` | Trigger creates/reuses customer stakeholder |
| ERP sales | `sales_orders`, `sales_order_items` | Trigger creates ERP sales order and items |
| Inventory | `inventory_items`, `products.inventory_item_id` | Visibility and reservation foundation |
| Shipping | `shop_shipping_methods`, order shipping fields | Shipping method/status/tracking foundation |
| Auditing | `erp_audit_logs` | Conversion success/failure events |
| Numbering | `next_erp_number('SALES_ORDER')` | ERP sales order number generation |

## Files Modified

| File | Purpose |
|---|---|
| `supabase/migrations/20260602071443_phase19_public_ecommerce_checkout_customer_portal.sql` | Additive commerce schema, policies, shipping methods, ERP conversion triggers |
| `src/App.tsx` | Checkout, success, and customer portal routes |
| `src/components/Navigation.tsx` | Public account link |
| `src/features/shop/api.ts` | Checkout order creation, shipping methods, customer orders, availability helper |
| `src/features/shop/types.ts` | Phase 19 order/cart/shipping/customer types |
| `src/features/shop/components/ProductCard.tsx` | Inventory visibility and inventory-item cart mapping |
| `src/features/shop/pages/ProductDetailPage.tsx` | Inventory visibility and inventory-item cart mapping |
| `src/features/shop/pages/CheckoutPage.tsx` | Four-step non-payment checkout |
| `src/features/shop/pages/CustomerPortalPage.tsx` | Customer portal foundation |
| `src/features/shop/pages/index.ts` | Customer portal export |
| `docs/phase-19-public-ecommerce-checkout-customer-portal-report.md` | Phase 19 implementation report |

## Risks

| Risk | Severity | Notes |
|---|---:|---|
| No real payment provider | High | Required by phase constraints; orders are ERP-reviewed requests only. |
| Anonymous order abuse | High | Public insert remains open; rate limiting/captcha/edge validation needed. |
| Inventory reservation not transactional | High | Reservation status exists, but stock is not locked or decremented. |
| Email-based customer matching | Medium | Useful foundation, but customer auth should be linked by `auth.users.id`. |
| Trigger conversion complexity | Medium | Database trigger creates ERP records; monitor audit logs for conversion failures. |
| Guest portal order visibility | Medium | Intentionally limited; guests cannot securely list all historical orders without auth. |
| Shipping not carrier-integrated | Low | Tracking/status foundation exists only. |
| Cart database persistence incomplete | Low | LocalStorage cart works; `shop_carts` ownership hooks are ready for Phase 20. |

## Recommendations

- Add a public checkout Edge Function or RPC for validation, rate limiting, and transactional cart/order creation.
- Implement inventory reservation RPC that validates stock and updates reservation status atomically.
- Add customer auth onboarding and explicit customer profile table linked to `auth.users.id`.
- Add email order confirmation from an Edge Function.
- Add anti-spam and abuse controls for anonymous checkout.
- Add carrier/shipping update workflow inside ERP fulfillment.
- Add structured product metadata and breadcrumb JSON-LD for product/category pages.
- Add database tests or migration smoke tests for trigger-based ERP conversion.

## Proposed Phase 20 Scope

Recommended Phase 20: **Transactional Commerce Hardening and Customer Identity**

Suggested scope:

- Customer account signup/login for public portal.
- Customer profile table linked to `auth.users.id`.
- Transactional checkout RPC or Edge Function.
- Real inventory reservation and release workflow.
- Order confirmation email pipeline.
- Abuse protection for checkout and forms.
- Structured SEO metadata for product/category pages.
- ERP fulfillment updates exposed safely to customer portal.
