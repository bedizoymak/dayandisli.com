# dayandisli.com Full Audit Report

Audit date: 2026-06-12

Repository: `C:\Users\Bediz\Documents\dayandisli.com`

Scope: source, configuration, Git history, migrations, Edge Functions, documentation, static route/data-access analysis, lint, TypeScript, and production build. Application code was not modified.

## 1. Executive Summary

The repository is an ambitious, broad ERP platform with meaningful implementation across most requested business domains. The strongest areas are module breadth, migration history, public/ERP domain separation, lazy route loading, commerce/payment foundations, and recent security/observability work.

The primary problem is confidence rather than feature count. The Vite build passes because it transpiles TypeScript without enforcing a typecheck. Independent TypeScript validation fails with 20 errors, lint fails with 71 findings, no automated tests exist, generated Supabase types are stale, and production database state could not be inspected.

Current release status: **buildable, not release-clean, and not production-verified**.

## 2. Current Architecture

| Layer | Implementation |
| --- | --- |
| Frontend | React 18, TypeScript, Vite 5 |
| UI | Tailwind CSS, shadcn/ui, Radix UI, Lucide |
| Routing | React Router 6, domain/build-target conditional routes |
| Server state | TanStack Query provider, but much ERP loading is manual `useEffect` |
| Forms | React Hook Form and Zod in selected flows; many feature forms remain local-state driven |
| Backend | Supabase Auth, Postgres, Data API, Edge Functions |
| Documents | jsPDF, pdf-lib, pdfjs-dist, fontkit |
| Charts | Recharts |
| Deployment model | Public and ERP route exposure controlled by hostname and `VITE_APP_TARGET` |

Main runtime flow:

1. `src/main.tsx` mounts `App`.
2. `src/App.tsx` chooses public and ERP route exposure.
3. ERP routes are wrapped in `ProtectedRoute`.
4. `ProtectedRoute` checks Supabase session, active `admin_users`, current ERP user, and path permission.
5. `src/features/erp/index.tsx` lazy-loads module pages.
6. ERP data is primarily accessed through the 4,700-line `erpApi.ts`.

## 3. Folder Structure

| Path | Responsibility | Notes |
| --- | --- | --- |
| `src/App.tsx` | Root route composition | Public, shop, ERP, admin, and redirects |
| `src/pages` | Public and legacy/top-level pages | Includes login, apps, cargo, finance wrappers |
| `src/features/erp` | ERP business modules | Core operational application |
| `src/features/shop` | Public store and customer portal | Catalog, cart, checkout, account |
| `src/features/admin` | Legacy/alternate admin shell | Generic and summary management pages |
| `src/features/quotation` | Quotation form/PDF flow | Large independent feature |
| `src/features/public-cms` | Public dynamic CMS rendering | Reads website tables |
| `src/calculator` | Gear and weight calculators | Nested route application |
| `src/components/erp` | Shared ERP UI | Tables, filters, forms, sidebar, status |
| `src/services` | Legacy customer/party/finance services | Coexists with `erpApi.ts` |
| `src/integrations/supabase` | Primary browser client and generated types | Types are stale |
| `src/lib` | Utilities and multiple Supabase wrappers | Consolidation needed |
| `supabase/migrations` | 24 ordered migrations | Base through Phase 30 |
| `supabase/functions` | 9 Edge Functions plus shared providers | Payments, checkout, notifications, email, Paraşüt |
| `supabase/manual` | Manual SQL scripts | Risk of drift from migrations |
| `docs` | Architecture and phase reports | Strong historical documentation |

Repository leftovers:

- `src/cursor_refactor.patch`
- `src/cursor_full.patch`
- `src/full_patch_diff.patch`
- `src/features/quotation/hooks/useGestureControls.txt`
- `demo-erp-schema-and-seed.sql`

These should be moved out of runtime source or formally documented.

Largest files:

| File | Lines | Risk |
| --- | ---: | --- |
| `src/features/erp/shared/erpApi.ts` | 4,700 | Cross-domain coupling and regression risk |
| `src/features/erp/shared/types.ts` | 1,336 | Central type bottleneck |
| `ERPHealthCenterPage.tsx` | 825 | Large UI/business logic component |
| `src/features/quotation/index.tsx` | 641 | Large stateful feature component |
| `src/features/shop/api.ts` | 619 | Broad commerce data layer |
| `ERPSettingsPage.tsx` | 608 | Mixed settings and operational logic |
| `ECommercePage.tsx` | 595 | Many submodules in one page |
| `ReportsPage.tsx` | 578 | Large reporting bundle and component |

## 4. Routing Map

All ERP and admin routes require `ProtectedRoute`. Public/shop routes do not use ERP auth; customer-specific shop queries use Supabase customer auth.

### Public and Shop Routes

