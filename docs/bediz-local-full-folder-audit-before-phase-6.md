# Bediz Local Full Folder Audit Before Phase 6

Date: 2026-06-01  
Workspace: `C:\Users\Bediz\Documents\dayandisli.com`  
Purpose: full repository audit before continuing Phase 6 development.  
Constraint followed: no code edits, no commit, no push. This document is the only intended file creation.

## Executive Summary

The repository is a Vite + React + TypeScript application with a public company website, a protected ERP runtime, legacy admin screens, a quotation builder, a gear calculator, optional public shop features, and Supabase as the only backend/data source.

The current architecture reflects Phase 0-5 work:

- Runtime domain separation exists in `src/lib/domains.ts` and is consumed by `src/App.tsx`.
- Public routes are intended for `dayandisli.com`.
- ERP routes are intended for `erp.dayandisli.com`.
- Localhost exposes both route families for development.
- ERP application grouping exists under `/apps` through `src/features/erp/apps/applicationRegistry.ts`.
- CRM and Sales workflows were added in Phase 5, with new Supabase tables for leads, opportunities, tasks, and activities.
- The project builds successfully with `npm run build`.

Main risks before Phase 6:

- Git initially fails normal `git status` because the repository has dubious ownership from Windows user mismatch. A one-command safe-directory override works.
- Build output is large, especially the main JS chunk at about 4.24 MB minified / 1.40 MB gzip.
- `pdfjs-dist` triggers a Vite warning about eval usage.
- Browserslist data is stale.
- Supabase generated types appear incomplete/stale relative to current ERP migrations, causing many application calls to use `as never` casts.
- RLS policies are mostly broad authenticated-user policies, suitable for earlier foundation phases but not fine-grained ERP authorization.
- `/admin/*` still exists and overlaps conceptually with ERP modules.
- Some Phase 6-like database work already exists in a migration named `20260518143000_erp_phase6_workflow_notifications.sql`, so "Phase 6" naming should be clarified before continuing.

## Commands Run

### `npm run build`

Result: passed.

Important output:

- Vite transformed 2741 modules and built successfully.
- Output directory is `dist/erp`.
- Main chunk warning: `assets/index-CLeD2g4Z.js` is about 4,237.65 kB minified and 1,400.23 kB gzip.
- `pdfjs-dist/build/pdf.js` uses eval, which Vite warns may pose security/minification concerns.
- Browserslist/caniuse-lite data is 12 months old.
- Vite warns that some chunks are larger than 500 kB after minification.

### `git status`

Normal command result:

- `git status --short` failed because Git detected dubious ownership.
- Repository path is owned by `DESKTOP-TBUL8HI/Ebru`.
- Current user is `DESKTOP-TBUL8HI/Bediz`.

Non-mutating audit workaround:

- `git -c safe.directory=C:/Users/Bediz/Documents/dayandisli.com status --short`
- Result before creating this report: clean working tree.

Expected state after this report is created:

- `docs/bediz-local-full-folder-audit-before-phase-6.md` should appear as an untracked or modified documentation file depending on Git tracking state.

## Folder Structure Audit

Top-level folders:

- `.agents/`: local agent skills, including Supabase guidance.
- `.github/`: GitHub automation/configuration folder.
- `.git/`: Git repository metadata.
- `dist/`: generated build output. Current Vite config emits to `dist/erp`.
- `docs/`: phase reports, ERP runbooks, architecture documentation, and this audit.
- `node_modules/`: installed npm dependencies.
- `public/`: static public assets, fonts, favicon, robots, OG image, header logo.
- `src/`: application source.
- `supabase/`: Supabase config, migrations, manual SQL, and Edge Functions.

Important top-level files:

- `package.json`: project scripts and dependencies.
- `package-lock.json` and `bun.lockb`: both npm and Bun lockfiles exist.
- `vite.config.ts`: Vite config, build output set to `dist/erp`.
- `tailwind.config.ts`, `postcss.config.js`, `components.json`: styling/UI config.
- `tsconfig*.json`: TypeScript configs.
- `.env`, `.env.local`, `.env.example`: local environment files exist.
- `README.md`: project readme.

