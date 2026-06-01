# Phase 2 Application Shells and Navigation Report

Date: 2026-06-01  
Commit message: `Phase 2 application shells and navigation`

## Objective

Transform the ERP applications hub from a card launcher into the foundation of a real application ecosystem. Each application now has a dedicated shell route with consistent header, breadcrumb, module navigation, content area, and permission metadata preparation.

## Application Shell Architecture

The application shell architecture is registry-driven.

Core files:

- `src/features/erp/apps/applicationRegistry.ts`
- `src/features/erp/apps/ApplicationShellPage.tsx`
- `src/pages/Apps.tsx`
- `src/App.tsx`

### Registry Model

Each application has:

- `id`
- `title`
- `description`
- `route`
- `icon`
- `permissionKey`
- `modules`

Each module has:

- `title`
- `description`
- `route`
- `permissionKey`
- `status`

The shell page reads `:appId`, finds the application in the registry, and renders the same page grammar for every application.

### Shared Shell UI

Each application shell includes:

- Application header.
- Breadcrumb support: `Uygulamalar > selected application`.
- Back link to `/apps`.
- Application icon, title, description.
- Permission readiness badge.
- Left module navigation area.
- Main module card content area.
- Responsive layout:
  - Single-column on mobile.
  - Sidebar + content grid on larger screens.

## Route Map

The applications hub remains:

| Route | Purpose |
| --- | --- |
| `/apps` | Main application launcher. |

Dedicated application shell routes:

| Application | Shell Route |
| --- | --- |
| Web Sitesi | `/apps/website` |
| E-Ticaret | `/apps/commerce` |
| Müşteri İlişkileri | `/apps/crm` |
| Satış | `/apps/sales` |
| Faturalama | `/apps/invoicing` |
| Muhasebe | `/apps/accounting` |
| Gider Yönetimi | `/apps/expenses` |
| Stok Yönetimi | `/apps/inventory` |
| Satın Alma | `/apps/purchasing` |
| Üretim | `/apps/production` |
| Kalite Yönetimi | `/apps/quality` |
| Bakım Yönetimi | `/apps/maintenance` |
| Tamir Yönetimi | `/apps/repair` |
| İnsan Kaynakları | `/apps/hr` |
| Raporlar | `/apps/reports` |
| Ayarlar | `/apps/settings` |

Routing change:

- `src/App.tsx` now mounts `/apps/:appId` with `ApplicationShellPage`.
- The route is protected by the existing `ProtectedRoute`.
- Unknown app IDs redirect back to `/apps`.

## Reused Existing Modules

No duplicate business logic or fake APIs were created. Shell modules point to existing ERP/admin functionality.

Examples:

| Application | Reused Routes |
| --- | --- |
| Web Sitesi | `/admin`, `/admin/urunler`, `/admin/medya`, `/admin/ayarlar` |
| E-Ticaret | `/admin/siparisler`, `/admin/urunler`, `/crm` |
| Müşteri İlişkileri | `/crm`, `/musteriler`, `/tedarikciler` |
| Satış | `/teklifler`, `/teklifler/yeni`, `/siparisler` |
| Faturalama | `/invoices`, `/payments`, `/finans` |
| Muhasebe | `/finans`, `/finans/hareketler`, `/finans/cekler`, `/finans/raporlar` |
| Gider Yönetimi | `/payments`, `/finans/hareketler/yeni`, `/reports` |
| Stok Yönetimi | `/inventory`, `/inventory-movements`, `/purchase-orders` |
| Satın Alma | `/purchasing`, `/purchase-orders`, `/tedarikciler` |
| Üretim | `/production`, `/work-orders`, `/routes`, `/subcontracting`, `/calculator` |
| Kalite Yönetimi | `/quality`, `/work-orders` |
| Bakım Yönetimi | `/maintenance`, `/routes` |
| Tamir Yönetimi | `/work-orders`, `/maintenance`, `/quality` |
| İnsan Kaynakları | `/hr`, `/time-entries` |
| Raporlar | `/reports`, `/finans/raporlar`, `/quality` |
| Ayarlar | `/settings`, `/admin/ayarlar`, `/dashboard` |

Planned modules are represented as structure only and still route to the closest existing safe area. They do not create new backend logic.

## Navigation Foundation

User flow:

```text
/apps
→ selected application card
→ /apps/:appId
→ module link
→ existing ERP/admin page
```

Additional navigation update:

- `ERPTopBar` now includes a visible `Uygulamalar` button for returning to the application hub.
- The brand area links to `/apps`.

## Turkish UI Audit Status

Continued visible UI text cleanup in Phase 2:

- Application shell UI is fully Turkish.
- App hub remains Turkish.
- `DAYAN Calculator` visible production link changed to `DAYAN Hesaplama`.
- ERP missing-table message changed from `migration` wording to `geçiş dosyası`.
- App-shell status labels use `Aktif` and `Planlandı`.

Remaining English UI items:

- Some technical route paths remain English, for compatibility:
  - `/production`
  - `/work-orders`
  - `/inventory`
  - `/purchasing`
  - `/settings`
  - and similar aliases.
- Some code identifiers contain English terms, which is allowed.
- A full deep-screen text audit is still recommended because many ERP modules predate this phase.

## Future Expansion Strategy

Future application expansion should be registry-first:

1. Add a new module entry to `applicationRegistry.ts`.
2. Point `route` to an existing ERP route or a future real module route.
3. Add `permissionKey` immediately, even before filtering exists.
4. Only implement business screens when real data models and Supabase access rules exist.

Future role filtering can be added without route restructuring:

```ts
const visibleModules = app.modules.filter((module) =>
  canCurrentUserView(module.permissionKey)
);
```

Important:

- UI filtering is not authorization.
- Supabase RLS remains the final data-access authority.

## Files Modified

Added:

- `src/features/erp/apps/ApplicationShellPage.tsx`
- `docs/phase-2-application-shells-report.md`

Modified:

- `src/App.tsx`
- `src/features/erp/apps/applicationRegistry.ts`
- `src/features/erp/layout/ERPTopBar.tsx`
- `src/features/erp/production/ProductionPage.tsx`
- `src/features/erp/shared/erpApi.ts`

## Risks

### Planned Modules Are Structural

Some modules such as SEO, forms, categories, activities, and opportunities are represented as planned shell modules only. They point to existing safe routes for now.

Risk:

- Users may expect complete business features behind planned cards.

Mitigation:

- The shell clearly labels planned modules as `Planlandı`.

### Existing Routes Still Have Legacy Names

The visible shell is Turkish, but many existing route paths are English.

Risk:

- URL naming is not fully aligned with Turkish terminology.

Mitigation:

- Keep legacy paths until redirect strategy is defined.

### Admin Shell Is Still Separate

Website and commerce apps currently reuse `/admin/*`, which has a different shell from the ERP application shell.

Risk:

- User experience shifts when entering admin-backed website or commerce pages.

Mitigation:

- Future phase can unify admin-backed pages into ERP shell routes once final ownership is decided.

## Recommendations

Next phase should focus on navigation unification and role readiness:

1. Add role-aware filtering for application cards and module links.
2. Align ERP sidebar navigation with the application registry.
3. Decide which admin routes should be absorbed into ERP app shells.
4. Add a complete Turkish UI audit for all deep ERP screens.
5. Add route-level tests for `/apps`, `/apps/:appId`, protected redirects, and unknown application IDs.

## Validation

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
