# Phase 16 Performance, Security, and Deployment Readiness Report

Date: 2026-06-02

Scope: Production hardening after Phase 0 through Phase 15. This phase focused on performance, security, deployment quality, maintainability, and operational reliability. No new business modules were added.

## Executive Summary

Phase 16 addressed the most practical production risks from Phase 15 with safe changes:

- Introduced route-based lazy loading for the top-level app, ERP routes, and calculator routes.
- Removed static PDF library imports from calculator receipt pages so `jspdf` and `jspdf-autotable` can load on demand.
- Added a global ERP runtime error boundary with Turkish recovery actions.
- Hardened the Paraşüt OAuth callback function by removing token response logging, avoiding raw OAuth error responses, validating required environment variables, and throwing database write errors.
- Documented remaining Supabase, security, accessibility, mobile, monitoring, and deployment risks.

Production readiness score: **82 / 100**

The ERP is now materially closer to production readiness. The largest remaining blockers are server-side/RLS permission hardening, legacy admin deprecation, PDF viewer `pdfjs` eval warning resolution, complete automated route-permission testing, and final deployment environment verification.

## Performance Findings

## Bundle Analysis

Before Phase 16:

- Build output from Phase 15 showed a single main JS chunk of approximately **4,912.91 kB** minified and **1,549.76 kB** gzip.
- ERP, public site, shop, calculator, reports, PDF utilities, and many operational pages were statically reachable from the primary route tree.
- Vite warned that some chunks were larger than 500 kB.
- PDF libraries were both statically and dynamically imported, preventing dynamic import from moving them into separate chunks.

After Phase 16:

- Top-level routes are lazy-loaded through `React.lazy` and `Suspense`.
- ERP route pages are lazy-loaded by route.
- Calculator sub-routes are lazy-loaded.
- Calculator receipt pages dynamically import `jspdf` and `jspdf-autotable` only when PDF download is triggered.
- Build output now splits the app into many route chunks.
- The largest listed app chunk after optimization is approximately **1,201.91 kB** minified and **513.20 kB** gzip.
- `jspdf.es.min` now appears as its own chunk at approximately **387.98 kB** minified and **127.38 kB** gzip.
- `jspdf-autotable` appears as a separate chunk at approximately **31.08 kB** minified and **9.91 kB** gzip.

Remaining large chunks:

- `index-BEJvEum3.js`: about 1,201.91 kB minified.
- `Kargo-BSOSnTHY.js`: about 910.28 kB minified.
- `index-DLM8ZWSE.js`: about 652.73 kB minified.
- `ReportsPage-DGaoDyy_.js`: about 404.35 kB minified.
- `pdf.worker.min`: about 1,087.21 kB asset.

Performance impact:

- Initial route payload is significantly reduced.
- Route navigation now loads module chunks on demand.
- PDF generation libraries no longer inflate calculator receipt route chunks at import time.
- The app still needs deeper vendor chunk strategy and PDF viewer review before final production optimization.

## PDF and Document Pipeline Audit

PDF generation usage:

- ERP report exports use dynamic imports in `src/features/erp/shared/exportUtils.ts`.
- Calculator receipt pages now use dynamic imports for `jspdf` and `jspdf-autotable`.
- Quotation PDF generation still imports `jspdf` and `jspdf-autotable` statically inside `src/features/quotation/pdf/createQuotationPDF.ts`; this is acceptable because quotation PDF creation itself is already reached through a feature-specific hook/route, but it remains a future split candidate.

PDF viewer usage:

- `src/features/quotation/components/PDFViewer.tsx` imports `pdfjs-dist`.
- Build still emits the warning: `Use of eval in node_modules/pdfjs-dist/build/pdf.js is strongly discouraged`.
- This warning comes from the library bundle, not from first-party application code.

Safer alternatives to evaluate:

- Upgrade or replace `pdfjs-dist` with a build that avoids the eval warning if available.
- Move PDF viewing to a lazy route/modal so the warning and worker do not affect routes that do not preview PDFs.
- Consider browser-native PDF preview for simple cases.
- Keep PDF generation separate from PDF viewing to avoid unnecessary shared vendor loading.

No existing PDF exports were removed or intentionally changed.

## Security Findings

## Route Protection

Current behavior:

- ERP routes are wrapped by `ProtectedRoute`.
- `ProtectedRoute` checks Supabase session, active `admin_users`, and then ERP permissions via `getRequiredPermissionForPath`.
- Unauthorized access redirects safely.

Risks:

- Client-side route checks are useful for UX but are not sufficient as a security boundary.
- Access still depends on the legacy `admin_users` gate before ERP roles become effective.
- Route permission mappings need automated test coverage for every foundation role.
- Legacy `/admin/*` remains available and should be deprecated or fully brought into the ERP permission model.

Safe fix applied:

- Added an ERP runtime error boundary so unexpected route/render failures show a Turkish recovery UI instead of a blank application.