| Route | Component | Auth Required | Role | Status |
| --- | --- | --- | --- | --- |
| `/` | `Index` | No | Public | Active |
| `/hizmetler` | `Hizmetler` | No | Public | Active |
| `/teknolojiler` | `Teknolojiler` | No | Public | Active |
| `/urunler` | Site `Urunler` | No | Public | Active |
| `/sektorler` | `Sektorler` | No | Public | Active |
| `/iletisim` | Site `Iletisim` | No | Public | Active |
| `/hakkimizda` | `Hakkimizda` | No | Public | Active |
| `/referanslar` | `Referanslar` | No | Public | Active |
| `/site-haritasi` | `SitemapPage` | No | Public | Active |
| `/sayfa/*` | `DynamicCMSPage` | No | Public | Active |
| `/shop` | `ShopPage` | No | Public | Feature-flagged |
| `/shop/kategori/:categorySlug` | `ShopPage` | No | Public | Feature-flagged |
| `/shop/:slug` | `ProductDetailPage` | No | Public | Feature-flagged |
| `/cart` | `CartPage` | No | Public | Feature-flagged |
| `/checkout` | `CheckoutPage` | Customer account to submit | Customer | Feature-flagged |
| `/checkout/success` | `CheckoutSuccessPage` | No | Public | Feature-flagged |
| `/hesabim` | `CustomerPortalPage` | Customer auth for data | Customer | Feature-flagged |
| `/login` | `Login` or ERP-domain redirect | No | ERP users | Active |

### ERP Entry and Legacy Routes

| Route | Component | Required Permission | Status |
| --- | --- | --- | --- |
| `/apps` | `Apps` | `dashboard.view` | Active |
| `/apps/:appId` | `ApplicationShellPage` | App-specific mapping | Active, inconsistent |
| `/admin/*` | `AdminRoutes` | `settings.admin` | Active legacy/parallel shell |
| `/dashboard` | `ERPHomePage` | `dashboard.view` | Active |
| `/apps/calculator/*` | Legacy redirect | Intended `production.view` | Shadowed by `/apps/:appId` |
| `/apps/shop-orders` | Redirect | `dashboard.view` by current ordering | Shadowed by `/apps/:appId` |
| `/teklif-sayfasi` | Redirect | `sales.view` | Active legacy alias |
| `/erp/*` | Legacy ERP redirect | Path-derived | Active |

### Core ERP Routes

| Route group | Components | Permission | Status |
| --- | --- | --- | --- |
| `/dashboard` | Dashboard | `dashboard.view` | Active |
| `/musteriler/*`, `/tedarikciler/*` | Party pages | `crm.view` | Active |
| `/crm`, `/paydaslar`, `/stakeholders/:id` | CRM/stakeholders | `crm.view` | Active |
| `/teklifler/*`, `/quotations` | Quotations | `sales.view` | Active |
| `/siparisler/*`, `/sales-orders/*`, `/satis-faaliyetleri` | Sales | `sales.view` | Active |
| `/production` | Production dashboard | `production.view` | Active |
| `/work-orders/*` | Work orders | `production.view` | Active |
| `/routes` | Production routes | `production.view` | Active |
| `/subcontracting/*` | Subcontracting | `production.view` | Active |
| `/inventory/*`, `/inventory-movements` | Inventory | `inventory.view` | Active |
| `/purchasing`, `/purchase-orders/*` | Purchasing | `purchasing.view` | Active |
| `/finans/*`, `/finance`, `/invoices`, `/payments` | Finance | `finance.view` | Active |
| `/commerce/*` | E-commerce administration | `commerce.view` | Active |
| `/website/*` | Website management | `website.view` | Active |
| `/hr/*`, `/time-entries` | HR | `hr.view` | Active |
| `/logistics`, `/shipments/:id` | Logistics | fallback `dashboard.view` | Permission gap |
| `/quality/*` | Quality | `quality.view` | Active |
| `/maintenance` | Maintenance | `maintenance.view` | Active |
| `/documents` | Documents | fallback `dashboard.view` | Permission gap |
| `/notifications`, `/bildirimler` | Notifications | fallback or dashboard | Duplicate aliases |
| `/reports` | Reports | `reports.view` | Active |
| `/health` | Health center | fallback `dashboard.view` | Sidebar expects `reports.view` |
| `/settings`, `/ayarlar` | Settings | `settings.view` | Duplicate aliases |
| `/calculator/*` | Calculator | `production.view` | Active |
| `/kargo` | Cargo | fallback `dashboard.view` | Sidebar expects `inventory.view` |
| `/gorevler`, `/notlar` | Placeholder pages | fallback `dashboard.view` | Live routes marked `Yakında` |

### Admin Routes

`/admin`, `/admin/urunler`, `/admin/siparisler`, `/admin/teklifler`, `/admin/medya`, `/admin/cariler`, `/admin/uretim`, `/admin/stok`, `/admin/kalite`, `/admin/finans`, `/admin/raporlar`, `/admin/ayarlar`, and `/admin/sql-editor` exist.

Routing defects:

- Static `/apps/calculator/*` and `/apps/shop-orders` routes follow `/apps/:appId`; React Router ranks routes, but current behavior must be smoke-tested because the application shell also accepts these IDs and redirects unknown IDs.
- Turkish and English aliases duplicate several pages without canonicalization.
- Logistics, documents, health, cargo, notifications, tasks, and notes lack explicit path-permission mappings.
- Unknown admin paths silently redirect to `/admin`; unknown ERP paths show `ErpNotFoundPage`.
- Route definitions, application registry, sidebar registry, and permission regexes are separate sources of truth.

