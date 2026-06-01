# Phase 0 Domain Route Architecture Report

Date: 2026-06-01  
Commit message: `Phase 0 domain route architecture foundation`

## Objective

Establish the domain and route foundation before expanding the ERP platform.

Target architecture:

- `dayandisli.com` serves the public website only.
- `erp.dayandisli.com` serves the ERP platform only.
- Supabase remains the only backend/data source.
- No business data should be stored in frontend code or FTP, except media uploads.
- Legacy ERP/admin code is preserved for now and marked for later cleanup.

## Current Route Inventory

### Public Website Routes

These routes are public and should remain on `dayandisli.com`:

| Route | Component | Notes |
| --- | --- | --- |
| `/` | `src/pages/Index.tsx` | Public homepage. |
| `/hizmetler` | `src/pages/site/Hizmetler.tsx` | Public services page. |
| `/teknolojiler` | `src/pages/site/Teknolojiler.tsx` | Public technology page. |
| `/urunler` | `src/pages/site/Urunler.tsx` | Public product/content page. |
| `/sektorler` | `src/pages/site/Sektorler.tsx` | Public sectors page. |
| `/iletisim` | `src/pages/site/Iletisim.tsx` | Public contact page. |
| `/hakkimizda` | `src/pages/Hakkimizda.tsx` | Public about page. |
| `/referanslar` | `src/pages/Referanslar.tsx` | Public references page. |

### Public Commerce Routes

These routes are public only when `SHOP_FEATURE_ENABLED` is enabled:

| Route | Component | Notes |
| --- | --- | --- |
| `/shop` | `ShopPage` | Public shop catalog. |
| `/shop/:slug` | `ProductDetailPage` | Public product detail. |
| `/cart` | `CartPage` | Public cart flow. |
| `/checkout` | `CheckoutPage` | Public checkout flow. |
| `/checkout/success` | `CheckoutSuccessPage` | Public checkout success page. |

If shop is disabled, these routes resolve to `NotFound`.

### ERP Platform Routes

These routes are ERP-only and should be reachable only on `erp.dayandisli.com`:

| Route | Component | Notes |
| --- | --- | --- |
| `/login` | `Login` | ERP login route. Public domain redirects this to ERP domain. |
| `/apps` | `Apps` | Post-login landing route. Currently redirects to `/dashboard`. |
| `/dashboard` | `ERPHomePage` | ERP dashboard. |
| `/apps/calculator/*` | `LegacyCalculatorRedirect` | Legacy redirect to `/calculator/*`. |
| `/apps/shop-orders` | `ShopOrdersPage` | Protected shop order management, feature-flagged. |
| `/teklif-sayfasi` | Redirect | Legacy redirect to `/teklifler/yeni`. |
| `/erp/*` | `LegacyErpRedirect` | Legacy `/erp` prefix redirect. |
| `/*` | `ERPRoutes` | Main ERP route tree on ERP domain. |

### Main ERP Route Tree

`src/features/erp/index.tsx` registers these protected ERP routes:

| Route | Purpose |
| --- | --- |
| `/dashboard` | ERP dashboard. |
| `/musteriler`, `/musteriler/yeni`, `/musteriler/:id`, `/musteriler/:id/duzenle` | Customer records. |
| `/tedarikciler`, `/tedarikciler/yeni`, `/tedarikciler/:id`, `/tedarikciler/:id/duzenle` | Supplier records. |
| `/teklifler`, `/teklifler/yeni` | Quotations and quote creation. |
| `/calculator/*` | Gear calculation tools. |
| `/kargo` | Cargo management. |
| `/siparisler`, `/siparisler/:id` | Sales orders. |
| `/finans`, `/finans/hareketler`, `/finans/hareketler/yeni`, `/finans/hareketler/:id`, `/finans/odemeler`, `/finans/cekler`, `/finans/raporlar` | Finance. |
| `/bildirimler` | Notifications. |
| `/gorevler` | Existing placeholder task route. |
| `/notlar` | Existing placeholder notes route. |
| `/ayarlar` | ERP settings. |
| `/crm`, `/stakeholders/:id` | Stakeholder CRM. |
| `/quotations` | Legacy English alias for quotations. |
| `/sales-orders`, `/sales-orders/:id` | Legacy English alias for sales orders. |
| `/production` | Production overview. |
| `/work-orders`, `/work-orders/:id` | Work orders. |
| `/routes` | Production routes. |
| `/subcontracting`, `/subcontracting/:id` | Subcontracting. |
| `/inventory`, `/inventory/:id`, `/inventory-movements` | Inventory. |
| `/purchasing`, `/purchase-orders`, `/purchase-orders/:id` | Purchasing. |
| `/finance`, `/invoices`, `/payments` | Legacy English finance aliases. |
| `/hr`, `/time-entries` | HR and time entries. |
| `/logistics`, `/shipments/:id` | Logistics and shipment details. |
| `/quality`, `/quality/:id` | Quality. |
| `/maintenance` | Maintenance. |
| `/documents` | Documents. |
| `/notifications` | Legacy English notifications alias. |
| `/reports` | Reports. |
| `/settings` | Legacy English settings alias. |

