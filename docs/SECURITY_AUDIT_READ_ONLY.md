# Security Audit Read Only

Audit date: 2026-06-23  
Scope: local repository only, React/Vite frontend, Supabase migrations, Edge Functions, scripts, docs, workflows, and package metadata. No production Supabase project, deployed Edge Function secrets, live RLS state, Auth settings, Storage bucket settings, or payment provider dashboards were queried.

## Executive Summary

This audit found one critical secret-leakage issue: real Paraşüt credentials are present in the local `.env` file. Treat those credentials as compromised if this file has ever been committed, synced, backed up, shared, or exposed through tooling.

The application has meaningful server-side protections in newer Supabase migrations and Edge Functions: checkout requires an authenticated Supabase user, payment webhooks call provider verification adapters, customer portal reads filter by `auth.uid()`, and later migrations remove several broad authenticated policies. However, the repository still contains earlier broad RLS policies, compatibility policies that rely on legacy `admin_users`, and tenant policies that intentionally allow `company_id is null`. Those are not automatically exploitable from source alone, but they are high-risk until production policy parity and null-company backfill are verified.

The largest application security risks are dependency exposure in PDF/rendering libraries, public CORS on service-role Edge Functions, potential unsafe email HTML composition, weak Storage/file governance, and remaining IDOR-sensitive frontend APIs that rely on RLS being correct.

## P0 Critical Findings

### SEC-P0-001: Real Paraşüt Credentials In `.env`

`.env` contains real-looking Paraşüt username, password, OAuth client ID, OAuth client secret, company ID, and a Supabase project URL/publishable key. The report intentionally redacts values as `***REDACTED***`.

Impact: any exposure of the repo, local backups, build logs, screenshots, support bundles, malware, or shared workspace can compromise the Paraşüt account and permit API access. If these credentials are valid, rotation is urgent.

Recommended fix: revoke and rotate Paraşüt credentials, remove secrets from `.env`, keep only `.env.example` templates in Git, add `.env*` ignore rules except explicit examples, and move runtime secrets to the approved secret manager / Supabase Edge Function secrets.

## P1 High Findings

### SEC-P1-001: Critical And High Dependency Vulnerabilities

`npm audit --audit-level=moderate` reports 29 vulnerabilities, including critical `jspdf`, high `pdfjs-dist`, high `tar`, and high `undici` issues. The project builds PDF flows and renders PDFs in-browser, so the PDF advisories are directly relevant.

Recommended fix: upgrade `jspdf`, replace or upgrade the PDF viewer stack because `pdfjs-dist <=4.1.392` reports no fix through the current dependency tree, and review `tar`/`undici` transitive paths. Do not rely on `npm audit fix --force` without compatibility testing.

### SEC-P1-002: Tenant Isolation Allows Legacy `company_id is null`

Phase 25 tenant policies allow reads/writes where `company_id is null`. The migration comment says this preserves legacy rows until backfill. If any sensitive ERP/payment/order rows remain null-owned in production, any authenticated user passing table grants may read or write those rows depending on operation policy.

Recommended fix: backfill ownership, make tenant-owned tables require non-null `company_id`, remove the `company_id is null` allowance, and add verification queries that fail deployment when sensitive tables contain null company ownership.

### SEC-P1-003: Edge Functions Use Service Role With Broad CORS

Several Edge Functions allow `Access-Control-Allow-Origin: *` and then use `SUPABASE_SERVICE_ROLE_KEY`. Some validate a Supabase bearer token before privileged writes, but wildcard CORS increases browser-callable attack surface and makes auth or validation mistakes more dangerous.

Recommended fix: restrict CORS origins per function, reject missing/invalid `Origin` for browser-facing functions, keep service-role clients server-only, and add per-function rate limits and structured authorization tests.

### SEC-P1-004: RLS Migration History Contains Broad Authenticated Policies

Early migrations create many `to authenticated using (true)` / `with check (true)` policies on ERP, CRM, shop, order, and CMS tables. Later Phase 26 drops several known broad policy names, but repository-only review cannot prove every broad policy name and every deployed table state was removed in production.

Recommended fix: run live `pg_policies` and `pg_tables` verification against staging/production, fail if any sensitive policy still contains `true` without an ownership predicate, and keep a single current RLS hardening migration rather than relying on historical intent.