## 5. Authentication Flow

Login:

1. `Login.tsx` calls `supabase.auth.signInWithPassword`.
2. It queries `admin_users` for matching active email.
3. Unauthorized users are signed out.
4. It navigates to the saved `auth_redirect_path` or default destination.

Protected navigation:

1. `ProtectedRoute` stores the requested path.
2. It renders `LoadingScreen`, not ERP children.
3. It calls `supabase.auth.getSession()`.
4. It validates active `admin_users`.
5. It calls `getCurrentERPUser()`.
6. It maps the pathname to a required permission.
7. It renders children, redirects to login, or redirects to `/apps`.

Logout exists in ERP/admin/application shells and calls `supabase.auth.signOut()`.

Answers to the requested checks:

- Can unauthenticated users briefly see ERP pages? **No, not through the current `ProtectedRoute`; children are withheld during checking.**
- Can dashboard appear before auth validation? **No.**
- Is there route flickering? **ERP content flicker is mitigated, but repeated loading-screen flashes can occur on navigation because the gate rechecks on each path/search change.**
- Is auth checked on every navigation? **Yes, for protected routes.**
- Is auth centralized? **No. Login, route gate, admin shell, application shell, shop auth, and several pages call Supabase auth independently.**

Root architectural issue: authentication, admin allow-list validation, ERP identity, and permission state are recomputed instead of provided by one auth context/store.

## 6. Authorization Model

Authorization layers:

- `admin_users`: mandatory active-email allow list for ERP entry.
- `erp_users`: ERP role and permission identity.
- `ROLE_DEFINITIONS`: frontend role-to-permission defaults.
- User-specific `roles` and `permissions`.
- Path regex mapping in `getRequiredPermissionForPath`.
- Application and sidebar filtering.
- Database RLS and tenant policies.

Findings:

- The admin role receives all catalog permissions.
- Frontend role permissions are useful for UI but cannot secure database access.
- Application-level and page-level permission names do not consistently align.
- `ProtectedRoute` redirects denied users to `/apps`, which itself requires `dashboard.view`; users without that permission can loop between denied states.
- `ApplicationShellPage` checks permissions only after the user resolves; before that, it renders an empty module list.
- The sidebar separately fetches the ERP user, duplicating the gate query.
- Production RLS remains the actual security boundary and was not live-tested.

## 7. Navigation Analysis

Navigation exists in four overlapping systems:

1. Public `Navigation.tsx`.
2. Application launcher registry in `applicationRegistry.ts`.
3. ERP sidebar registry in `erpModules.ts`.
4. Admin sidebar in `AdminLayout.tsx`.

Broken or confusing behavior:

- Launcher applications expose a much broader module set than the compact ERP sidebar.
- Sidebar marks Tasks and Notes `Yakında`, but clicking them opens live placeholder routes.
- Some ERP modules are deliberately hidden from the sidebar but remain routable.
- English aliases can highlight Turkish sidebar items through custom conditions, but not all aliases are covered.
- Application shell cards link directly into the ERP layout; there is no breadcrumb back to the app shell after entry.
- Public `NotFound` uses an anchor rather than router navigation.

## 8. Sidebar Analysis

The ERP sidebar is hardcoded through `src/config/erpModules.ts`. It filters `visibleErpModules` by `hasPermission`.

Role filtering works only after `getCurrentERPUserSafe()` completes. During the initial render, the sidebar is empty because `user` is `null`. There is no sidebar loading state or shared user cache.

The application launcher is also hardcoded, in a second registry. The admin sidebar is hardcoded a third time. This produces drift in:

- Titles and module grouping.
- Required permission names.
- Route aliases.
- Active-state logic.
- Module status labels.

Recommended design: one typed route/module registry should generate the launcher, sidebar, active matching, permission map, breadcrumbs, and route smoke-test cases.

## 9. Database Mapping

The migrations define approximately 80 tables. The following map groups them by business ownership.

