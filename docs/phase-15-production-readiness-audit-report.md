# Phase 15 Production Readiness Audit Report

Date: 2026-06-02

Scope: ERP stabilization, production readiness, and technical debt reduction after Phase 0 through Phase 14.

## Executive Summary

Phase 15 audited the ERP foundation across routing, navigation, permissions, Turkish UI consistency, design system usage, mobile behavior, forms, error handling, Supabase schema usage, bundle size, and operational readiness.

This phase did not add new business modules. The implemented changes are limited to safe cleanup and consistency fixes:

- Redirected the legacy `/apps/shop-orders` route into the ERP e-commerce order screen instead of rendering the older shop orders page inside the ERP route tree.
- Improved shared ERP table responsiveness by allowing horizontal overflow on narrow screens.
- Replaced remaining visible ERP copy that used English terms such as `Public` and `Duplicate`.
- Added Turkish permission labels for website and e-commerce permission keys in the settings screen.

Production readiness score: **74 / 100**

The ERP foundation is usable and coherent, but not yet fully production-hardened. The most important remaining risks are authorization enforcement depth, RLS hardening, legacy `/admin` dependency, large bundle size, incomplete automated permission tests, and continued reliance on generated Supabase gaps through `as never` casts.

## Audit Findings

## 1. Route and Navigation Audit

Current top-level route structure:

- Public site routes: `/`, `/hizmetler`, `/teknolojiler`, `/urunler`, `/sektorler`, `/iletisim`, `/hakkimizda`, `/referanslar`.
- Public shop routes, feature-flagged by `SHOP_FEATURE_ENABLED`: `/shop`, `/shop/:slug`, `/cart`, `/checkout`, `/checkout/success`.
- ERP routes: `/apps`, `/apps/:appId`, `/dashboard`, `/teklif-sayfasi`, `/erp/*`, and the catch-all ERP route tree.
- Legacy admin routes: `/admin/*`.
- Legacy calculator redirect: `/apps/calculator/*`.
- Legacy ERP redirect: `/erp/*`.

ERP route tree coverage:

- Dashboard: `/dashboard`
- CRM and stakeholder routes: `/musteriler`, `/tedarikciler`, `/crm`, `/paydaslar`, `/stakeholders`
- Sales routes: `/teklifler`, `/siparisler`, `/satis-faaliyetleri`, plus English aliases
- Inventory routes: `/inventory`, `/inventory-movements`
- Procurement routes: `/purchasing`, `/purchase-orders`
- Production routes: `/production`, `/work-orders`, `/routes`, `/subcontracting`
- Finance and accounting routes: `/finans`, `/finance`, `/invoices`, `/payments`
- HR routes: `/hr`, `/time-entries`
- Quality, maintenance, logistics, documents, notifications, reports, settings
- E-commerce ERP routes: `/commerce`, `/commerce/kategoriler`, `/commerce/siparisler`, `/commerce/musteriler`, `/commerce/kampanyalar`, `/commerce/sepetler`, `/commerce/odemeler`
- Website management routes: `/website`, `/website/seo`, `/website/menuler`, `/website/medya`, `/website/formlar`, `/website/bannerlar`, `/website/yayin`

Duplicate or compatibility routes found:

- English aliases remain for some ERP areas, including `finance`, `invoices`, `payments`, `purchase-orders`, `work-orders`, and other older operational paths.
- `/erp/*` remains a compatibility redirect to the root ERP route structure.
- `/teklif-sayfasi` redirects to `/teklifler/yeni`.
- `/apps/shop-orders` was identified as a legacy route and was safely redirected to `/commerce/siparisler`.

Legacy admin remnants:

- `/admin/*` remains active and protected.
- Legacy admin pages still use `AdminLayout`, not the ERP dark layout.
- The admin area still covers products, orders, quotations, media, stakeholders, production, stock, quality, finance, reports, settings, and SQL editor.
- No destructive cleanup was performed because some legacy admin screens still provide fallback operational access.

Route risks:

- The route tree is broad and includes compatibility aliases that should be formally deprecated later.
- `/admin/*` is still an architectural dependency and should eventually be replaced or redirected to ERP equivalents.
- There are no automated route-access tests for each foundation role.

## 2. Permission Audit

