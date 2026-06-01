# Phase 1 Applications Hub Report

Date: 2026-06-01  
Commit message: `Phase 1 applications hub`

## Objective

Create the primary ERP entry experience. Every authenticated ERP user should enter through `/apps`, see a Turkish application hub, and navigate into existing ERP modules without duplicating business logic or creating fake APIs.

## Application Registry Structure

The application catalog is defined in:

- `src/features/erp/apps/applicationRegistry.ts`

Registry type:

```ts
export type ErpApplication = {
  id: ErpApplicationId;
  title: string;
  description: string;
  route: string;
  icon: LucideIcon;
  permissionKey?: string;
};
```

The `permissionKey` field is present for future role-based visibility, but no filtering is applied in this phase.

Initial application catalog:

| Application | Route | Permission Key |
| --- | --- | --- |
| Web Sitesi | `/admin` | `website.view` |
| E-Ticaret | `/admin/siparisler` | `commerce.view` |
| Müşteri İlişkileri | `/crm` | `crm.view` |
| Satış | `/teklifler` | `sales.view` |
| Faturalama | `/invoices` | `invoicing.view` |
| Muhasebe | `/finans` | `accounting.view` |
| Gider Yönetimi | `/payments` | `expenses.view` |
| Stok Yönetimi | `/inventory` | `inventory.view` |
| Satın Alma | `/purchasing` | `purchasing.view` |
| Üretim | `/production` | `production.view` |
| Kalite Yönetimi | `/quality` | `quality.view` |
| Bakım Yönetimi | `/maintenance` | `maintenance.view` |
| Tamir Yönetimi | `/work-orders` | `repair.view` |
| İnsan Kaynakları | `/hr` | `hr.view` |
| Raporlar | `/reports` | `reports.view` |
| Ayarlar | `/settings` | `settings.view` |

## Applications Hub

`/apps` is now a real ERP home page instead of a redirect.

Implemented in:

- `src/pages/Apps.tsx`

Experience:

- Odoo-inspired card grid.
- Mobile-friendly two-column layout, expanding on larger screens.
- Fast-loading static registry; no backend request is needed to render the hub.
- Each card includes:
  - icon
  - title
  - description
  - route
  - future permission metadata in the registry
- Header includes Dayan Dişli branding and a Turkish logout button.

## Routing Changes

Modified:

- `src/pages/Apps.tsx`
- `src/features/erp/layout/ERPTopBar.tsx`

Routing behavior:

- `/apps` displays the application hub.
- Top bar brand link now routes to `/apps`.
- Application cards reuse existing ERP/admin routes where possible.
- No new ERP modules were created.
- No fake backend APIs were introduced.

Existing Phase 0 routing remains in place:

- ERP routes are exposed only on `erp.dayandisli.com` and localhost.
- Public routes remain on `dayandisli.com` and localhost.
- `/apps` is protected through `ProtectedRoute` in `src/App.tsx`.

## Authentication Flow Verification

Current code path:

- Missing session on any protected ERP route redirects to `/login` through `ProtectedRoute`.
- `/login` authenticates through Supabase Auth.
- Active user authorization is checked through `admin_users`.
- Successful login redirects to `/apps`.
- Logout from the applications hub signs out through Supabase and redirects to `/login`.
- Logout from the ERP top bar still signs out through Supabase and redirects to `/login`.

Validation performed:

- `npm run build` passed.
- Authentication behavior was verified by code inspection of:
  - `src/components/ProtectedRoute.tsx`
  - `src/pages/Login.tsx`
  - `src/pages/Apps.tsx`
  - `src/features/erp/layout/ERPTopBar.tsx`

Browser-level login verification was not performed in this phase because credentials were not provided and the previous browser automation environment was unavailable.

## Turkish UI Audit

Focused Turkish UI changes made for the entry experience:

- `/apps` hub labels, descriptions, header, and logout button are Turkish.
- ERP top bar brand link remains Turkish-facing.
- `Dashboard` visible label changed to `Kontrol Paneli`.
- `Calculator` visible label changed to `Hesaplama`.
- `DAYAN Calculator` page title changed to `DAYAN Hesaplama`.
- Dashboard quick links changed from `Calculator Aç` to `Hesaplamayı Aç`.
- ERP not-found action changed from `Dashboard'a Dön` to `Uygulamalara Dön`.
- Admin visible labels touched in the entry/navigation path were adjusted to Turkish.

Known remaining risk:

- A full Turkish UI audit across every deep ERP module was not completed in this phase. This phase focused on `/apps`, entry navigation, and immediately visible hub/topbar/dashboard labels.

## Future Permission Strategy

Prepared but not enabled:

- Every application registry item has an optional `permissionKey`.
- Future role filtering can happen before rendering cards:

```ts
const visibleApplications = erpApplications.filter((app) =>
  canCurrentUserView(app.permissionKey)
);
```

Recommended future sources:

- Existing ERP user role data from `erp_users`.
- Existing permission helper patterns in `src/features/erp/shared/permissions.ts`.
- Supabase RLS should remain the final data-access authority.

Important:

- UI filtering should only hide navigation.
- It must not be treated as backend authorization.

## Files Modified

Added:

- `src/features/erp/apps/applicationRegistry.ts`
- `docs/phase-1-applications-hub-report.md`

Modified:

- `src/pages/Apps.tsx`
- `src/features/erp/layout/ERPTopBar.tsx`
- `src/features/erp/dashboard/ERPHomePage.tsx`
- `src/features/erp/dashboard/ERPDatabaseStatusWidget.tsx`
- `src/pages/erp/ErpNotFoundPage.tsx`
- `src/components/erp/QuickActionMenu.tsx`
- `src/features/admin/AdminSettings.tsx`
- `src/features/admin/AdminSqlEditor.tsx`
- `src/features/admin/AdminSummaryPages.tsx`

Related Phase 0 files remain modified in the working branch:

- `src/App.tsx`
- `src/lib/domains.ts`
- `src/pages/Login.tsx`
- `src/config/erpModules.ts`
- `src/features/erp/index.tsx`

## Risks

### Routes Point to Existing Modules With Different Depth

Some application cards point to existing broad modules rather than newly specialized app screens.

Examples:

- `Tamir Yönetimi` points to `/work-orders`.
- `E-Ticaret` points to `/admin/siparisler`.
- `Web Sitesi` points to `/admin`.

This is intentional for Phase 1 because no new ERP modules should be built yet.

### Legacy English Route Paths Remain

Some route paths remain English for backward compatibility, such as `/production`, `/inventory`, and `/settings`.

These are technical URL paths, not visible labels. They should be reviewed in a future route cleanup phase.

### Full Turkish UI Compliance Is Larger Than Entry Experience

The entry hub is Turkish. The most visible topbar/dashboard strings touched by the hub flow were converted. Deep module screens may still contain English words in placeholders, descriptions, or status text.

Recommended next step:

- Run a dedicated full ERP Turkish UI audit and fix pass.

### Application Permissions Are Metadata Only

Permission keys exist but are not enforced in the hub yet.

This is intentional for Phase 1. Role filtering should be implemented after role policy decisions are finalized.

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

## Next Phase Recommendation

Phase 2 should focus on role-aware navigation and route cleanup:

1. Define ERP roles and application permission mapping.
2. Filter `/apps` cards by `permissionKey`.
3. Align sidebar navigation with the application registry.
4. Decide which legacy English route aliases remain as redirects.
5. Complete full Turkish UI audit for all ERP screens.
6. Add automated route/auth tests once browser tooling is available in the project.