| Tables | Main files/areas | Usage | CRUD | Risk |
| --- | --- | --- | --- | --- |
| `admin_users`, `erp_users`, `allowed_emails` | Login, ProtectedRoute, permissions, settings | ERP identity and access | SELECT, INSERT, UPDATE | High: dual identity gates |
| `companies`, `company_branches`, `company_memberships`, `warehouses` | `erpApi`, settings, tenant migrations | Tenant scope | SELECT, INSERT, UPDATE | Critical: live isolation unverified |
| `stakeholders` | CRM, parties, purchasing, sales | Unified parties | SELECT, INSERT, UPDATE, DELETE | Medium |
| `crm_leads`, `crm_opportunities`, `crm_tasks`, `crm_activities` | CRM page, public CMS lead creation | CRM pipeline | SELECT, INSERT, UPDATE, DELETE | High: opportunity creation defect |
| `sales_orders`, `sales_order_items`, `erp_quotation_links` | Sales, quotations, commerce conversion | Sales lifecycle | SELECT, INSERT, UPDATE, DELETE, triggers | High |
| `quotations` | Quotation feature/admin | Quote records and PDFs | SELECT, INSERT, UPDATE | Medium: legacy base table |
| `work_orders`, `work_order_operations` | Production | Work execution | SELECT, INSERT, UPDATE, DELETE | High |
| `production_routes`, `production_route_steps` | Routes/production | Routing | SELECT, INSERT, UPDATE, DELETE | Medium |
| `subcontracting_jobs` | Fason pages | External operations | SELECT, INSERT, UPDATE | Medium |
| `inventory_items`, `inventory_movements` | Inventory, checkout, purchasing | Stock | SELECT, INSERT, UPDATE, DELETE | High: stock concurrency |
| `purchase_orders`, `purchase_order_items` | Purchasing | Procurement | SELECT, INSERT, UPDATE, DELETE | Medium |
| `financial_accounts`, `invoices`, `payments`, `accounting_entries` | Finance, payment webhook | Finance/accounting | SELECT, INSERT, UPDATE, DELETE, RPC | High |
| `payment_provider_events`, `payment_provider_health`, `payment_reconciliation_logs`, `payment_refund_operations` | Payment Edge Functions, health center | Provider reliability | SELECT, INSERT, UPDATE, UPSERT | High |
| `employees`, `employee_assets`, `employee_time_entries` | HR | Personnel/time | SELECT, INSERT, UPDATE, DELETE | High: personal data |
| `hr_departments`, `hr_positions`, `hr_leave_requests`, `hr_recruitment_candidates`, `hr_onboarding_tasks` | HR | Organization workflows | SELECT, INSERT, UPDATE, DELETE | High: personal data |
| `shipments`, `shipment_items` | Logistics | ERP shipment | SELECT, INSERT, UPDATE | Medium |
| `quality_reports`, `quality_measurements`, `measuring_tools` | Quality | Inspection | SELECT, INSERT, UPDATE | Medium |
| `machines`, `maintenance_tasks` | Maintenance/production | Assets and maintenance | SELECT, INSERT, UPDATE | Medium |
| `documents` | Documents and links | Metadata | SELECT, INSERT, UPDATE, DELETE | Storage linkage not fully verified |
| `products`, `product_images`, `shop_categories`, `shop_campaigns` | Shop/admin/commerce | Catalog | SELECT, INSERT, UPDATE, DELETE | Medium |
| `orders`, `order_items` | Shop, checkout, ERP commerce | Customer orders | SELECT, INSERT, UPDATE, DELETE | High |
| `shop_carts`, `shop_cart_items` | Commerce | Cart foundation | SELECT, INSERT, UPDATE, DELETE | Medium |
| `shop_payment_statuses`, `shop_shipping_methods`, `shop_carriers` | Checkout/commerce | Payment and delivery reference | SELECT, INSERT, UPDATE | High |
| `shop_customer_profiles` | Customer portal | Customer identity | SELECT, UPSERT | High: ownership policy |
| `shop_inventory_reservations`, `commerce_checkout_events` | Checkout function | Reservation and audit | SELECT, INSERT, UPDATE, DELETE, RPC | High |
| `shop_shipments`, `shop_fulfillment_history`, `shop_customer_notifications`, `shop_return_requests` | Portal/commerce/notifications | Fulfillment and returns | SELECT, INSERT, UPDATE | High |
| `website_pages`, `website_seo_settings`, `website_menu_items`, `website_media_assets`, `website_forms`, `website_form_submissions`, `website_banners` | CMS/public CMS | Website content | SELECT, INSERT, UPDATE, DELETE | Medium |
| `erp_notifications`, `erp_audit_logs` | Notifications/audit | Operational events | SELECT, INSERT, UPDATE | Medium |
| `platform_alerts`, `platform_events`, `platform_metrics`, `scheduled_job_runs` | Health center | Observability | SELECT, INSERT, UPDATE | Medium |
| `automation_rules`, `automation_executions` | Phase 30 migration/health | Scheduled automation | SELECT, INSERT, UPDATE | High: deployment unverified |
| `parasut_tokens`, `parasut_contacts`, `parasut_products`, `parasut_invoices` | Paraşüt functions | External sync | SELECT, UPSERT | Schema origin requires validation |
| `settings`, `order_counter`, `erp_number_sequences` | Settings/numbering | Configuration and sequences | SELECT, UPDATE, RPC | Medium |

Potential missing/drift items:

- Generated types do not represent the current migration set.
- Paraşüt tables are used by functions but were not found in the migration table extraction; they may come from manual SQL or an unscanned statement form.
- `customers_full` is used by cargo and legacy services and comes from manual/legacy schema rather than the current core migration map.
- Manual SQL files can diverge from ordered migrations.
- Mock/demo fallback data is used when database access fails.

This could not be verified from repository contents:

- Which migrations are applied in production.
- Current Data API grants.
- Effective RLS policies for each role.
- Production table/view/function inventory.
- Storage buckets and policies.
- Table row counts and orphaned records.

## 10. Supabase Integration

Positive findings:

- Primary browser client is centralized at `src/integrations/supabase/client.ts`.
- Edge Functions use service-role secrets server-side.
- Checkout validates the bearer token through `auth.getUser`.
- Payment creation/refund/webhook logic is server-side.
- Migrations include RLS and tenant-isolation phases.

Risks:

- Multiple client wrappers remain: `src/lib/supabase.ts`, `supabaseClient.ts`, `client.ts`, and integration client.
- 460 broad matches for `as never`, `any`, mock, or TODO patterns were found; generated-type casts are pervasive.
- `.env` is tracked, although Vite publishable values are not secrets.
- `ContactForm.tsx` constructs its own client path instead of consistently using the integration client.
- No live `supabase db advisors` or migration status was available.
- Security-definer functions and grants require live/manual review against Phase 26 verification queries.

## 11. ERP Module Analysis

## Dashboard

### Files
`dashboard/ERPHomePage.tsx`, `erpApi.ts`, `erpModules.ts`.

### Database Tables
Cross-module counts and operational summaries.

### Existing Features
KPIs, module cards, quick actions, recent operational information.

### Missing Features
User-configurable widgets and tested role-specific layouts.

### Risks
Many parallel count queries; fallback data can hide database failures.

### Recommended Next Steps
1. Cache summary queries.
2. Distinguish demo data visibly from live data.

## CRM

### Files
`crm/CRMOperationsPage.tsx`, `StakeholdersPage.tsx`, `StakeholderTable.tsx`.

### Database Tables
`stakeholders`, `crm_leads`, `crm_opportunities`, `crm_tasks`, `crm_activities`.

### Existing Features
Stakeholders, leads, opportunities, tasks, activities, customer/supplier links.

### Missing Features
Reliable opportunity creation and automated pipeline tests.

### Risks
`createCRMOpportunity` is missing; public CMS can also create leads.

### Recommended Next Steps
1. Fix the missing creation function/import.
2. Add lead-to-opportunity integration tests.

## Paydaşlar

### Files
CRM stakeholder pages and party components.

### Database Tables
`stakeholders`, legacy `customers_full`.

### Existing Features
Unified party directory and detail pages.

### Missing Features
Completed legacy-data retirement.

### Risks
Two data models can drift.

### Recommended Next Steps
1. Choose `stakeholders` as the canonical model.
2. Retire or formalize `customers_full` compatibility.

## Teklif

### Files
`features/quotation`, `erp/quotations`, PDF/email functions.

### Database Tables
`quotations`, `erp_quotation_links`, counters.

### Existing Features
Form, PDF, preview, email, recent quotations.

### Missing Features
Clean types and focused automated PDF/form tests.

### Risks
Several large components and lint errors; PDF libraries drive large bundles.

### Recommended Next Steps
1. Resolve quotation type/lint failures.
2. Lazy-load PDF tooling only when needed.

## Sipariş

### Files
`erp/sales`, detail pages, shop commerce.

### Database Tables
`sales_orders`, `sales_order_items`, `orders`, `order_items`.

### Existing Features
ERP sales orders, shop orders, detail views, conversion foundations.

### Missing Features
End-to-end tested cancellation, return, and reversal workflow.

### Risks
Dual order models and trigger-driven synchronization.

### Recommended Next Steps
1. Document the canonical state machine.
2. Add conversion/idempotency tests.

## Üretim

### Files
`erp/production`.

### Database Tables
`work_orders`, `work_order_operations`, routes, machines.

### Existing Features
Dashboard, work orders, operations, printing.

### Missing Features
Capacity planning and complete scheduling UX.

### Risks
Complex state transitions and broad API coupling.

### Recommended Next Steps
1. Extract a production service.
2. Test order-to-work-order transitions.

## Rota

### Files
`production/RoutesPage.tsx`.

### Database Tables
`production_routes`, `production_route_steps`.

### Existing Features
Route and step management foundation.

### Missing Features
Versioning, approval, and historical immutability.

### Risks
Changes may affect active work orders unless snapshots are enforced.

### Recommended Next Steps
1. Verify route snapshot behavior.
2. Add revision controls.

## İş Emirleri

### Files
`WorkOrdersPage.tsx`, `WorkOrderOperations.tsx`, detail/print files.

### Database Tables
`work_orders`, `work_order_operations`.

### Existing Features
Listing, detail, operation tracking, print.

### Missing Features
Transaction-safe completion and material consumption verification.

### Risks
Large components and cross-module dependencies.

### Recommended Next Steps
1. Add workflow tests.
2. Validate stock postings.

## Operasyonlar

### Files
`WorkOrderOperations.tsx`, detail pages.

### Database Tables
`work_order_operations`.

### Existing Features
Operation records and status updates.

### Missing Features
Machine/operator time capture depth.

### Risks
Concurrent edits and status sequencing.

### Recommended Next Steps
1. Enforce transitions in database functions.
2. Add optimistic concurrency controls.

## Fason

### Files
`subcontracting/SubcontractingPage.tsx`, detail page.

### Database Tables
`subcontracting_jobs`.

### Existing Features
External operation tracking and detail.

### Missing Features
Purchase/receipt/invoice reconciliation.

### Risks
Status changes span production, purchasing, and quality.

### Recommended Next Steps
1. Define a single state machine.
2. Connect receipt and quality events.

## Stok

### Files
`erp/inventory`, shop reservation code.

### Database Tables
`inventory_items`, `inventory_movements`, `shop_inventory_reservations`, `warehouses`.

### Existing Features
Cards, movements, detail, checkout reservation.