## Sensitive Configuration Exposure

Frontend:

- Supabase frontend client uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- No frontend usage of service role keys was found.
- Public `VITE_` variables are intentionally exposed to the browser and must not contain secrets.

Edge functions:

- Service role usage exists in Supabase Edge Functions only.
- `parasut-sync` uses `SUPABASE_SERVICE_ROLE_KEY` server-side.
- `parasut-sync-run` also uses `SUPABASE_SERVICE_ROLE_KEY` server-side.

Safe fix applied:

- `supabase/functions/parasut-sync/index.ts` no longer logs the full token response.
- Raw OAuth error payloads are no longer returned to the client.
- Required environment variables are validated explicitly.
- Token persistence errors now throw, causing the function to fail visibly instead of silently logging and returning success.

Remaining risks:

- Paraşüt token tables must be protected by strict RLS or service-role-only access.
- Edge Function invocation authorization should be reviewed before production. The OAuth callback may need to remain public, but the sync runner should be restricted.
- `parasut-sync-run` logs operational progress and fetch URLs; it does not log tokens, but it should be reviewed before production monitoring is enabled.

## Supabase Production Audit Summary

Migration coverage:

- Existing migrations enable RLS across many ERP, CRM, HR, e-commerce, and website management tables.
- Indexes exist for many status, date, foreign key, and search-related access paths.
- Phase 13 and Phase 14 added indexes and RLS for shop and website tables.

RLS findings:

- Many ERP policies currently allow broad `authenticated` access.
- This is better than anonymous access, but it is not least privilege.
- Client-side ERP permissions are not yet mirrored by database policies.
- Some public website/shop policies intentionally allow anonymous reads/inserts; these need endpoint-specific review before production.

Permission-sensitive tables:

- `erp_users`
- `admin_users`
- `erp_audit_logs`
- `erp_notifications`
- `financial_accounts`
- `invoices`
- `payments`
- `employees`
- `orders`
- `order_items`
- `shop_carts`
- `shop_payment_statuses`
- `website_form_submissions`
- `parasut_tokens`

Query performance risks:

- Dashboard/reporting count queries hit many tables in parallel.
- Reporting pages may need materialized summaries or server-side reporting functions later.
- Search remains mostly client-side or simple Supabase filters; full text search is not yet implemented.
- Current generated Supabase types are still incomplete relative to active ERP schema usage, which keeps `as never` casts in the API layer.

No destructive schema operations were performed.

## Loading and Error Experience

Issues fixed:

- Added `ERPErrorBoundary` with Turkish recovery actions.
- Added Turkish Suspense fallbacks for top-level, ERP route, and calculator route loading.
- Route-level lazy loading now has explicit loading states instead of relying on immediate static imports.

Remaining gaps:

- Not every data-fetching screen has identical retry actions.
- Raw Supabase error text can still appear in some module toasts.
- Skeleton loading is not standardized across all modules.
- Empty states are broadly present but not universal.

Recommended next step:

- Add a shared ERP data-state component with `loading`, `error`, `retry`, and `empty` variants.

## Accessibility Audit

Strengths:

- Most controls use standard buttons, links, inputs, selects, and Radix/shadcn primitives.
- Focus visibility inherits from the shared UI system.
- The ERP dark theme has generally readable contrast.
- New error boundary actions are keyboard-accessible buttons.

Remaining gaps:

- No automated accessibility scan was run in this phase.
- Some table action cells can be dense on keyboard navigation.
- Some custom loading states may need `aria-live` or `role="status"`.
- Some forms rely on placeholders and should be reviewed for explicit labels.
- Some legacy admin screens do not share the ERP accessibility baseline.

## Mobile Production Audit

Areas reviewed:

- ERP dashboard
- Apps hub
- CRM
- Sales
- Inventory
- Finance
- HR
- Reports
- Website management
- E-commerce

Findings:

- Route splitting improves mobile first-load performance.
- Shared tables were already improved in Phase 15 with horizontal overflow.
- Most operational forms use responsive grid classes.
- ERP app hub uses responsive cards and remains the strongest mobile entry point.

Remaining gaps:

- Some action-heavy table cells remain wide.
- Reports and Kargo/calculator pages still need manual mobile QA.
- Legacy admin mobile behavior remains separate.
- No Playwright/mobile screenshot regression pass was performed in this phase.

## Logging and Monitoring Foundation

Implemented:

- Added `ERPErrorBoundary` and local console logging for unexpected runtime errors.
- Paraşüt OAuth callback now logs sanitized operational failure information.
- Existing ERP audit logs remain available at the data layer for business events.

Monitoring architecture prepared:

- Application runtime errors can be routed later from `ERPErrorBoundary.componentDidCatch`.
- API errors can be normalized centrally before adding external monitoring.
- Supabase audit logs can remain the base for business event tracing.
- Edge Function logs should be reviewed and normalized before production.

No external paid monitoring service was introduced.