Patch artifacts observed:

- `src/full_patch_diff.patch`
- `src/cursor_full.patch`
- `src/cursor_refactor.patch`

These are not source modules but are in `src/`; they may confuse future audits or tooling if not intentionally retained.

## Current Route Architecture

The main route definition is in `src/App.tsx`.

### Public Website Routes

Mounted when `shouldExposePublicRoutes()` is true:

- `/` -> `Index`
- `/hizmetler` -> public services page
- `/teknolojiler` -> public technologies page
- `/urunler` -> public products/content page
- `/sektorler` -> public sectors page
- `/iletisim` -> public contact page
- `/hakkimizda` -> about page
- `/referanslar` -> references page

### Optional Public Shop Routes

Mounted only when public routes are exposed and `SHOP_FEATURE_ENABLED` is true:

- `/shop`
- `/shop/:slug`
- `/cart`
- `/checkout`
- `/checkout/success`

When the shop flag is disabled but public routes are exposed, shop/cart/checkout paths resolve to `NotFound`.

### Login Route

- `/login` renders the ERP login page when ERP routes are exposed.
- On the public domain, `/login` redirects to the ERP base URL through `PublicDomainErpRedirect`.

### ERP Root Routes

Mounted when `shouldExposeErpRoutes()` is true:

- `/apps` -> protected Apps Hub
- `/apps/:appId` -> protected application shell page
- `/admin/*` -> protected legacy admin routes
- `/dashboard` -> protected ERP home page
- `/apps/calculator/*` -> protected legacy calculator redirect
- `/apps/shop-orders` -> protected shop orders, feature-flagged
- `/teklif-sayfasi` -> redirects to `/teklifler/yeni`
- `/erp/*` -> legacy ERP prefix redirect
- `/*` -> protected main `ERPRoutes`

### Main ERP Route Tree

Defined in `src/features/erp/index.tsx`.

Turkish primary routes:

- `/dashboard`
- `/musteriler`
- `/musteriler/yeni`
- `/musteriler/:id`
- `/musteriler/:id/duzenle`
- `/tedarikciler`
- `/tedarikciler/yeni`
- `/tedarikciler/:id`
- `/tedarikciler/:id/duzenle`
- `/teklifler`
- `/teklifler/yeni`
- `/kargo`
- `/siparisler`
- `/siparisler/:id`
- `/satis-faaliyetleri`
- `/finans`
- `/finans/hareketler`
- `/finans/hareketler/yeni`
- `/finans/hareketler/:id`
- `/finans/odemeler`
- `/finans/cekler`
- `/finans/raporlar`
- `/bildirimler`
- `/gorevler`
- `/notlar`
- `/ayarlar`
- `/crm`
- `/paydaslar`

English/technical ERP routes still present:

- `/calculator/*`
- `/stakeholders/:id`
- `/quotations`
- `/sales-orders`
- `/sales-orders/:id`
- `/sales-activities`
- `/production`
- `/work-orders`
- `/work-orders/:id`
- `/routes`
- `/subcontracting`
- `/subcontracting/:id`
- `/inventory`
- `/inventory/:id`
- `/inventory-movements`
- `/purchasing`
- `/purchase-orders`
- `/purchase-orders/:id`
- `/finance`
- `/invoices`
- `/payments`
- `/hr`
- `/time-entries`
- `/logistics`
- `/shipments/:id`
- `/quality`
- `/quality/:id`
- `/maintenance`
- `/documents`
- `/notifications`
- `/reports`
- `/settings`

Fallback:

- unmatched ERP paths render `ErpNotFoundPage`.

## Domain Separation

Domain helpers live in `src/lib/domains.ts`.

Default public base URL:

- `https://dayandisli.com`

Default ERP base URL:

- `https://erp.dayandisli.com`

Local hostnames:

- `localhost`
- `127.0.0.1`
- `::1`

Behavior:

- Public runtime domain exposes public website routes.
- ERP runtime domain exposes ERP routes.
- Localhost exposes both public and ERP routes.
- Public-domain `/login` redirects to the ERP login URL.
- Public-domain unknown/non-public paths fall through to `NotFound`.