### Admin Routes Preserved

The recently added admin route tree is preserved but should be treated as ERP-domain-only because it is protected and mounted only when ERP routes are exposed:

| Route | Purpose |
| --- | --- |
| `/admin` | Admin overview. |
| `/admin/urunler` | Product catalog management. |
| `/admin/teklifler` | Quotation list. |
| `/admin/siparisler` | Shop order list/status. |
| `/admin/medya` | Media guidance page. |
| `/admin/cariler` | Stakeholder summary. |
| `/admin/uretim` | Production summary. |
| `/admin/stok` | Inventory/purchasing summary. |
| `/admin/kalite` | Quality/maintenance summary. |
| `/admin/finans` | Finance summary. |
| `/admin/raporlar` | Reports summary. |
| `/admin/ayarlar` | Admin settings. |
| `/admin/sql-editor` | Safe SQL notes page, not direct SQL execution. |

## Public vs ERP Route Mapping

| Domain | Routes Exposed | Auth Required |
| --- | --- | --- |
| `dayandisli.com` | Public website routes and public shop routes only. | No. |
| `erp.dayandisli.com` | `/login`, `/apps`, `/dashboard`, `/admin/*`, and all ERP routes. | Yes, except `/login`. |
| `localhost`, `127.0.0.1`, `::1` | Both public and ERP routes for migration/testing. | ERP routes still require auth. |

## Domain Separation Strategy

Route exposure now uses runtime hostname checks in `src/lib/domains.ts`:

- `shouldExposePublicRoutes()`
- `shouldExposeErpRoutes()`
- `buildErpUrl()`

`src/App.tsx` now uses those helpers instead of relying only on `VITE_APP_TARGET`.

Behavior:

- On `dayandisli.com`, public routes are mounted and ERP routes are not mounted.
- On `erp.dayandisli.com`, ERP routes are mounted and public website routes are not mounted.
- On localhost, both route groups are mounted to preserve migration/testing access.
- `/login` on the public domain redirects to `https://erp.dayandisli.com/login`.
- Any non-public route on the public domain resolves to `NotFound`, except `/login`, which redirects to the ERP domain.

## Authentication Flow Analysis

Current authentication source:

- Supabase Auth.
- Active admin check through `admin_users`.
- `ProtectedRoute` remains the route guard.

Rules after Phase 0:

- Visiting an ERP route on `erp.dayandisli.com` without a valid session reaches `ProtectedRoute`.
- `ProtectedRoute` redirects unauthenticated users to `/login`.
- `/login` is only mounted as a real login page on the ERP domain and localhost.
- Successful login now always redirects to `/apps`.
- `/apps` currently redirects to `/dashboard`, preserving existing behavior while meeting the requested post-login target.

Important note:

- `ProtectedRoute` still stores `auth_redirect_path`, but `Login` intentionally ignores it for successful login and sends users to `/apps`.

## Files Modified

- `src/App.tsx`
  - Added runtime domain route exposure.
  - Prevented ERP routes from mounting on public domain.
  - Redirected public-domain `/login` to ERP-domain `/login`.
  - Preserved localhost access to both route groups.
- `src/lib/domains.ts`
  - Added domain route exposure helpers.
  - Added ERP URL builder.
- `src/pages/Login.tsx`
  - Changed successful login redirect target to `/apps`.
- `src/config/erpModules.ts`
  - Changed user-facing `Dashboard` label to `Kontrol Paneli`.
  - Changed user-facing `Calculator` label to `Hesaplama`.
