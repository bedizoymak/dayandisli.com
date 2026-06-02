# Phase 20 Transactional Commerce and Customer Identity Report

Date: 2026-06-02

Scope: Harden Phase 19 public commerce before payment provider launch. This phase adds customer identity, safer checkout orchestration, inventory reservation records, abuse controls, safer customer order visibility, product/category SEO metadata foundations, and ERP fulfillment visibility in the customer portal.

## Executive Summary

Phase 20 moves public commerce away from direct browser-created orders and toward authenticated customer checkout through a Supabase Edge Function. The public customer portal now supports signup, login, logout, profile editing, authenticated order visibility, and ERP fulfillment/reservation status display.

Implemented:

- Customer signup/login for `/hesabim`.
- `shop_customer_profiles` linked to `auth.users.id`.
- Checkout submission through `supabase/functions/commerce-checkout`.
- Direct anonymous order insert policies removed.
- Customer order visibility narrowed to `orders.customer_user_id = auth.uid()`.
- Inventory reservation records and release foundation.
- Checkout event logging and rate-limit foundation.
- Order confirmation email event foundation.
- Product/category structured metadata foundation.
- ERP fulfillment status visibility in the customer portal.

No real payment providers were launched.

Production readiness score for this phase: **87 / 100**

The largest remaining gap is true database-native transaction handling for the entire checkout sequence. The Edge Function now validates identity, rate limits, reserves inventory, creates the order, and performs compensating rollback on failure, but Phase 21 should move the critical stock/order mutation into a single database transaction or dedicated server-side Postgres connection path.

## Customer Identity Architecture

New table:

- `shop_customer_profiles`

Identity relationship:

```text
Supabase auth.users
-> shop_customer_profiles.auth_user_id
-> orders.customer_user_id
-> customer portal order visibility
```

Customer portal behavior:

- `/hesabim` shows signup/login when no customer session exists.
- Customers can create a Supabase Auth account.
- Customers can sign in with email/password.
- Customers can sign out.
- Authenticated customers can edit:
  - Ad Soyad
  - Firma
  - Telefon
  - Fatura Adresi
  - Teslimat Adresi
- Profile writes are stored in `shop_customer_profiles`, not a second customer database.

Important rule:

- ERP customer ownership remains through `stakeholders`.
- Public customer identity is linked to `auth.users.id` and can later be linked to a stakeholder through `shop_customer_profiles.stakeholder_id`.

## Checkout Hardening Architecture

New Edge Function:

- `supabase/functions/commerce-checkout/index.ts`

Checkout flow:

```text
Authenticated customer
-> Checkout form
-> commerce-checkout Edge Function
-> auth token validation
-> rate-limit check
-> customer profile upsert
-> product and stock validation
-> order creation
-> order item creation
-> inventory reservation
-> ERP sales-order trigger foundation
-> checkout event log
-> confirmation email pending event
```

Frontend change:

- `createCheckoutOrder` no longer inserts directly into `orders` and `order_items`.
- It calls `supabase.functions.invoke("commerce-checkout")`.
- Checkout blocks final submission when the customer is not signed in.

Direct database access hardening:

- Anonymous order insert policy was dropped.
- Anonymous order item insert policy was dropped.
- Authenticated customer order reads now require `orders.customer_user_id = auth.uid()`.
- ERP admin access remains available through active `admin_users`.

## Inventory Reservation Flow

New table:

- `shop_inventory_reservations`

Reservation flow:

```text
Checkout item
-> product.inventory_item_id
-> inventory_items.current_stock validation
-> decrement inventory_items.current_stock
-> shop_inventory_reservations insert
-> order_items.reservation_status = reserved
-> orders.inventory_reservation_status = reserved
```

Release foundation:

- `internal.release_shop_order_reservations(p_order_id, p_reason)` was added for ERP/admin release workflows.
- The Edge Function also performs compensating release if checkout fails after reservation.

Remaining gap:

- The Edge Function orchestrates multiple service-role writes and compensating rollback.
- For maximum production safety, Phase 21 should move checkout mutation into a database-native transaction or a dedicated server execution path that can use `BEGIN/COMMIT/ROLLBACK`.

## Abuse Protection Approach

New table:

- `commerce_checkout_events`

Logged event types:

- `checkout_started`
- `checkout_completed`
- `checkout_failed`
- `checkout_rate_limited`
- `order_confirmation_email_pending`

Current protection:

- Checkout requires an authenticated Supabase user.
- Checkout e-mail must match the authenticated session e-mail.
- Cart line count is capped.
- Recent checkout attempts are counted per `auth_user_id`.
- Excessive attempts return a Turkish rate-limit message.
- IP hash and user agent are stored for governance review.

Remaining anti-abuse needs:

- Add bot protection/captcha for signup and checkout.
- Add stricter per-IP and per-account rate limits.
- Add Edge Function request signature/log retention policy.
- Add email verification enforcement before checkout if the Supabase project requires it.