Central permission architecture exists in `src/features/erp/shared/permissions.ts`.

Foundation roles audited:

- Süper Yönetici: receives the full permission catalog.
- Yönetici: receives broad access, excluding user delete.
- Satış: receives CRM, sales, and dashboard access.
- Finans: receives finance, accounting, invoicing, expenses, and dashboard access.
- Üretim: receives production, maintenance, repair, dashboard, and partial inventory view access.
- Satın Alma: receives purchasing, purchasing-related inventory, and dashboard access.
- Depo: receives inventory and dashboard access.
- İnsan Kaynakları: receives HR and dashboard access.
- Kalite: receives quality and dashboard access.
- Misafir: receives dashboard only.

Application hub visibility:

- Application cards are filtered through permission keys.
- Application submodules also carry permission keys.
- Newer website and e-commerce application permissions are in the catalog through the application registry.

Route protection:

- `ProtectedRoute` protects ERP entry routes.
- `getRequiredPermissionForPath` maps route paths to module permissions.
- Unauthorized application shell access redirects safely back to `/apps`.

Permission gaps:

- The runtime still requires the existing admin-user authentication gate before the ERP role model can matter. This means the Phase 10 `erp_users` role foundation is not yet a complete replacement for admin access.
- RLS policies are not yet role-specific enough for production-grade least privilege.
- Website and e-commerce access is mostly reserved to admin/planner unless direct custom permissions are assigned.
- The legacy `/admin/*` route maps to `settings.admin`, but it remains a separate admin surface.
- There is no automated role matrix test suite.

## 3. Turkish UI Final Audit

Audit method:

- Searched ERP source for visible English terms, common English button words, placeholders, table headers, notifications, and empty states.
- Reviewed the latest ERP website and e-commerce screens for visible English labels.

Issues fixed:

- Replaced `Duplicate Atlandı` with `Yinelenen Atlandı`.
- Replaced visible `Public site`, `Public medya`, `Public form`, and `Public banner` wording with Turkish equivalents.
- Added Turkish labels for website and e-commerce permission modules/actions in the settings permission selector.

Remaining accepted exceptions:

- Acronyms and product/domain terms such as `ERP`, `CRM`, `SEO`, `PDF`, `CSV`, `Excel`, and `SKU` remain visible where appropriate.
- Code identifiers, import names, and internal function names remain English as required.

Remaining risk:

- Some runtime error messages may expose raw Supabase/Postgres English errors in toasts. These should be normalized in a future error layer.

## 4. ERP Design System Audit

Compliant patterns found:

- Most ERP modules use `ERPLayout`.
- Shared ERP components are broadly used: `PageHeader`, `DataTable`, `StatusBadge`, `FormSection`, `MigrationNotice`, `EmptyState`, and shared cards.
- Phase 9 dark theme tokens remain the main ERP styling foundation.
- New Phase 13 and Phase 14 screens use ERP layout and shared table/form components.

Non-compliant or partially compliant areas:

- Legacy `/admin/*` still uses `AdminLayout`.
- Some older pages under `src/pages/erp` predate the newer component conventions.
- Forms are still locally composed in several modules rather than driven by a single ERP form wrapper.
- Table behavior was inconsistent on mobile because `DataTable` used clipped overflow.

Issue fixed:

- `DataTable` now uses horizontal overflow, improving mobile and narrow viewport behavior across ERP screens.

## 5. Mobile Responsiveness Audit

Areas reviewed:

- Applications hub
- CRM
- Sales
- Inventory
- Procurement
- Production
- Finance
- HR
- Reports
- Website Management

Findings:

- Applications hub uses responsive grid structure and is generally mobile-ready.
- ERP tabs and filters usually wrap.
- Data-heavy pages rely on shared `DataTable`; narrow screens previously risked clipped columns.
- Forms usually use responsive grid classes, but long select controls and action cells can still become dense on small screens.

Issue fixed:

- Shared `DataTable` now supports horizontal scrolling on narrow screens.

Remaining mobile risks:

- Manual browser/device verification was not performed in this phase.
- Wide action columns in settings and some operational pages may still require additional mobile-specific layouts.
- Legacy `/admin/*` mobile behavior remains separate from ERP dark layout behavior.