### Missing Features
Verified multi-warehouse availability and cycle counting.

### Risks
Concurrency and reservation rollback.

### Recommended Next Steps
1. Move critical stock changes into transactional RPCs.
2. Test failed checkout and return reversals.

## Finans

### Files
`pages/erp/Finance*`, `erp/finance`, services.

### Database Tables
Accounts, invoices, payments, accounting entries, payment documents.

### Existing Features
Transactions, payments, reports, invoices, checks/senets foundation.

### Missing Features
Full general ledger, period close, and reconciliation UX.

### Risks
Multiple finance implementations and invalid admin summary fields.

### Recommended Next Steps
1. Unify finance domain models.
2. Fix admin report typing.

## İK / Puantaj

### Files
`erp/hr`.

### Database Tables
Employees, time entries, departments, positions, leave, recruitment, onboarding.

### Existing Features
Personnel, organization, attendance/time foundation.

### Missing Features
Payroll and mature approval workflows.

### Risks
Sensitive personal data; production RLS unverified.

### Recommended Next Steps
1. Perform role-based RLS tests.
2. Add audit and retention rules.

## Lojistik

### Files
`erp/logistics`, `pages/Kargo.tsx`.

### Database Tables
ERP and shop shipment tables.

### Existing Features
Shipments, details, tracking fields, cargo labels/PDF.

### Missing Features
Carrier API integration.

### Risks
No explicit route permission mapping; Kargo still uses legacy customer data.

### Recommended Next Steps
1. Add `logistics.view`/cargo permission mapping.
2. Consolidate shipment models.

## Kalite

### Files
`erp/quality`, detail pages.

### Database Tables
`quality_reports`, `quality_measurements`, `measuring_tools`.

### Existing Features
Reports, measurements, detail.

### Missing Features
Nonconformance/CAPA depth and calibration alerts.

### Risks
Production release linkage requires verification.

### Recommended Next Steps
1. Enforce release gates in database workflow.
2. Add calibration scheduling.

## Bakım

### Files
`erp/maintenance`.

### Database Tables
`machines`, `maintenance_tasks`.

### Existing Features
Machine and maintenance task foundation.

### Missing Features
Preventive schedules, spare parts, downtime analytics.

### Risks
Launcher repair/maintenance permissions differ from route mapping.

### Recommended Next Steps
1. Normalize permissions.
2. Connect maintenance to inventory and observability.

## Doküman

### Files
`erp/documents`.

### Database Tables
`documents`.

### Existing Features
Document metadata and entity links.

### Missing Features
Verified Storage bucket management, versioning, and retention.

### Risks
No explicit route permission; Storage policies not verifiable.

### Recommended Next Steps
1. Add `documents.view/manage`.
2. Audit Storage buckets and policies.

## Raporlama

### Files
`erp/reports`, finance reports, export utilities.

### Database Tables
Cross-domain reads, platform metrics.

### Existing Features
KPI cards, charts, exports, health center.

### Missing Features
Server-side aggregates and scheduled distribution.

### Risks
`ReportsPage` produces a 407 kB chunk; counts may be expensive.

### Recommended Next Steps
1. Add materialized/server-side summaries where justified.
2. Split report bundles.

## Sistem Ayarları

### Files
`ERPSettingsPage.tsx`, admin settings, permissions.

### Database Tables
Settings, users, roles/memberships, sequences, automation.

### Existing Features
ERP settings, roles/permissions foundation, health/database status.

### Missing Features
One coherent administration surface.

### Risks
ERP settings and `/admin` overlap; generic CRUD depends on RLS.

### Recommended Next Steps
1. Decide which admin shell is canonical.
2. Consolidate identity, permissions, and configuration.

## 12. Recently Changed Areas

Latest commits:

- `bf1dab9` separate apps launcher layout from ERP module layout.
- `a5ac693` block unauthenticated ERP render and repair schema check.
- `42135dd` protect ERP routes behind authentication.
- `0f1f490` stabilize ERP demo fallback data.
- `779d50f` fix apps empty state and permission resolution.
- Phases 24-30 added tenant isolation, security governance, observability, alerts, and automation.

The last ten commits added over 6,000 lines. Recent high-risk areas are:

- `ProtectedRoute.tsx`
- `applicationRegistry.ts`
- `Apps.tsx` and application shells
- `demoFallback.ts`
- `erpApi.ts`
- health/observability pages
- tenant/RLS migrations

Current working tree:

- Modified: `src/features/erp/apps/applicationRegistry.ts`
- Change: launcher application routes changed from direct module routes to `/apps/<application>`.
- This audit did not modify or revert it.

## 13. Bugs and Broken Flows

## [P1] CRM opportunity creation references a missing symbol

Files: `src/features/erp/crm/CRMOperationsPage.tsx`

Current Behavior: opportunity creation calls `createCRMOpportunity`.

Root Cause: the symbol is not defined/imported.

Suggested Fix: export/import the correct API function and add a creation test.

## [P1] Admin summaries use nonexistent report fields

Files: `src/features/admin/AdminSummaryPages.tsx`

Root Cause: UI expects `invoiceTotal`, `paymentTotal`, `customerBalance`, and `supplierBalance`, but `ERPReportSummary` does not define them.

