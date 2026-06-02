# Phase 23 Payment Providers, Webhooks and Financial Reliability Report

## Objective

Phase 23 moves the commerce payment foundation from provider-ready status to a controlled real-provider integration layer while keeping ERP finance as the system of record.

The implementation adds provider adapters, webhook auditing, replay and duplicate controls, reconciliation logs, refund operations, accounting-entry protection, provider health tracking, notification dispatch foundation, and Turkish ERP/public UI surfaces.

## Provider Architecture

Implemented provider adapter layer:

- `iyzico`
- `PayTR`
- `Stripe`

Shared adapter contract:

- payment creation
- webhook verification
- refund verification
- callback payload normalization
- provider-independent result format

Files:

- `supabase/functions/_shared/payment-providers.ts`
- `supabase/functions/payment-create/index.ts`
- `supabase/functions/payment-webhook/index.ts`
- `supabase/functions/payment-refund/index.ts`

Provider-specific logic is isolated inside adapters. ERP business logic does not depend on provider-specific payload shapes.

The provider creation flow fails closed when required provider environment variables are missing.

## Webhook Architecture

Implemented:

- provider-specific signature verification
- normalized webhook event model
- duplicate event prevention through `(provider, event_id)` uniqueness
- event audit logging in `payment_provider_events`
- provider health updates on success/failure
- failed webhook logging
- provider-independent webhook endpoint with `provider` query parameter

Webhook endpoint:

```text
payment-webhook?provider=iyzico
payment-webhook?provider=paytr
payment-webhook?provider=stripe
```

Webhook outcomes:

- valid payment success updates payment, invoice, order and accounting records
- failed payment moves records to manual review
- duplicate provider events are ignored and separately logged
- invalid signatures are rejected and logged

## Refund Workflow

Implemented refund operation foundation:

```text
Customer return request
-> ERP review
-> Provider refund verification
-> Refund operation update
-> Accounting entry
-> Order/refund status update
```

New table:

- `payment_refund_operations`

ERP UI additions:

- return review creates a refund operation
- provider refund verification action
- refund operation list and status visibility

Provider refund support is prepared through the same adapter interface used for payment verification.

## Reconciliation Review

Implemented reconciliation tracking:

- `payment_reconciliation_logs`
- expected amount
- received amount
- currency
- provider
- provider payment id
- order linkage
- payment status linkage
- invoice/payment linkage
- status: pending, matched, mismatch, duplicate, manual review

Payment success processing compares provider amount with ERP order total and marks matched or mismatch.

## Financial Consistency Controls

Implemented controls:

- unique provider payment reference per provider
- unique provider event id per provider
- idempotent accounting entry uniqueness by payment and entry type
- idempotent refund accounting entry uniqueness by refund request and entry type
- centralized financial record routine for:
  - order
  - invoice
  - payment
  - accounting entry
  - reconciliation log

Financial flow:

```text
Order
-> Invoice
-> Payment
-> Accounting Entry
-> Reconciliation Log
```

No provider-specific ERP business logic was added to the ERP UI.

## ERP Financial Dashboard

Added Turkish ERP visibility in:

- `src/features/erp/ecommerce/ECommercePage.tsx`
- `src/features/erp/reports/ReportsPage.tsx`

New commerce operations tab:

- `Finans Güvenliği`

Visible metrics:

- payment provider events
- reconciliation logs
- accounting entries
- refund operations
- provider health
- failed payments
- duplicate/replayed events
- pending reconciliation

Reporting additions:

- failed payment KPI
- pending reconciliation KPI
- refund operation KPI
- provider warning KPI
- payment status chart
- reconciliation status chart

All added visible UI text is Turkish.

## Notification Execution

Implemented notification provider abstraction:

- `supabase/functions/_shared/notification-providers.ts`
- `supabase/functions/notification-dispatch/index.ts`

Supported event purposes:

- order confirmation
- payment confirmation
- refund update
- shipment update