## Customer Portal Authorization Model

Portal route:

- `/hesabim`

Authorization model:

```text
No session
-> signup/login screen only

Authenticated customer
-> own shop_customer_profiles row
-> own orders where customer_user_id = auth.uid()
-> own order item visibility through order ownership
-> own reservation visibility through order ownership

ERP admin
-> managed order/profile/reservation access through admin_users
```

Visible portal status:

- Order status via `ORDER_STATUS_LABELS`.
- Shipping status:
  - ERP sürecinde
  - Hazırlanıyor
  - Kargoda
  - Teslim Edildi
- Reservation status:
  - Stok Kontrolü
  - Stok Ayrıldı
  - Kısmi Stok
  - Stok Bekliyor

## Structured SEO Metadata

Implemented:

- Product detail pages now apply:
  - title
  - description
  - Open Graph title/description/image
  - JSON-LD Product foundation
- Category/listing pages now apply:
  - category title
  - category description

Remaining SEO gap:

- This is still client-side metadata in a Vite SPA.
- Server-side rendering or static pre-rendering should be evaluated before public SEO launch.

## Supabase Mapping

| Capability | Tables/functions | Phase 20 usage |
|---|---|---|
| Customer identity | `auth.users`, `shop_customer_profiles` | Signup/login/profile ownership |
| Checkout orchestration | `commerce-checkout` Edge Function | Validated customer checkout |
| Checkout events | `commerce_checkout_events` | Audit, rate limit, email foundation |
| Public orders | `orders`, `order_items` | Created by Edge Function only |
| Customer order visibility | `orders.customer_user_id` | Customer self-service isolation |
| Inventory reservation | `inventory_items`, `shop_inventory_reservations`, `order_items.reservation_status` | Stock validation/reservation foundation |
| ERP handoff | Phase 19 order/order-item triggers | ERP sales order and item creation retained |
| Fulfillment | `orders.shipping_status`, `orders.tracking_number` | Customer portal visibility |
| Email foundation | `commerce_checkout_events.event_type = order_confirmation_email_pending` | Future email worker/Edge Function trigger point |

## Files Modified

| File | Purpose |
|---|---|
| `supabase/migrations/20260602074556_phase20_transactional_commerce_customer_identity.sql` | Customer profiles, reservations, checkout events, RLS hardening |
| `supabase/functions/commerce-checkout/index.ts` | Authenticated checkout orchestration and reservation foundation |
| `src/features/shop/api.ts` | Auth helpers, profile helpers, Edge checkout, safer customer orders, SEO metadata |
| `src/features/shop/types.ts` | Customer profile identity fields |
| `src/features/shop/pages/CheckoutPage.tsx` | Require customer identity before checkout submission |
| `src/features/shop/pages/CustomerPortalPage.tsx` | Signup/login/profile/orders/fulfillment visibility |
| `src/features/shop/pages/ProductDetailPage.tsx` | Product structured metadata |
| `src/features/shop/pages/ShopPage.tsx` | Category/listing metadata |
| `docs/phase-20-transactional-commerce-customer-identity-report.md` | Phase 20 report |

## Risks

| Risk | Severity | Notes |
|---|---:|---|
| Edge Function is not a single DB transaction | High | Compensating rollback exists, but DB-native transaction is safer for production. |
| No payment provider | High | Required by phase scope; payment remains ERP-reviewed/manual. |
| Stock reservation concurrency | High | Current reservation checks stock before decrement; true row locking should be added in Phase 21. |
| Email confirmation not sent yet | Medium | Event foundation exists; no email worker/provider is active. |
| Signup abuse | Medium | Auth signup exists; captcha/bot controls are not implemented. |
| Client-side SEO | Medium | Metadata is applied in browser; SSR/pre-render still needed. |
| Legacy direct order helpers remain | Low | Admin helpers remain for ERP screens; public checkout uses Edge Function. |

## Recommendations

- Move checkout stock/order mutation into a database-native transaction with row locks.
- Add an email confirmation Edge Function or queue processor.
- Add captcha/bot protection to customer signup and checkout.
- Enforce email verification before checkout if project policy allows.
- Add reservation expiry/release jobs for abandoned or cancelled orders.
- Add customer support/returns tables after fulfillment flows are stable.
- Add SSR/static pre-rendering for product/category SEO.

## Proposed Phase 21 Scope

Recommended Phase 21: **Payment Readiness, Reservation Transactions and Fulfillment Automation**

Suggested scope:

- Database-native checkout transaction with row locking.
- Reservation expiry and release scheduler.
- Order confirmation email worker.
- Payment provider evaluation without launch.
- ERP fulfillment status update workflow.
- Customer invoice visibility foundation.
- Return/support request foundations.
- Product/category SSR or pre-rendering strategy.