## P2 Medium Findings

### SEC-P2-001: Frontend Permission Checks Are UX Gates, Not Authorization

ERP routes rely on `ProtectedRoute`, `ERPAuthContext`, role arrays, and permission arrays fetched client-side. Sensitive operations must be enforced by RLS/RPC because users can call Supabase APIs directly. Newer RLS work exists, but some admin paths still call direct table APIs.

Recommended fix: treat frontend guards only as navigation controls. For every admin/ERP mutation, require RLS or secure RPC checks tied to `auth.uid()` plus tenant/company membership.

### SEC-P2-002: IDOR-Sensitive Direct Table APIs Depend On RLS Correctness

Shop and ERP APIs use direct `.eq("id", ...)`, `.eq("order_id", ...)`, `.update(...)`, and `.delete(...)` calls. Customer order detail queries first verify the parent order belongs to `auth.uid()`, but child-record reads then query by `order_id` and depend on child-table RLS. Admin-style fetch/update helpers also depend entirely on RLS.

Recommended fix: keep direct client calls only where table RLS is proven. For sensitive multi-table reads, prefer RPCs that validate ownership once and return a scoped result.

### SEC-P2-003: Payment Provider Adapters Are Mock-Like And Stripe Signature Check Is Nonstandard

Webhook adapters perform HMAC checks, but Stripe verification checks whether the `stripe-signature` header includes a locally computed raw-body HMAC. Real Stripe signatures require timestamped signed payload verification using Stripe's scheme. Payment creation also returns local placeholder payment URLs.

Recommended fix: before production payment enablement, replace placeholder provider adapters with official SDK/protocol verification, enforce timestamp tolerance and replay protection, and store only necessary webhook payload fields.

### SEC-P2-004: Unsafe HTML Composition Risk In Email/Notification Flows

Edge Functions compose HTML emails using row/customer/message fields. React rendering generally escapes UI text, but email HTML is not React-escaped. Unsanitized user-controlled values in HTML emails can create stored HTML/script risks in mail clients and admin review contexts.

Recommended fix: HTML-escape all dynamic email fields, use text templates or a trusted template renderer, and avoid storing raw provider/user payloads that later get rendered.

### SEC-P2-005: Storage/File Governance Is Underdeveloped

No `storage.objects` policies or bucket definitions were found in migrations. The app stores `file_path` values for documents and media assets, grants public select on `website_media_assets`, and currently accepts/manual-edits file paths rather than validating uploads.

Recommended fix: define explicit private/public buckets, add `storage.objects` RLS policies, validate MIME/size/path ownership at upload time, and do not expose internal document paths through public CMS tables.

## P3 Low Findings

### SEC-P3-001: Publishable Supabase Keys Are Present In Local Env Files

`.env` and `.env.local` include Vite Supabase publishable keys. Publishable keys are not service-role secrets, but committed or shared env files normalize unsafe secret handling.

Recommended fix: keep publishable keys in deployment environment config or local untracked `.env.local`, and keep examples blank.

### SEC-P3-002: Lint Fails

`npm run lint` fails with existing TypeScript/ESLint errors. This is not directly a vulnerability, but weakens security review by making CI less useful.

Recommended fix: fix lint debt and keep lint required in CI.

### SEC-P3-003: Build Warns About PDF.js `eval`

`npm run build` passes but warns that `node_modules/pdfjs-dist/build/pdf.js` uses `eval`, which aligns with the PDF.js audit risk.

Recommended fix: upgrade/replace PDF rendering and consider disabling risky PDF features where possible.

## Evidence Table