Suggested Fix: align the API result and type or calculate from supported fields.

## [P1] Shop code and generated schema types disagree

Files: `src/features/shop/api.ts`, `src/integrations/supabase/types.ts`

Root Cause: generated types predate shop columns such as `is_shop_visible`, `shop_category_id`, and customer/payment/fulfillment fields.

Suggested Fix: regenerate types from the deployed schema after migration parity is confirmed.

## [P1] Customer portal checkout payload is incomplete

Files: `src/features/shop/pages/CustomerPortalPage.tsx`

Root Cause: `CheckoutPayload` now requires `paymentProvider`, but the reorder/resubmit path does not supply it.

Suggested Fix: require provider selection or explicitly use a supported default.

## [P1] Permission mapping differs by navigation surface

Files: `applicationRegistry.ts`, `erpModules.ts`, `permissions.ts`

Root Cause: independent registries use different permission namespaces.

Suggested Fix: generate all navigation and path rules from one typed registry.

## [P2] Demo fallback objects no longer match types

Files: `demoFallback.ts`

Root Cause: schema types gained required fields without updating fallback fixtures.

Suggested Fix: type fixtures with `satisfies` and update them whenever domain types change.

## [P2] Service error classifications contain impossible branches

Files: `customerFullService.ts`, `financeService.ts`, `partiesService.ts`

Root Cause: code compares against `missing_table`, but the narrowed error union excludes it.

Suggested Fix: repair the classifier type and tests.

## [P2] Notification center is mock-backed

Files: `NotificationCenter.tsx`, `mockNotifications.ts`

Current Behavior: header notifications do not represent `erp_notifications`.

Suggested Fix: connect it to the same live source as `NotificationsPage`.

## 14. Security Risks

| Priority | Risk | Evidence |
| --- | --- | --- |
| P0 | Production RLS/tenant state unverified | No live database inspection |
| P1 | Permission drift can expose UI inconsistently | Three registries plus regex mapping |
| P1 | Generic admin CRUD has broad operations | `adminData.ts` |
| P1 | Tracked `.env` can invite secret mistakes | `.env` is in Git |
| P1 | Demo fallback can mask denied/missing data | `demoFallback.ts`, safe fetch patterns |
| P2 | Multiple Supabase wrappers increase configuration drift | `src/lib` and integration client |
| P2 | Storage security not established from repository | No verified bucket policy inventory |
| P2 | Client route checks may be mistaken for security | Frontend permission code |

No service-role key was found embedded in browser source. Secret names in Edge Functions are environment lookups, which is appropriate.

## 15. Performance Risks

- Bundle warnings: 1,201.50 kB, 910.25 kB, and 694.24 kB chunks after minification.
- PDF worker is 1,087.21 kB.
- Reports chunk is 407.30 kB.
- `pdfjs-dist` uses `eval`, generating a build warning.
- `erpApi.ts` performs many broad selects and parallel counts.
- Admin generic lists cap at 100 but lack real pagination.
- Many ERP pages use manual mount fetches and do not share TanStack Query caching.
- Auth and ERP-user checks repeat on navigation.
- Recharts/PDF libraries should be isolated to routes that need them.
- Missing `useEffect` dependencies appear in many pages and can create stale data or repeated fetch behavior when “fixed” without memoization.

## 16. Code Quality Findings

Validation:

| Command | Result |
| --- | --- |
| `npm install` | Not rerun; lockfile and `node_modules` were present |
| `npm run lint` | Failed: 32 errors, 39 warnings |
| `npm run typecheck` | Script does not exist |
| `npx tsc -p tsconfig.app.json --noEmit` | Failed: 20 errors |
| `npm run build` | Passed |
| `npm run dev` | Not kept running; static/runtime browser verification requires credentials and live backend |

Lint categories:

- Explicit `any` in calculator, contact, quotation, PDF, Supabase wrappers, and functions.
- Empty interface rules in shadcn components.
- 39 hook/fast-refresh warnings.
- `require()` in Tailwind config.

Scores:

| Category | Score | Reason |
| --- | ---: | --- |
| Component size | 4/10 | Multiple 500-800-line pages |
| Duplication | 5/10 | Auth, navigation, clients, finance and party paths overlap |
| Business logic separation | 5/10 | Large UI pages and monolithic API |
| Hook quality | 5/10 | Many dependency warnings |
| Service abstraction | 5/10 | Good start, but one 4,700-line service |
| TypeScript | 4/10 | 20 errors and pervasive casts |
| Error handling | 6/10 | Safe wrappers exist, but can hide failures |
| Loading states | 6/10 | Present, but duplicated and sometimes empty-first |
| Form validation | 6/10 | Mixed quality across modules |
| Responsiveness | 7/10 | Responsive shells and mobile sidebar exist |

## 17. Missing Features

- Automated test suite.
- Production migration/RLS verification in CI.
- General ledger and period close.
- Payroll.
- Mature CAPA/nonconformance.
- Carrier API integration.
- Full return/refund/inventory reversal orchestration.
- Storage/media manager with verified policies.
- Unified notifications replacing mocks.
- Pagination for operational tables.
- Route/permission contract tests.
- Clear canonical replacement for the parallel `/admin` shell.