Current provider:

- SMTP

Dispatch updates `shop_customer_notifications.status` to `sent` or `failed` and stores provider metadata.

## Monitoring Architecture

Monitoring-ready tables:

- `payment_provider_events`
- `payment_reconciliation_logs`
- `accounting_entries`
- `payment_refund_operations`
- `payment_provider_health`

Monitoring signals:

- provider health status
- last success timestamp
- last failure timestamp
- failure count
- last provider error
- event processing status
- reconciliation status
- duplicate/replay flags

## Security Findings

Implemented:

- payment creation requires authenticated customer session
- payment creation checks order ownership through `customer_user_id`
- refund verification requires active ERP admin user
- webhook endpoint verifies provider signatures
- duplicate provider events are prevented
- customer-visible RLS is limited to own events/refund operations
- admin RLS policies protect operational payment, reconciliation and accounting records
- service-role Edge Functions own privileged payment transitions

Remaining security requirements:

- verify provider signatures against real sandbox payloads before production
- rotate and scope provider credentials per environment
- verify RLS with real customer/admin sessions after applying migration
- configure webhook endpoint allowlisting where providers support it
- add retention policy for provider payload logs

## Supabase Mapping

New migration:

- `supabase/migrations/20260602120000_phase23_payment_providers_webhooks_financial_reliability.sql`

Modified tables:

- `orders`
  - `provider_payment_id`
  - `provider_payment_url`
  - `payment_provider`
  - `payment_reconciliation_status`
  - `paid_at`
  - `refunded_at`
- `shop_payment_statuses`
  - `provider_event_id`
  - `provider_payload`
  - `verification_status`
  - `reconciliation_status`
  - `invoice_id`
  - `payment_id`

New tables:

- `payment_provider_events`
- `payment_reconciliation_logs`
- `accounting_entries`
- `payment_refund_operations`
- `payment_provider_health`

New Edge Functions:

- `payment-create`
- `payment-webhook`
- `payment-refund`
- `notification-dispatch`

Supabase CLI note:

- The local machine does not currently have the Supabase CLI available, so the migration file was created manually using the repository timestamp naming convention.

## Risks

- Provider adapters require sandbox verification with real provider payloads.
- Real Stripe signature verification normally uses Stripe's signed payload format; the current adapter is prepared structurally and must be validated before launch.
- Payment creation currently creates controlled provider sessions but does not redirect to provider-hosted production pages until credentials and provider API calls are finalized.
- Accounting entries are foundation-level and should be reviewed by finance before production posting.
- Notification dispatch uses SMTP and should be queue/rate-limit hardened before high volume.
- Generated Supabase types remain stale and many newer tables still use casted Supabase access.

## Recommendations

- Run provider sandbox tests for iyzico, PayTR and Stripe.
- Confirm the final selected provider before enabling public production checkout.
- Refresh Supabase generated types after applying Phase 23 migration.
- Add provider-specific contract tests for webhook signature fixtures.
- Add admin-only monitoring route for failed webhooks and reconciliation mismatches.
- Add scheduled reconciliation review for provider settlement reports.
- Add log retention and redaction rules for provider payloads.

## Proposed Phase 24 Scope

Recommended Phase 24 scope:

- provider sandbox certification
- real provider API request/response fixtures
- settlement report import
- automatic reconciliation against settlement batches
- payment timeout and inventory reservation release scheduler
- production notification queue
- payload redaction and retention policy
- Supabase generated type refresh
- end-to-end tests for checkout, webhook, refund and accounting flows

## Validation

```bash
npm run build
```

Result:

- Passed.
- Vite transformed 3549 modules and built successfully.
- Existing warnings remain:
  - Browserslist `caniuse-lite` data is 12 months old.
  - `pdfjs-dist/build/pdf.js` uses eval.
  - Some chunks exceed 500 kB after minification.

```bash
git status
```

Result checked after implementation before commit.