| Finding ID | Severity | File | Line/function | Why it matters | Exploit scenario | Recommended fix |
|---|---|---|---|---|---|---|
| SEC-P0-001 | P0 | `.env` | 3-7 | Real Paraşüt credentials are stored in a repo-local env file. | Attacker obtains repo/workstation copy and uses `PARASUT_USERNAME=***REDACTED***`, `PARASUT_PASSWORD=***REDACTED***`, `PARASUT_CLIENT_SECRET=***REDACTED***`. | Rotate credentials, remove from repo, keep secrets in secret manager/Supabase secrets. |
| SEC-P1-001 | P1 | `package.json` / `package-lock.json` | `jspdf`, `pdfjs-dist`, `tar`, `undici` | Critical/high advisories in PDF and tooling dependencies. | Malicious PDF or vulnerable dependency path triggers XSS/RCE-like browser behavior, file traversal, or network/client issues. | Upgrade/replace vulnerable packages; test PDF flows. |
| SEC-P1-002 | P1 | `supabase/migrations/20260603123000_phase25_tenant_isolation_rls_data_safety.sql` | 101-128 | Tenant policies allow `company_id is null`. | Authenticated user sees or writes legacy null-company rows outside their tenant. | Backfill ownership, make company ownership non-null, remove null bypass. |
| SEC-P1-003 | P1 | `supabase/functions/commerce-checkout/index.ts` | 3-6, 57-65 | Wildcard CORS on a function that uses service role. | Any origin can invoke the function from a browser; auth bugs become service-role data writes. | Restrict CORS, validate origin, add per-function rate limiting. |
| SEC-P1-003 | P1 | `supabase/functions/payment-create/index.ts` | 6, 34-37 | Wildcard CORS plus service-role key. | Cross-site page triggers payment session attempts for logged-in users. | Restrict origins and validate user/order ownership server-side. |
| SEC-P1-003 | P1 | `supabase/functions/payment-refund/index.ts` | 6, 31-33 | Wildcard CORS plus privileged refund verification flow. | Browser-origin abuse probes refund operation IDs. | Restrict CORS and require strict ERP authorization. |
| SEC-P1-004 | P1 | `supabase/migrations/20260517153000_erp_core_schema.sql` | 637-646 | Broad authenticated policies are created dynamically. | Any authenticated user reads/writes ERP tables if later drops are incomplete. | Verify live policies and remove broad historical policies. |
| SEC-P1-004 | P1 | `supabase/migrations/20260601120000_crm_sales_workflows.sql` | 105-122 | CRM policies use `using (true)` / `with check (true)`. | Authenticated user accesses all CRM leads/tasks/opportunities if still deployed. | Replace with tenant/permission predicates. |
| SEC-P1-004 | P1 | `supabase/migrations/20260601145219_phase13_ecommerce_shop_foundation.sql` | 120-154 | Shop cart/payment status policies are broad. | Authenticated user lists carts or manages payment statuses if not superseded. | Verify Phase 26 drops and create scoped policies. |
| SEC-P2-001 | P2 | `src/components/ProtectedRoute.tsx` | 20-31 | Frontend route gate relies on client auth/permissions. | User bypasses UI and calls Supabase REST directly. | Ensure all sensitive actions have RLS/RPC authorization. |
| SEC-P2-001 | P2 | `src/contexts/ERPAuthContext.tsx` | 125-132 | Admin/permission checks are resolved client-side. | Tampered client code shows hidden screens; backend must still deny. | Keep only UX checks client-side; enforce in DB/functions. |
| SEC-P2-002 | P2 | `src/features/shop/api.ts` | 397-418 | Child order reads depend on child-table RLS after parent check. | If child RLS is weak, changing `orderId` returns another user's items/shipments. | Use secure RPC or verify child policies by `orders.customer_user_id = auth.uid()`. |
| SEC-P2-002 | P2 | `src/features/shop/api.ts` | 580-613 | Generic order read/update by ID relies entirely on RLS. | Non-admin client attempts arbitrary order status update. | Restrict update policy/RPC to ERP roles. |
| SEC-P2-003 | P2 | `supabase/functions/_shared/payment-providers.ts` | 187-192 | Stripe signature verification is nonstandard. | Forged header containing expected substring could pass if secret/body known or scheme mismatched. | Use Stripe official webhook verification with timestamp tolerance. |
| SEC-P2-004 | P2 | `supabase/functions/notification-dispatch/index.ts` | 41 | Dynamic DB message is inserted into HTML email. | Stored message containing HTML renders in recipient client. | Escape dynamic HTML fields. |
| SEC-P2-004 | P2 | `supabase/functions/send-quotation-email/index.ts` | 46-60 | Caller-supplied PDF filename/base64 and HTML are sent. | Authenticated/abused caller sends malicious attachment name/content or HTML. | Validate file type/name/size and sanitize/escape HTML. |
| SEC-P2-005 | P2 | `supabase/migrations/20260601145932_phase14_website_management_public_content.sql` | 45-48, 103-152 | Public CMS media stores file paths; no Storage object policies found. | Internal/private file paths are exposed through public CMS rows. | Add Storage bucket policies and path allowlists. |
| SEC-P3-001 | P3 | `.env.local` | 1-2 | Publishable Supabase key is stored in a local env file. | File sharing leaks project metadata and normalizes env-file commits. | Keep local env untracked; examples blank. |
| SEC-P3-002 | P3 | lint output | multiple | Lint fails, reducing CI signal. | Security-relevant type errors or hook bugs are hidden by existing noise. | Fix lint debt and require lint in CI. |
| SEC-P3-003 | P3 | build output | `pdfjs-dist/build/pdf.js` | Build warns about `eval`. | PDF rendering attack surface is larger. | Upgrade/replace PDF.js dependency. |

