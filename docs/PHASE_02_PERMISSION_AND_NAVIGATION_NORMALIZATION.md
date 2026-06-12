# Phase 2 — Permission and Navigation Normalization

## Objective

Align ERP application launcher, sidebar, application shell, and protected route permissions so visible navigation leads to accessible routes and operational routes have explicit permission requirements.

## Starting Findings

- Application cards, sidebar modules, route definitions, and path permission rules are maintained in separate files.
- Several application permissions did not match the permissions required by their target module routes.
- Operational routes including logistics, cargo, documents, health, notifications, tasks, and notes could fall back to `dashboard.view`.
- Application shell modules could render as an empty list while the ERP user was still loading.
- Static legacy `/apps` routes and `/apps/:appId` required an explicit ordering review.

## Files Inspected

- `src/features/erp/apps/applicationRegistry.ts`
- `src/features/erp/shared/permissions.ts`
- `src/config/erpModules.ts`
- `src/pages/Apps.tsx`
- `src/features/erp/apps/ApplicationShellPage.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/features/erp/index.tsx`
- `src/App.tsx`
- `docs/PHASE_01_TYPESCRIPT_AND_CRM_FIX.md`

## Current Permission Sources

- Application launcher and application-shell module definitions: `src/features/erp/apps/applicationRegistry.ts`
- ERP sidebar definitions: `src/config/erpModules.ts`
- Role defaults, permission catalog, navigation filtering, and protected path mapping: `src/features/erp/shared/permissions.ts`
- Authentication and route permission enforcement: `src/components/ProtectedRoute.tsx`
- Top-level public, application, admin, legacy, and ERP route definitions: `src/App.tsx`
- ERP module route definitions: `src/features/erp/index.tsx`
- Launcher loading and card rendering: `src/pages/Apps.tsx`
- Application-shell permission loading and child-module rendering: `src/features/erp/apps/ApplicationShellPage.tsx`

## Changes Made

- Normalized launcher application permissions to the domain-level permissions enforced by destination routes.
- Normalized application-shell child modules to the exact permission required by each destination route.
- Aligned ERP sidebar customer, supplier, quotation, order, and calculator items with protected path permissions.
- Added explicit protected path mappings for legacy app routes, repair, maintenance, quality, logistics, shipments, cargo, documents, health, notifications, tasks, and notes.
- Kept `settings.admin` explicitly in the permission catalog for the separate `/admin` route.
- Placed static legacy `/apps` routes before `/apps/:appId` for clarity and future maintenance.
- Added a Turkish `Yetkiler yükleniyor...` state to the application shell.
- Changed the launcher loading message to `Uygulamalar yükleniyor...`.

## Route Permission Map Before

| Route area | Previous behavior |
| --- | --- |
| `/apps/accounting`, `/apps/invoicing`, `/apps/expenses` | Used application-specific permissions while destination pages required `finance.view` |
| `/apps/repair` | Fell through to `dashboard.view` |
| `/apps/maintenance`, `/apps/quality` | Fell through to `dashboard.view` |
| `/apps/calculator/*` | Fell through to general `/apps` and required `dashboard.view` |
| `/apps/shop-orders` | Fell through to general `/apps` and required `dashboard.view` |
| `/logistics`, `/shipments/*` | Fell through to `dashboard.view` |
| `/kargo` | Fell through to `dashboard.view` while the sidebar required inventory access |
| `/documents` | Fell through to `dashboard.view` |
| `/health` | Fell through to `dashboard.view` while navigation required reports access |
| `/notifications`, `/bildirimler`, `/gorevler`, `/notlar` | Relied on the default fallback |

## Route Permission Map After