## 6. Form Consistency Audit

Consistent behaviors found:

- Most forms provide required HTML fields for core inputs.
- Most create/update flows use toast feedback.
- Loading flags are present in key modules.
- Filters and search fields are consistently implemented across many modules.

Gaps:

- Validation is mostly HTML-level or local logic, not centralized.
- Required field indicators are not fully standardized.
- Error summaries are not standardized.
- Form layout is local per page, which increases long-term maintenance cost.
- Success and failure messages are Turkish, but raw backend errors can still be appended.

Recommended direction:

- Introduce a shared ERP form validation and error presentation layer in Phase 16.
- Keep form labels and user-facing validation Turkish.

## 7. Error Handling Audit

Current pattern:

- API helpers return `ApiResult<T>` with `data` and `error`.
- Screens commonly use `MigrationNotice` for missing migration/table situations.
- Toasts are used for success and failure states.
- Permission failures redirect rather than showing stack traces.

Gaps:

- No global ERP error boundary was found for unexpected render/runtime failures.
- Raw Supabase errors can reach user-facing toasts.
- Loading failure states vary between screens.
- Empty state handling exists but is not universal.

Recommended direction:

- Add a global ERP error boundary.
- Add centralized error normalization that maps common Supabase/Postgres errors to Turkish messages.
- Add route-level fallback pages for permission denied, missing data, and module unavailable states.

## 8. Supabase Audit

Migration inventory:

- `20251208092932_b7d45e49-989a-4ea1-a451-45de4f44dffd.sql`
- `20260517110000_admin_users_auth.sql`
- `20260517153000_erp_core_schema.sql`
- `20260517230000_erp_phase2_phase3_readiness.sql`
- `20260518093000_erp_phase5_audit_purchasing.sql`
- `20260518143000_erp_phase6_workflow_notifications.sql`
- `20260601120000_crm_sales_workflows.sql`
- `20260601142414_phase10_authorization_foundation.sql`
- `20260601143710_phase11_hr_organization_foundation.sql`
- `20260601145219_phase13_ecommerce_shop_foundation.sql`
- `20260601145932_phase14_website_management_public_content.sql`

Schema consistency findings:

- Migrations are additive and no destructive schema operation was performed in Phase 15.
- Phase 12 reporting appears to rely on existing tables and did not introduce its own migration.
- Phase 13 and Phase 14 introduced e-commerce and website management tables.
- Phase 6 workflow notification migration exists and remains part of the migration chain.

API usage findings:

- ERP data access is centralized mostly through `src/features/erp/shared/erpApi.ts`.
- Public shop data access also uses Supabase through `src/features/shop/api.ts`.
- Current code still uses many `as never` casts in ERP Supabase calls because generated types do not fully represent the active ERP schema usage.
- Current `as never` count found in ERP/shop-related source: **530**.

Duplicate or overlapping structures:

- Public shop `orders` / `order_items` and ERP `sales_orders` / `sales_order_items` are related but separate models.
- Public/catalog `products` and ERP `inventory_items` overlap conceptually.
- `admin_users` and `erp_users` both participate in identity/authorization.
- Static public pages and new website CMS tables coexist.

Potential index and policy opportunities:

- Add query-driven indexes for frequently filtered status/date fields after production query plans are observed.
- Review website form submissions and shop cart/item access paths for indexes.
- Tighten RLS around ERP roles, website management, and e-commerce management before production use.

No destructive schema cleanup was performed.

## 9. Bundle and Performance Audit

Findings:

- The application is still bundled as a large ERP/client application.
- Heavy dependencies include PDF tooling, charting, Supabase client, Radix components, and reporting/export libraries.
- ERP route components are mostly statically imported in the route tree.
- Reports and document/PDF-related code are candidates for lazy loading.

Opportunities:

- Lazy-load major ERP route groups.
- Lazy-load reports, calculator, PDF/document tooling, website management, and e-commerce management.
- Split public site, public shop, and ERP bundles by runtime target where possible.
- Run bundle visualization before Phase 16 implementation decisions.

## Issues Fixed

