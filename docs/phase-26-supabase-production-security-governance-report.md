# Phase 26 Supabase Production Security Governance Report

## Objective

Phase 26 finalizes the production security governance posture after tenant isolation. This phase does not add modules and does not make destructive schema changes.

## Supabase Security and Changelog Review

Reviewed current Supabase security-relevant guidance and changelog items:

- Supabase RLS guidance confirms every table in an exposed schema such as `public` should have RLS enabled.
- Supabase RLS guidance warns that `raw_user_meta_data` / `user_metadata` is user-editable and must not be used for authorization decisions.
- Supabase documentation highlights that views can bypass RLS unless they are `security_invoker` or otherwise access-restricted.
- Supabase changelog highlights 2026 security/default-exposure changes, including RLS Tester preview and stricter defaults around API exposure and GraphQL introspection.

Sources:

- Supabase security changelog: https://supabase.com/changelog?tags=security
- Supabase breaking-change changelog: https://supabase.com/changelog?tags=breaking-change
- Supabase RLS documentation: https://supabase.com/docs/guides/auth/auth-deep-dive/auth-row-level-security

## Repository Audit Summary

Audited:

- Supabase migrations
- RLS policy definitions
- `anon` / `authenticated` / service role usage
- Edge Functions
- Payment provider adapters and webhook validation
- Storage bucket references
- Public CMS and e-commerce public access paths
- Tenant isolation migration and application query scope from Phase 25

Supabase CLI status:

- `supabase --version` is not available on the local machine.
- Production advisors and RLS Tester checks must be run in Supabase Dashboard or on a machine with Supabase CLI installed.

## RLS Policy Audit

Finding:

- Older migrations created broad authenticated policies with `using (true)` / `with check (true)` for several ERP tables.
- Phase 25 tenant policies were added, but PostgreSQL permissive policies are OR-combined, so broad legacy policies could bypass tenant policies.

Action:

- Added migration `20260603130000_phase26_supabase_production_security_governance.sql`.
- It drops known broad legacy policy names on sensitive tenant-owned tables.
- It keeps RLS enabled on sensitive tables.
- It adds tenant member update policies for company/branch-owned tables.
- It revokes `anon` privileges on sensitive ERP, payment, customer, governance and tenant tables.

Remaining intentional public access:

- Public product/catalog and website/CMS read surfaces remain explicitly readable.
- These are expected public website surfaces, not internal ERP data.

## Role Boundary Review

Anon:

- Should only access explicit public website/catalog/shipping content.
- Phase 26 revokes anon access from sensitive ERP/payment/customer/governance tables.

Authenticated:

- Can access tenant rows through membership-backed RLS.
- Can access own customer portal records through existing customer policies.
- Broad authenticated policies were removed on sensitive tenant-owned tables where known names were used.

Service role:

- Used only inside Edge Functions and server-side operational paths.
- Not exposed in frontend code.
- Service role use remains necessary for checkout orchestration, payment webhooks, notification dispatch and Paraşüt sync.

## Tenant Isolation Bypass Review

Controls:

- Phase 25 application APIs scope reads by default company/branch.
- Phase 25 create APIs default ownership to current company/branch context.
- Phase 25 and Phase 26 RLS use `company_memberships` and `admin_users`, not user-editable metadata.
- Phase 26 removes older broad policies that could bypass newer tenant policies.

Remaining risks:

- Existing legacy records with `company_id is null` remain readable until backfill.
- Strict tenant launch requires ownership backfill and removal of the temporary null-company allowance.
- Detail-by-ID APIs should still be audited with tenant checks before full enterprise rollout.

## Edge Function Security Review

Functions reviewed:

- `commerce-checkout`
- `payment-create`
- `payment-refund`
- `payment-webhook`
- `notification-dispatch`
- `parasut-sync`
- `parasut-sync-run`
- `send-contact-email`
- `send-quotation-email`

Positive controls:

- Payment creation verifies authenticated customer ownership of the order.
- Payment refund verifies authenticated ERP admin status.
- Payment webhook validates provider signatures.
- Payment webhook logs duplicate events and payload hashes.
- Checkout requires authenticated customer identity and rate-limits recent checkout attempts.
- Contact form uses reCAPTCHA secret validation.
- Secrets are read through `Deno.env`.

Risks:

- Payment webhooks use service role and must remain deployed with strict provider endpoint URLs.
- Webhook replay protection is duplicate-event based; production should add provider timestamp-window validation where provider headers support it.
- CORS for some customer-facing functions is permissive with `Access-Control-Allow-Origin: *`; acceptable for authenticated token-based flows, but production should restrict origins once deployment domains are final.
- Paraşüt sync functions use service role and external accounting secrets; access should be limited by deployment configuration and invocation controls.

## Payment and Webhook Secret Review

Required secrets:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `IYZICO_API_KEY`
- `IYZICO_SECRET_KEY`
- `IYZICO_WEBHOOK_SECRET`
- `PAYTR_MERCHANT_ID`
- `PAYTR_MERCHANT_SALT`
- `PAYTR_MERCHANT_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `GMAIL_APP_PASSWORD`
- `SMTP_USER`
- `SMTP_HOST`
- `SMTP_PORT`
- `RECAPTCHA_SECRET_KEY`
- `PARASUT_COMPANY_ID`
- `PARASUT_CLIENT_ID`
- `PARASUT_CLIENT_SECRET`

Production requirements:

- Store all secrets in Supabase Edge Function secrets, not client env files.
- Rotate provider webhook secrets before real production traffic.
- Separate test and production provider credentials.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the browser.

## Storage Bucket Audit

Repository audit found no migration-created storage buckets or storage object policies.

Current implication:

- Website media records reference public media metadata, but actual storage bucket governance must be confirmed in the Supabase project.
- Production must run the storage queries in `docs/phase-26-supabase-security-verification-queries.sql`.

Required production checks:

- Confirm bucket list.
- Confirm public buckets are limited to intended website/media assets.
- Confirm private buckets have `storage.objects` RLS policies.
- Confirm upload/update/delete policies are admin-only or owner-scoped.

## Verification Queries

Created:

- `docs/phase-26-supabase-security-verification-queries.sql`

The query set audits:

- Public tables without RLS
- Broad `true` policies
- Anon privileges on sensitive tables
- Remaining anon grants
- Tenant policy coverage
- Rows missing company ownership
- Security definer function exposure
- Public views
- Storage buckets
- Storage object policies

These should be run after applying migrations in production or staging.

## Remaining Production Risks

- Supabase CLI/advisors were not available locally.
- Legacy null-company rows still need ownership backfill.
- Some public views/functions may require live database inspection after deploy.
- Storage bucket policy posture cannot be confirmed from migrations because no buckets are defined in repo SQL.
- Edge Function invocation restrictions should be configured in Supabase Dashboard.
- Provider timestamp-window replay checks should be added when real provider headers are confirmed.

## Recommendations

- Apply Phase 26 migration in staging before production.
- Run the verification SQL and attach results to the deployment checklist.
- Run Supabase Dashboard Security Advisor and RLS Tester.
- Backfill all legacy `company_id`/`branch_id` rows.
- Remove the temporary `company_id is null` tenant-policy allowance after backfill.
- Restrict Edge Function CORS origins to final production domains.
- Rotate all payment/webhook/email/accounting secrets before launch.
- Add provider timestamp-window replay validation for iyzico, PayTR and Stripe once live provider payloads are confirmed.

## Proposed Phase 27 Scope

Recommended Phase 27 scope:

- Legacy ownership backfill execution
- Strict tenant RLS with null-company allowance removal
- Live Supabase advisor remediation
- Edge Function invocation policy hardening
- Storage bucket policy implementation
- Production launch security checklist sign-off