- `src/features/erp/index.tsx`
  - Changed `DAYAN Calculator` page title to `DAYAN Hesaplama`.
- `src/features/admin/AdminLayout.tsx`
  - Changed visible admin labels to Turkish where touched.
- `src/features/admin/AdminSqlEditor.tsx`
  - Changed visible SQL editor labels to Turkish.
- `src/features/admin/adminData.ts`
  - Changed `Shop Siparişleri` to `Mağaza Siparişleri`.
  - Added Turkish display labels for order status values.
- `src/features/admin/AdminTablePage.tsx`
  - Displays select options and table values with Turkish labels when configured.

## Validation

### Build

Command:

```bash
npm run build
```

Result:

- Passed.

Warnings:

- Browserslist/caniuse-lite data is old.
- `pdfjs-dist` uses `eval`, which Vite warns about.
- Some chunks are larger than 500 kB after minification.

### Route Behavior

Verified by code inspection and build:

- Public routes are only mounted when `shouldExposePublicRoutes()` is true.
- ERP routes are only mounted when `shouldExposeErpRoutes()` is true.
- Public-domain `/login` uses `PublicDomainErpRedirect`.
- Public-domain ERP paths fall through to `NotFound`.
- ERP-domain wildcard is protected by `ProtectedRoute`.

Browser automation note:

- The in-app browser backend was unavailable in this session.
- A Playwright fallback was attempted, but Playwright is not installed in the repo.
- Therefore, route behavior was not visually verified in a real browser during this pass.

### Authentication Behavior

Verified by code inspection and build:

- ERP routes remain wrapped with `ProtectedRoute`.
- Unauthenticated ERP route access redirects to `/login`.
- Successful login redirects to `/apps`.
- Public routes remain outside `ProtectedRoute`.

## Risks Discovered

### Vite Build Output

`vite.config.ts` currently builds to `dist/erp` by default. The route split is now runtime-safe, but deployment should still explicitly separate public and ERP hosting outputs or configure each domain to serve the intended build artifact.

Recommendation:

- In the next phase, formalize build commands for public and ERP deployments.

### Public Business Data in Frontend Code

The target architecture says no business data should be stored in frontend code or FTP, except media uploads.

Current risk:

- Public site content, product/service descriptions, sector copy, and some assets are still code/static-file driven.

Recommendation:

- Move editable business content into Supabase-backed content tables in a later phase.

### Legacy English ERP Aliases

The ERP route tree still contains English route aliases such as:

- `/quotations`
- `/sales-orders`
- `/production`
- `/work-orders`
- `/inventory`
- `/finance`
- `/settings`

These are route paths, not visible labels. They are preserved for compatibility and should be reviewed for future removal or redirect-only status.

### Existing Placeholder ERP Pages

Existing placeholder pages remain:

- `/gorevler`
- `/notlar`

They were not created in this phase. They should be reviewed in a future cleanup pass.

### Full Turkish UI Audit Not Complete

Several obvious English ERP labels were changed in this pass. A complete string audit across every ERP component was not completed because Phase 0 was focused on domain and route architecture.

Recommendation:

- Run a dedicated Turkish UI text audit before production ERP launch.

## Legacy Components Identified

Keep for now, mark for future cleanup:

- `LegacyErpRedirect` in `src/App.tsx`
  - Keeps old `/erp/*` paths working on the ERP domain.
- `LegacyCalculatorRedirect` in `src/App.tsx`
  - Keeps old `/apps/calculator/*` paths working.
- English route aliases in `src/features/erp/index.tsx`
  - Preserved for migration safety.
- `src/pages/Apps.tsx`
  - Currently redirects `/apps` to `/dashboard`.
  - Kept because login now targets `/apps`.
- Recently added `src/features/admin/*`
  - Preserved but ERP-domain-only.
  - Should be evaluated later against the final ERP information architecture.

## Recommended Next Phase

Phase 1 should focus on deployment/build separation and content data ownership:

1. Add explicit public and ERP build commands.
2. Confirm hosting config:
   - `dayandisli.com` serves public website only.
   - `erp.dayandisli.com` serves ERP app only.
3. Add automated route tests with browser tooling installed.
4. Audit all ERP visible text for Turkish-only UI.
5. Move public site business content into Supabase tables.
6. Define redirect/deprecation plan for legacy English route aliases.
7. Review Supabase RLS policies for all ERP/admin tables.