Risk:

- Runtime route gating depends on browser hostname and configured `VITE_PUBLIC_BASE_URL` / `VITE_ERP_BASE_URL`.
- Localhost intentionally exposes both route families, so local testing must not be mistaken for production domain behavior.

## ERP `/apps` Architecture

Application registry: `src/features/erp/apps/applicationRegistry.ts`.

Current application groups:

- `website`: Web Sitesi
- `commerce`: E-Ticaret
- `crm`: Müşteri İlişkileri
- `sales`: Satış
- `invoicing`: Faturalama
- `accounting`: Muhasebe
- `expenses`: Gider Yönetimi
- `inventory`: Stok Yönetimi
- `purchasing`: Satın Alma
- `production`: Üretim
- `quality`: Kalite Yönetimi
- `maintenance`: Bakım Yönetimi
- `repair`: Tamir Yönetimi
- `hr`: İnsan Kaynakları
- `reports`: Raporlar
- `settings`: Ayarlar

The registry provides:

- App IDs and titles.
- Turkish descriptions.
- Routes.
- Lucide icons.
- Permission keys.
- Module-level route links and permission keys.
- Module status markers such as `active` and `planned`.

The `/apps/:appId` shell renders app modules and quick links. It does not appear to enforce permission keys yet; the keys are present as metadata/foundation.

## CRM and Sales Workflow Audit

Phase 5 CRM/Sales work is present.

Primary CRM screen:

- `src/features/erp/crm/CRMOperationsPage.tsx`
- Route: `/crm`

CRM capabilities from code/docs:

- Leads (`crm_leads`)
- Opportunities (`crm_opportunities`)
- Tasks (`crm_tasks`)
- Activities (`crm_activities`)
- Firm/stakeholder reuse through `stakeholders`
- Lead to opportunity conversion through `convertLeadToOpportunity`
- Status updates for leads, opportunities, and tasks
- Activity/note recording

Primary Sales screens:

- `src/features/erp/quotations/ERPQuotationsPage.tsx`
- `src/features/erp/sales/SalesOrdersPage.tsx`
- `src/features/erp/sales/SalesActivitiesPage.tsx`

Sales workflow foundation:

- Quotation list and creation
- Quotation to sales order conversion
- Sales order status updates
- Sales order to work order conversion
- Sales activity capture linked by flexible related entity fields

Prepared workflow:

```text
Lead -> Opportunity -> Quotation -> Sales Order -> Work Order
```

Implemented:

- Lead -> Opportunity
- Quotation -> Sales Order
- Sales Order -> Work Order

Not fully implemented:

- Opportunity -> Quotation automatic creation/prefill.
- Dedicated lead and opportunity detail pages.
- Embedded activity timelines across all entity detail views.
- Strong related-record pickers for task/activity forms.

## Supabase Migrations Audit

Migration files present:

- `20251208092932_b7d45e49-989a-4ea1-a451-45de4f44dffd.sql`
- `20260517110000_admin_users_auth.sql`
- `20260517153000_erp_core_schema.sql`
- `20260517230000_erp_phase2_phase3_readiness.sql`
- `20260518093000_erp_phase5_audit_purchasing.sql`
- `20260518143000_erp_phase6_workflow_notifications.sql`
- `20260601120000_crm_sales_workflows.sql`

Manual SQL files present:

- `supabase/manual/erp_core_schema.sql`
- `supabase/manual/erp_customer_supplier_finance_schema.sql`
- `supabase/manual/customer_full_erp_sync.sql`

Seed file:

- `supabase/seed_erp_mock.sql`

### Core/Public Commerce Migration

The earliest large migration creates:

- `settings`
- `allowed_emails`
- `products`
- `product_images`
- `orders`
- `order_items`
- `order_counter`

It also enables RLS and creates policies. Some policies allow public reads/inserts for commerce use cases, such as product visibility and order submission.

### Admin Auth Migration

Creates:

- `admin_users`

Used by:

- `Login`
- `ProtectedRoute`
- Admin/ERP access checks

### ERP Core Migration

Creates foundational ERP tables:

- `erp_users`
- `stakeholders`
- `erp_quotation_links`
- `sales_orders`
- `sales_order_items`
- `machines`
- `production_routes`
- `production_route_steps`
- `work_orders`
- `work_order_operations`
- `subcontracting_jobs`
- `documents`
- `inventory_items`
- `inventory_movements`
- `measuring_tools`
- `financial_accounts`
- `invoices`
- `payments`
- `employees`
- `employee_time_entries`
- `employee_assets`
- `shipments`
- `shipment_items`
- `quality_reports`
- `quality_measurements`
- `maintenance_tasks`
- `erp_number_sequences`

It also adds update triggers, sequence support, and broad authenticated RLS policies.

### Phase 2/3 Readiness Migration

Extends readiness around ERP tables and RLS. It appears additive and defensive.

### Phase 5 Audit/Purchasing Migration

Creates:

- `erp_audit_logs`
- `purchase_orders`
- `purchase_order_items`

Adds RLS policies for authenticated access.

### Phase 6 Workflow Notifications Migration

Despite the current request being "before Phase 6", a migration already named Phase 6 exists:

- `20260518143000_erp_phase6_workflow_notifications.sql`

It adds:

- workflow fields on subcontracting and quality tables
- `erp_notifications`
- workflow triggers for work order operations, quality reports, subcontracting jobs, and shipments
- authenticated RLS policies for notifications

Recommendation:

- Clarify whether this migration is already applied in production and whether the next phase is a continuation of Phase 6 or a new "Phase 6 UI/detail integration" phase.

### CRM/Sales Workflows Migration

Creates:

- `crm_leads`
- `crm_opportunities`
- `crm_tasks`
- `crm_activities`

Adds:

- CRM sequence keys
- indexes
- update triggers
- authenticated-wide RLS policies

Risk:

- Policies are broad: authenticated users can read/write CRM tables. This matches a foundation phase but is not final role-based ERP security.

## Supabase Types and API Usage

Generated type file:

- `src/integrations/supabase/types.ts`

Observation:

- The visible generated types include early tables such as `allowed_emails`, `orders`, `products`, etc.
- Current ERP API usage touches many newer ERP tables through `as never` casts.
- This strongly suggests generated Supabase types are not fully synchronized with all current ERP migrations.

Main Supabase client usage:

- `src/integrations/supabase/client.ts`
- `src/lib/supabase.ts`
- `src/lib/supabaseClient.ts`
- `src/features/erp/shared/erpApi.ts`
- `src/features/shop/api.ts`
- `src/features/admin/adminData.ts`
- `src/services/partiesService.ts`
- `src/services/financeService.ts`
- `src/services/customerFullService.ts`
- quotation components/hooks
- contact form and Supabase functions

Important RPC/functions used:

- `next_erp_number`
- `generate_order_number`
- `increment_monthly_counter`
- `increment_counter`
- Supabase Edge Function `send-quotation-email`
- Supabase Edge Function `send-contact-email`

Edge Functions present:

- `supabase/functions/send-contact-email/index.ts`
- `supabase/functions/send-quotation-email/index.ts`
- `supabase/functions/parasut-sync/index.ts`
- `supabase/functions/parasut-sync-run/index.ts`

Potential API risks:

- Multiple Supabase client wrappers may duplicate configuration responsibilities.
- Heavy use of `as never` weakens TypeScript safety for table names and payloads.
- Some services reference legacy tables such as `parties`, `financial_transactions`, `payment_documents`, `customers_full`, and `customer_profile`, which are not part of the primary ERP core table list in `getERPDatabaseStatus`.

## Turkish UI Status

The ERP UI is substantially Turkish:

- App registry titles/descriptions are Turkish.
- Primary ERP navigation includes Turkish route labels and pages.
- CRM/Sales Phase 5 screens use Turkish concepts such as `Potansiyel Müşteriler`, `Fırsatlar`, `Görevler`, `Etkinlikler`, `Teklifler`, `Siparişler`.
- Admin labels have been partially converted to Turkish.
- Public website localization files exist for `tr`, `en`, and `de`.

Remaining mixed-language areas:

- Several routes are still English aliases or technical nouns: `/sales-orders`, `/work-orders`, `/inventory`, `/purchase-orders`, `/quality`, `/maintenance`, `/reports`, `/settings`, etc.
- Internal TypeScript names are English, which is normal, but some visible labels may still be inherited from older pages.
- Some user-facing fallback/error text may still be mixed, especially in older quotation/shop/admin surfaces.

Recommendation:

- Continue Turkish UI audit in Phase 6, prioritizing visible labels and route-facing navigation rather than internal code identifiers.

## Legacy `/admin` Dependency Audit

Admin route tree:

- `src/features/admin/index.tsx`

Routes:

- `/admin`
- `/admin/urunler`
- `/admin/siparisler`
- `/admin/teklifler`
- `/admin/medya`
- `/admin/cariler`
- `/admin/uretim`
- `/admin/stok`
- `/admin/kalite`
- `/admin/finans`
- `/admin/raporlar`
- `/admin/ayarlar`
- `/admin/sql-editor`

Status:

- `/admin/*` is protected and only mounted when ERP routes are exposed.
- Admin still handles product/order/quotation table management and summary pages.
- ERP `/apps` registry links still point some modules to `/admin/*`, especially website/commerce/admin settings areas.

Risk:

- Admin overlaps with ERP modules and could confuse users if both are visible as first-class experiences.
- Admin table editing is generic and less workflow-oriented than ERP modules.
- `/admin/sql-editor` is described as safe notes rather than direct SQL execution, but the route name may imply direct database control.

Recommendation:

- Treat `/admin/*` as legacy/support tooling.
- During Phase 6, avoid adding new workflows under `/admin`; add them under ERP modules instead.
- Gradually replace app-registry `/admin/*` links with ERP-native routes as those screens mature.

## Build Status

Build command:

```bash
npm run build
```

Result:

- Passed.

Output:

- `dist/erp/index.html`
- hashed assets under `dist/erp/assets`

Warnings:

- Stale Browserslist/caniuse-lite data.
- `pdfjs-dist` eval warning.
- Large chunk warning, especially main app bundle.

Build configuration:

- `vite.config.ts` sets `build.outDir = "dist/erp"`.
- `manualChunks` is explicitly `undefined`, so code splitting is not currently tuned.

## Risks Before Phase 6

High priority:

- Confirm actual Supabase production migration state before building on CRM/Sales/notification tables.
- Regenerate Supabase types after applying migrations, or TypeScript safety will remain weak around ERP tables.
- Clarify Phase 6 scope because a Phase 6 workflow notification migration already exists.
- Resolve or document Git dubious ownership, because normal Git commands fail for the current user.

Medium priority:

- Reduce large bundle risk through route-level lazy loading or manual chunks, especially PDF/quotation/calculator/admin/ERP modules.
- Review `pdfjs-dist` usage and whether it should be isolated into a lazy-loaded path.
- Decide whether `/admin` is legacy-only and how it should appear in navigation.
- Tighten RLS/authorization beyond broad authenticated policies before wider ERP user rollout.

Lower priority:

- Remove or relocate patch artifact files from `src/` if they are historical leftovers.
- Update Browserslist data.
- Consolidate Supabase client wrappers if duplication is accidental.
- Continue Turkish UI pass on English route aliases and legacy labels.

## Recommended Phase 6 Entry Criteria

Before implementing new Phase 6 features:

1. Confirm which migrations are applied in Supabase.
2. Regenerate `src/integrations/supabase/types.ts` from the current database schema.
3. Decide whether the existing `erp_phase6_workflow_notifications` migration is part of completed work or the start of the upcoming phase.
4. Keep new user-facing workflows under `src/features/erp/*`, not `/admin`, unless intentionally maintaining legacy admin tooling.
5. For CRM/Sales detail work, build on the existing path:

```text
Lead -> Opportunity -> Quotation -> Sales Order -> Work Order
```

Best next Phase 6 scope based on current repo state:

- Lead detail page.
- Opportunity detail page.
- Shared activity timeline component.
- Opportunity -> quotation prefill action.
- Entity picker improvements for CRM tasks and activities.
- Turkish UI polish for visible CRM/Sales/ERP labels.