| Route area | Required permission |
| --- | --- |
| `/dashboard`, `/apps` | `dashboard.view` |
| `/apps/calculator/*`, `/calculator/*` | `production.view` |
| `/apps/shop-orders`, `/commerce/*` | `commerce.view` |
| `/apps/crm`, `/crm`, `/paydaslar`, `/musteriler`, `/tedarikciler` | `crm.view` |
| `/apps/sales`, `/teklifler`, `/quotations`, `/siparisler`, `/sales-orders` | `sales.view` |
| `/apps/accounting`, `/apps/invoicing`, `/apps/expenses`, finance routes | `finance.view` |
| `/apps/inventory`, `/inventory*`, `/kargo` | `inventory.view` |
| `/apps/purchasing`, `/purchasing`, `/purchase-orders*` | `purchasing.view` |
| `/apps/production`, `/apps/repair`, production routes | `production.view` |
| `/apps/quality`, `/quality*` | `quality.view` |
| `/apps/maintenance`, `/maintenance` | `maintenance.view` |
| `/apps/hr`, `/hr*`, `/time-entries` | `hr.view` |
| `/apps/reports`, `/reports`, `/health` | `reports.view` |
| `/apps/website`, `/website*` | `website.view` |
| `/apps/settings`, `/settings`, `/ayarlar` | `settings.view` |
| `/logistics`, `/shipments/*`, `/documents` | `production.view` |
| `/notifications`, `/bildirimler`, `/gorevler`, `/notlar` | `dashboard.view` |
| `/admin/*` | `settings.admin` |

Notifications, tasks, and notes intentionally use `dashboard.view` because they are shared user utilities rather than business-domain applications.

## Application Launcher Behavior

Application cards now use the same domain-level permission as their application-shell route. Finance-related cards use `finance.view`; repair uses `production.view`; and website, commerce, CRM, sales, inventory, purchasing, production, quality, maintenance, HR, reports, and settings use their matching route permissions.

Child modules are filtered by their destination route permission. Cross-domain links remain available only when the user also has the destination domain permission. For example, the inventory application's purchase-order link requires `purchasing.view`, and the quality application's work-order link requires `production.view`.

The application shell no longer displays a temporary empty module list while the ERP user is resolving.

## Sidebar Behavior

Sidebar permissions now match protected route permissions:

- Customers and suppliers use `crm.view`.
- Quotations and orders use `sales.view`.
- Calculator uses `production.view`.
- Finance, cargo, health, settings, notifications, tasks, notes, and hidden logistics entries already align with their route decisions.

## Validation Results

### TypeScript

Command:

```bash
npm run typecheck
```

Result: passed with zero errors.

### Build

Command:

```bash
npm run build
```

Result: passed. Vite transformed 3,553 modules.

Existing build warnings remain for stale `caniuse-lite` data, `pdfjs-dist` eval usage, and chunks larger than 500 kB.

### Lint

Command:

```bash
npm run lint
```

Result: failed with the known backlog of 71 findings: 32 errors and 39 warnings. No new lint error was introduced by this phase.

## Manual QA Checklist

- Login as admin and verify `/apps` displays expected applications.
- Click every launcher application card and confirm no unexpected permission denial.
- Open `/apps/calculator` and confirm legacy calculator behavior still works.
- Open `/calculator` and confirm calculator behavior still works.
- Open finance routes from launcher and sidebar.
- Open logistics and cargo routes.
- Open documents route.
- Open health and reports routes.
- Open notifications routes.
- Verify a restricted role does not see unauthorized launcher cards.
- Verify a restricted role cannot access unauthorized routes directly.
- Confirm all loading and denied messages are Turkish.

## Remaining Risks

- Route definitions and permission metadata still live in separate files; this phase aligns them but does not create a single generated registry.
- Permission behavior was statically verified and compiled, but representative live users are still required for role-by-role manual QA.
- `ProtectedRoute` still resolves session and ERP user state on every protected navigation; auth centralization remains out of scope.
- Unknown ERP paths retain the existing `dashboard.view` fallback before reaching the protected not-found page.
- `production.view` is used for logistics and documents because the current taxonomy has no dedicated logistics or document permission.

## Next Recommended Phase

Add automated permission-contract tests and role-based route smoke tests, then centralize session and ERP-user state in a dedicated auth provider.