- `src/App.tsx`: redirected legacy `/apps/shop-orders` to `/commerce/siparisler` and removed the older shop orders page from the ERP route surface.
- `src/components/erp/DataTable.tsx`: changed table wrapper overflow behavior to support horizontal scrolling.
- `src/features/erp/apps/applicationRegistry.ts`: replaced visible English `Public` wording in ERP application descriptions.
- `src/features/erp/website/WebsiteManagementPage.tsx`: replaced visible English `Public` wording in form descriptions.
- `src/features/erp/crm/LegacyCustomerImportPanel.tsx`: replaced `Duplicate Atlandı` with `Yinelenen Atlandı`.
- `src/features/erp/settings/ERPSettingsPage.tsx`: added Turkish permission labels for website and e-commerce modules/actions.

## Remaining Issues

- `ProtectedRoute` still depends on the legacy `admin_users` gate before the ERP role system is fully effective.
- Legacy `/admin/*` remains active and visually separate.
- RLS is not yet strict enough for production least-privilege access.
- Raw backend errors can surface in Turkish UI.
- `as never` casts remain high in Supabase API usage because generated types are incomplete relative to current schema usage.
- Automated permission, route, and mobile tests are missing.
- Bundle size should be reduced before broad production rollout.
- Public website content is manageable in ERP, but the public site is not yet fully driven by CMS records.
- Public shop and ERP e-commerce management remain related but not fully unified into a single operational lifecycle.

## Technical Debt Inventory

- Legacy admin screens and layout.
- Compatibility route aliases without a formal deprecation plan.
- Separate public shop and ERP commerce data flows.
- Separate public/static website and ERP CMS data flows.
- Duplicate identity concepts across `admin_users` and `erp_users`.
- Local form implementations repeated across modules.
- Raw Supabase errors exposed to UI in some flows.
- Large API file with broad responsibilities.
- Heavy static imports in the ERP route tree.
- Incomplete Supabase generated type coverage.

## Production Readiness Checklist

- Authentication: Partially ready. Supabase Auth and admin protection exist, but ERP role activation depends on legacy admin gate.
- Permissions: Partially ready. Central permissions and role catalog exist, but RLS and tests need hardening.
- ERP modules: Mostly ready as operational foundations; several modules remain foundation-level.
- Reporting: Foundation ready; advanced reporting and export hardening remain.
- CMS: Foundation ready; public site consumption needs follow-up.
- E-commerce: Foundation ready; public shop to ERP lifecycle needs hardening.
- Mobile: Partially ready; shared table overflow improved, manual QA still needed.
- Accessibility: Partially ready; focus and contrast inherit from shared components, but no full audit was performed.
- Performance: Needs improvement; bundle splitting is recommended.
- Security: Needs hardening; RLS, route tests, error normalization, and legacy admin deprecation are priorities.

## Risks

- A user may appear to have ERP role permissions but still fail access if they are not represented in `admin_users`.
- Legacy admin routes may bypass newer ERP visual and workflow expectations.
- RLS gaps can become critical if more users are added.
- Compatibility aliases can hide dead routes and make permission testing harder.
- Large bundles can degrade first-load performance.
- Raw backend errors can reduce UX quality and expose implementation details.

## Recommendations

- Prioritize authorization hardening before adding more modules.
- Decide whether `admin_users` should remain the ERP entry gate or be merged behind `erp_users`.
- Add automated route permission tests for all foundation roles.
- Add a centralized Turkish error normalization layer.
- Start lazy-loading ERP route groups and PDF/reporting dependencies.
- Create a legacy admin deprecation map from `/admin/*` to ERP equivalents.
- Regenerate and maintain Supabase types after each migration phase.
- Add production RLS policies that match ERP permissions and roles.

## Proposed Phase 16 Scope

Recommended Phase 16: **Security, Authorization Hardening, and Runtime Reliability**

Suggested scope:

- Resolve the `admin_users` versus `erp_users` authorization gate.
- Add role-based route and application visibility tests.
- Harden RLS policies for ERP, website management, and e-commerce management.
- Add centralized Turkish error normalization.
- Add an ERP error boundary and permission denied page.
- Add bundle splitting for heavy ERP route groups.
- Define a legacy `/admin/*` deprecation and redirect plan.
- Regenerate Supabase TypeScript types and reduce `as never` casts.

Do not add new business modules in Phase 16 until these production hardening items are complete.
