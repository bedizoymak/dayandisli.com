# Phase 3 Navigation Unification and Turkish UI Audit Report

## Objective

Phase 3 keeps `/apps` as the ERP home page, reduces the visual separation between legacy admin screens and the ERP application hub, and continues the Turkish UI audit without adding new business features or role filtering.

## Navigation Changes

- `/apps` remains the primary ERP entry page.
- Application shell pages at `/apps/:appId` now include:
  - breadcrumb back to `Uygulamalar`
  - `Uygulamalara Dön` action
  - `Çıkış Yap` action that signs out through Supabase Auth and redirects to `/login`
- The legacy admin layout no longer presents itself as a separate management product:
  - sidebar brand target changed from `/admin` to `/apps`
  - sidebar eyebrow changed from `Yönetim` to `ERP`
  - top action changed from `ERP`/`/dashboard` to `Uygulamalar`/`/apps`
- Legacy admin dashboard shortcut links now prefer ERP-native routes where safe:
  - quotations: `/teklifler`
  - suppliers: `/tedarikciler`
  - inventory: `/inventory`
  - employees: `/hr`
  - settings/database status: `/ayarlar`
- Application registry module links were reduced away from `/admin` where existing ERP routes are available:
  - Web Sitesi genel bakış uses `/dashboard`
  - Web Sitesi medya uses `/documents`
  - Web Sitesi SEO uses `/ayarlar`
  - Ayarlar yönetim ayarları uses `/ayarlar`

## Turkish UI Changes

- Application shell logout text added as `Çıkış Yap`.
- Public fallback 404 text changed from English to Turkish:
  - `Sayfa bulunamadı`
  - `Ana Sayfaya Dön`
- ERP document screens changed visible English terms:
  - `metadata` -> `kayıt`
  - `storage path` -> `depolama yolu`
- ERP settings role display now uses Turkish labels:
  - `admin` -> `Yönetici`
  - `planner` -> `Planlama`
  - `operator` -> `Operatör`
  - `finance` -> `Finans`
  - `viewer` -> `Görüntüleme`
- ERP settings permission notice now uses Turkish role terminology instead of raw role keys.
- Legacy admin finance summary now displays payment type labels through ERP Turkish status labels.
- Legacy admin top action changed to `Uygulamalar`.

## Remaining English UI List

The following items remain intentionally documented for later cleanup:

- Technical route paths remain English in several places, such as `/inventory`, `/production`, `/purchase-orders`, `/documents`, `/settings`, and `/reports`. These are URL contracts and not visible labels.
- Database/table/role keys may still appear inside error details returned from Supabase or RLS failures. These are backend-originated technical messages and were not rewritten in frontend code.
- Product catalog technical fields such as `SKU`, `Slug`, `CAD`, `CAM`, and `PDF` remain as accepted industry or file-format terms.
- Legacy admin component/type names still contain `Admin` in code. These are implementation names, not visible UI labels.
- The legacy SQL editor remains visible as `SQL Düzenleyici` because it is a technical ERP administration tool.

## Legacy `/admin` Dependency List

The following `/admin` dependencies remain because removing them now would risk breaking existing functionality:

- `src/App.tsx` still mounts `AdminRoutes` at `/admin/*`.
- `src/features/admin/index.tsx` still owns legacy routes for:
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
- `src/features/admin/AdminLayout.tsx` still uses `/admin` links inside its sidebar because those screens are the current legacy admin route owners.
- `src/features/erp/apps/applicationRegistry.ts` still points Web Sitesi and E-Ticaret product/order catalog modules at `/admin/urunler` and `/admin/siparisler` because ERP-native replacement screens were not introduced in this phase.
- `src/features/admin/AdminSummaryPages.tsx` still links product media to `/admin/urunler` because product image management currently lives there.

## Files Modified

- `src/features/admin/AdminDashboard.tsx`
- `src/features/admin/AdminLayout.tsx`
- `src/features/admin/AdminSummaryPages.tsx`
- `src/features/erp/apps/ApplicationShellPage.tsx`
- `src/features/erp/apps/applicationRegistry.ts`
- `src/features/erp/documents/DocumentLinksPanel.tsx`
- `src/features/erp/documents/DocumentsPage.tsx`
- `src/features/erp/settings/ERPSettingsPage.tsx`
- `src/pages/NotFound.tsx`
- `docs/phase-3-navigation-turkish-ui-audit-report.md`

## Risks

- The `/admin` route family remains active by design. It is less visually separate, but still structurally legacy.
- Some user-visible backend errors can still contain English because they are returned directly from Supabase or browser APIs.
- A full Turkish audit of every deep workflow should continue in later phases because ERP modules are broad and include older pages, finance pages, quotation screens, calculator screens, and public fallback surfaces.
- Route renaming was avoided to preserve compatibility; future route aliases or migrations should be planned before removing legacy paths.

## Next Phase Recommendation

Phase 4 should introduce ERP-native replacements or wrappers for the remaining `/admin` product, order, media, and SQL/settings screens. After those replacements exist, `/admin` can become a compatibility redirect layer and then be removed in a later cleanup phase.

## Validation

- `npm run build` must pass before commit.