## Issues Fixed

- `src/App.tsx`: lazy-loaded public, shop, admin, app hub, ERP, and dashboard route components; added global Suspense fallback and error boundary.
- `src/features/erp/index.tsx`: lazy-loaded ERP route pages and named detail-route exports.
- `src/calculator/index.tsx`: lazy-loaded calculator routes.
- `src/calculator/pages/SpurGearReceipt.tsx`: changed PDF libraries to on-demand dynamic imports.
- `src/calculator/pages/HelicalGearReceipt.tsx`: changed PDF libraries to on-demand dynamic imports.
- `src/components/ERPErrorBoundary.tsx`: added global runtime error recovery component.
- `supabase/functions/parasut-sync/index.ts`: removed sensitive token response logging, sanitized OAuth error handling, validated environment variables, and made token persistence failures fail the request.

## Remaining Risks

- Database RLS does not yet enforce ERP role permissions at least-privilege depth.
- Legacy `admin_users` remains a gate in front of `erp_users`.
- `/admin/*` remains a legacy route family.
- `pdfjs-dist` still emits an eval warning.
- Some large chunks remain and need deeper vendor splitting.
- `Kargo` and report/export pipelines still need focused performance review.
- Generated Supabase types are still incomplete relative to current usage.
- No automated role, route, accessibility, or mobile regression tests exist yet.
- Public website CMS records are not yet fully driving the public site.
- Public shop and ERP e-commerce lifecycle remain partially separated.

## Production Deployment Checklist

Domains:

- Verify `dayandisli.com` public domain.
- Verify ERP domain or subdomain routing through `VITE_ERP_BASE_URL`.
- Verify shop domain readiness through `VITE_SHOP_BASE_URL`.
- Confirm public, ERP, and shop route exposure rules in production.

Environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_PUBLIC_BASE_URL`
- `VITE_ERP_BASE_URL`
- `VITE_SHOP_BASE_URL`
- `VITE_APP_TARGET`
- Edge Function secrets for Paraşüt and email integrations.
- Never expose service role keys through `VITE_` variables.

Authentication:

- Confirm Supabase Auth provider settings.
- Confirm admin bootstrap user.
- Confirm ERP user records for production users.
- Confirm session expiry policy.

Permissions:

- Test all foundation roles.
- Confirm app hub visibility per role.
- Confirm route redirects per role.
- Confirm settings/users access is limited.

Database:

- Apply all migrations in order.
- Verify RLS is enabled on exposed tables.
- Verify indexes on status/date/foreign-key reporting paths.
- Regenerate Supabase TypeScript types.
- Run Supabase advisors if CLI/project access is available.

Storage:

- Verify media library path and bucket policies.
- Confirm upload/replace/delete permissions.
- Confirm public media URLs where needed.

Backups:

- Enable Supabase point-in-time recovery or scheduled backups according to plan.
- Document restore procedure.
- Test backup restore before production launch.

Monitoring:

- Review Supabase logs.
- Wire `ERPErrorBoundary` to a future monitoring sink.
- Track Edge Function failures.
- Track failed login and permission-denied events.

Rollback:

- Keep previous production build artifact available.
- Document migration rollback constraints.
- Avoid destructive migrations without backup.
- Confirm DNS rollback and deployment rollback process.

## Technical Debt Register

Critical:

- Mirror ERP role permissions in RLS/server-side access control.
- Resolve `admin_users` versus `erp_users` identity architecture.
- Restrict Edge Function invocation where public access is not required.

High:

- Deprecate or migrate `/admin/*`.
- Regenerate Supabase types and reduce `as never` casts.
- Add automated route-permission tests for all foundation roles.
- Normalize raw Supabase errors into Turkish user-facing messages.
- Resolve `pdfjs-dist` eval warning or isolate PDF viewing further.

Medium:

- Add shared data-state component for loading/error/retry/empty states.
- Add route-level skeletons for major ERP modules.
- Add mobile screenshot QA for apps hub and major modules.
- Split remaining large vendor chunks.
- Move reporting aggregation to server-side functions or summary tables where needed.

Low:

- Update Browserslist database.
- Standardize form required indicators.
- Add more explicit table captions/ARIA labels.
- Review localStorage cart persistence limits for future shop launch.

## Proposed Phase 17 Scope

Recommended Phase 17: **Database Authorization, RLS, and Automated Production Test Coverage**

Suggested scope:

- Implement least-privilege RLS policies aligned with ERP roles.
- Decide and implement the final `admin_users` / `erp_users` identity model.
- Add automated route permission tests for all foundation roles.
- Add Supabase policy tests for permission-sensitive tables.
- Add smoke tests for ERP dashboard, apps hub, CRM, sales, finance, HR, reports, website, and e-commerce.
- Add a first accessibility/mobile regression pass.
- Regenerate Supabase TypeScript types and reduce unsafe casts.

New business modules should wait until these production security controls are complete.