## Supabase RLS Matrix

| Table / group | RLS enabled? | Policies found? | Tenant/user constrained? | Risk |
|---|---:|---:|---|---|
| `erp_users` | Yes in migration | Yes | Own active row plus authorized ERP management in unified auth migration | Medium: live policy state not verified. |
| Core ERP tables: `stakeholders`, `crm_*`, `sales_orders`, `purchase_orders`, `work_orders`, `inventory_*`, `financial_accounts`, `invoices`, `payments`, `employees`, `shipments`, `quality_reports`, `maintenance_tasks` | Yes in migrations | Yes | Later tenant policies use `company_memberships`, but allow `company_id is null` | High until backfill/live verification. |
| `orders`, `order_items` | Yes in migrations | Yes | Customer policies use `customer_user_id = auth.uid()` or email; tenant/admin policies also exist | Medium: direct ID APIs depend on child-table RLS correctness. |
| `shop_customer_profiles`, `shop_inventory_reservations`, `commerce_checkout_events` | Yes in Phase 20/26 | Yes | Customer/admin constrained | Medium: live verification required. |
| `shop_carts`, `shop_cart_items` | Yes in Phase 13/19 | Yes | Early policies include broad insert/select/update; later own-cart policies exist for carts | Medium/High if early policies remain effective. |
| Public catalog: `products`, `product_images`, `shop_categories`, `shop_campaigns`, `shop_shipping_methods`, `shop_carriers` | Yes in migrations | Yes | Public read is intentional; authenticated management varies by admin/tenant policy | Medium: product management must not remain `using true`. |
| Public CMS: `website_pages`, `website_seo_settings`, `website_menu_items`, `website_media_assets`, `website_forms`, `website_banners` | Yes in Phase 14/26 | Yes | Public read for published/content tables; authenticated manage policies are broad in Phase 14 | Medium: public content expected, manage policies need live check. |
| `website_form_submissions` | Yes | Yes | Anonymous insert allowed intentionally; authenticated manage broad in Phase 14 | Medium: spam/PII exposure risk if manage policy broad. |
| Payment tables: `payment_provider_events`, `payment_reconciliation_logs`, `accounting_entries`, `payment_refund_operations`, `payment_provider_health`, `shop_payment_statuses` | Yes in Phase 23/25/26 | Yes | Admin/customer/tenant policies; some use legacy `admin_users` | High: financial data and legacy policy dependency. |
| Paraşüt mirror: `parasut_sync_runs`, `parasut_contacts`, `parasut_products`, `parasut_sales_invoices`, `parasut_*` | Yes in Phase 20260613194043/20260614061645 | Yes | Admin read policies via unified ERP authorization | Medium: contains external financial/customer mirror data; verify grants. |
| Storage objects / buckets | Not found in migrations | Not found | Not verified | Medium: file exposure cannot be proven safe from repo. |

No explicit `alter table ... disable row level security` was found. This does not prove live RLS is enabled because production state was not queried.

## Route/Permission Matrix