## 18. Technical Debt

1. Stale Supabase generated types.
2. Monolithic `erpApi.ts` and `types.ts`.
3. Multiple Supabase clients.
4. Duplicate Turkish/English routes.
5. Three navigation registries.
6. Parallel admin and ERP settings surfaces.
7. Manual SQL outside ordered migrations.
8. Patch/text artifacts in `src`.
9. Demo fallback mixed into production data access.
10. No test infrastructure.
11. Large PDF/report chunks.
12. Hook dependency warnings across most modules.

## 19. Recommended Architecture

1. Add `AuthProvider` that owns Supabase session, active-admin validation, ERP user, roles, permissions, and auth events.
2. Create one typed `applicationRegistry` containing route, aliases, title, layout, permission, sidebar visibility, and child modules.
3. Generate route permission matching, launcher cards, sidebar, breadcrumbs, and tests from that registry.
4. Split `erpApi.ts` into domain services: CRM, sales, production, inventory, purchasing, finance, HR, quality, logistics, settings, observability.
5. Use TanStack Query keys and invalidation consistently.
6. Keep critical stock, payment, tenant, and workflow transitions in transactional SQL functions/Edge Functions.
7. Regenerate Supabase types in CI after migration changes.
8. Separate demo mode explicitly through configuration and visible banners; never silently fall back in production.
9. Add route-level error boundaries and structured telemetry.
10. Establish a small testing pyramid: permission unit tests, service integration tests, and Playwright smoke tests.

## 20. Prioritized Roadmap

### P0

1. Verify production migration parity, grants, RLS, tenant isolation, Storage policies, Edge Function secrets, and scheduled jobs.
2. Confirm no cross-company reads/writes with two real test users.

### P1

1. Fix all 20 TypeScript errors.
2. Fix CRM opportunity creation.
3. Regenerate Supabase types.
4. Normalize launcher/sidebar/path permissions.
5. Test every application launcher card with admin, sales, finance, production, warehouse, HR, quality, and viewer roles.
6. Centralize auth state.
7. Add login and critical workflow smoke tests.

### P2

1. Split monolithic API/types.
2. Replace mock notifications.
3. Add pagination and query caching.
4. Consolidate Supabase clients and admin surfaces.
5. Resolve lint errors and hook warnings.
6. Move manual schema changes into migrations.

### P3

1. Optimize PDF/report bundles.
2. Remove source patch artifacts.
3. Canonicalize legacy route aliases.
4. Add richer module UX and configurable dashboards.

## 21. Files Requiring Immediate Attention

| File | Reason |
| --- | --- |
| `src/features/erp/crm/CRMOperationsPage.tsx` | Missing opportunity creation symbol |
| `src/features/admin/AdminSummaryPages.tsx` | Invalid report fields |
| `src/integrations/supabase/types.ts` | Stale schema types |
| `src/features/shop/api.ts` | Many schema/type mismatches |
| `src/features/shop/pages/CustomerPortalPage.tsx` | Missing payment provider |
| `src/features/erp/apps/applicationRegistry.ts` | Uncommitted route change and permission drift |
| `src/features/erp/shared/permissions.ts` | Incomplete path map |
| `src/components/ProtectedRoute.tsx` | Repeated auth/database checks |
| `src/features/erp/shared/demoFallback.ts` | Invalid fixtures and masking risk |
| `src/features/erp/shared/erpApi.ts` | 4,700-line service and scope error |
| `src/features/erp/shared/types.ts` | Centralized, expanding type debt |
| `src/components/erp/NotificationCenter.tsx` | Mock data in operational UI |

## 22. Questions For Product Owner

1. Is `/admin` intended to remain a supported product surface, or should ERP settings replace it?
2. Which hostname/build target is deployed for public, ERP, and shop environments?
3. Is demo fallback allowed in production, or only local/demo builds?
4. Which permission taxonomy is canonical: application permissions or module route permissions?
5. Should users without `dashboard.view` be allowed into a specific application?
6. Which database is authoritative for parties: `stakeholders` or `customers_full`?
7. Which payment provider is enabled in production?
8. Are returns expected to reverse inventory, accounting, payment, and fulfillment automatically?
9. Is multi-company support active now, or still foundation-only?
10. What retention and access rules apply to HR, audit, payment, and customer data?

This could not be verified from repository contents.

Files requiring manual inspection:

- Deployed Supabase migration list and schema.
- Data API settings and grants.
- RLS policies under real roles.
- Edge Function deployment/secrets/logs.
- Cron and automation schedules.
- Storage buckets and policies.
- Production domain environment variables.
- Payment-provider dashboard and webhook configuration.

## Next Action Checklist

1. First file to fix: `src/features/erp/crm/CRMOperationsPage.tsx`
2. First workflow to fix: CRM opportunity creation, then launcher-to-module authorization
3. Biggest demo risk: Vite build success masking type and role-navigation failures
4. Database table requiring validation: `company_memberships`
5. Files to send back:
   - `PROJECT_FULL_AUDIT_REPORT.md`
   - `PROJECT_EXECUTIVE_SUMMARY.md`