| Route | Frontend guard | Backend/RLS protection evidence | Risk |
|---|---|---|---|
| `/apps`, `/apps/:appId`, `/admin/*`, `/dashboard`, `/erp/*`, `/*` in ERP build | `ProtectedRoute` checks authenticated ERP user and required permission | Depends on Supabase RLS and Edge Function checks; Phase 25/26 tenant policies exist | Medium: frontend guard is bypassable by direct API calls. |
| `/shop`, `/shop/:slug`, `/shop/kategori/:categorySlug` | Public | Public catalog policies/grants are intentional; filters `is_shop_visible` and active categories | Low/Medium: ensure unpublished products cannot be selected by public policy. |
| `/cart` | Public local cart | No DB write until checkout; localStorage cart | Low. |
| `/checkout` | Public page, but checkout function requires Supabase user | `commerce-checkout` calls `auth.getUser`, checks email match, uses service role for order creation | Medium: strong server check, but CORS/rate limits should be tightened. |
| `/checkout/success` | Public | Reads depend on customer auth/order APIs | Medium if order details are fetched by ID without RLS. |
| `/hesabim` | Customer auth via Supabase sign-up/sign-in UI | Customer APIs filter by `auth.uid()` and RLS policies for own records exist | Medium: child records depend on RLS. |
| `/sayfa/*`, `/site-haritasi` | Public | Public CMS grants/policies intentional | Medium: CMS content/media must be sanitized and path-limited. |
| `/login` | Public | Supabase Auth plus active `erp_users` resolver | Low/Medium: resolver relies on RLS allowing current user lookup. |

## Commands Run

```powershell
Get-Content C:\Users\Bediz\Documents\dayandisli.com\.agents\skills\supabase\SKILL.md
Get-ChildItem -Force
rg --files
rg -n -i "(service_role|supabase.*key|anon.*key|jwt_secret|jwt secret|parasut|paraşüt|api[_-]?key|password|passwd|secret|webhook|token|bearer|authorization)" .
rg -n "(create policy|alter table .*enable row level security|alter table .*disable row level security|security definer|storage\.objects|bucket|auth\.role\(\)|using \(true\)|with check \(true\))" supabase -i
rg -n "ProtectedRoute|localStorage|sessionStorage|hasPermission|canAccess|role|permissions|isAdmin|is_active|erpUser" src
rg -n "\.from\(|\.select\(|\.update\(|\.delete\(|\.eq\(['""]id|\.rpc\(" src server supabase/functions scripts
rg -n "dangerouslySetInnerHTML|innerHTML|outerHTML|insertAdjacentHTML|marked|markdown|DOMPurify|sanitize|html:|createHTML|jsPDF|pdf|note|description" src server supabase/functions
rg -n "PARASUT_|VITE_SUPABASE|SUPABASE_SERVICE_ROLE|WEBHOOK|SECRET|PASSWORD|CLIENT_SECRET" .env .env.example .env.local .env.staging.example .github supabase server scripts src -i
rg -n "using \(true\)|with check \(true\)|for all to authenticated|for select to authenticated using \(true\)|auth\.role\(|security definer|drop policy|create policy|enable row level security" supabase\migrations
rg -n "verifyWebhook|webhook|Access-Control-Allow-Origin|Authorization|SUPABASE_SERVICE_ROLE_KEY|verifyRefund|sendWithResend|html:|pdfBase64" supabase\functions
rg -n "getPublicUrl|createSignedUrl|\.upload\(|\.download\(|storage\.from|storage|bucket|website_media_assets|file_path|file_url" src supabase server
npm audit --audit-level=moderate
npm run lint
npm run build
```

Validation results:

| Command | Result |
|---|---|
| `npm install` | Not run; `node_modules` and `package-lock.json` already existed. |
| `npm audit --audit-level=moderate` | Failed with 29 vulnerabilities: 5 moderate, 23 high, 1 critical. |
| `npm run lint` | Failed with 32 errors and 40 warnings. |
| `npm run build` | Passed, with warnings about old Browserslist data, PDF.js `eval`, and large chunks. |

## What Was Not Verified

- Live Supabase production/staging RLS state, grants, policies, Auth settings, JWT settings, database roles, exposed schemas, or migration parity.
- Supabase Storage buckets and `storage.objects` policies in the deployed project.
- Edge Function deployed environment variables, secret presence, secret values, or logs.
- Git history for past secret exposure.
- Whether `.env` or `.env.local` are tracked in Git history or only present locally.
- Payment provider dashboard webhook configuration and real signature compatibility.
- Actual Paraşüt credential validity or account permissions.
- Runtime exploitability with authenticated test users across tenants.
- CI/CD secret values in GitHub; only workflow references were inspected.
