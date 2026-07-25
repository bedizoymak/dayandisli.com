# Dayan Dişli ERP — Demo-to-Apps Frontend Convergence Master Plan

## 1. Objective

Make every production application page under `/apps/*` visually and behaviorally match its approved Ebru frontend reference under `/demo/*`, while preserving the real routes, authentication, permissions, data access, business behavior, and production integrations already used by `/apps/*`.

The target state is:

```text
/demo/* = approved visual and interaction specification
/apps/* = real production implementation

Final result:
/apps/* looks and behaves like /demo/* but continues to use real production data.
```

This document is the single phased execution plan. A phase is complete only after its acceptance criteria pass on both local and deployed production builds.

## 2. Source-of-Truth Rules

1. `/demo/*` is the source of truth for:
   - layout;
   - component hierarchy;
   - colors, typography, borders, shadows, radii and spacing;
   - responsive behavior;
   - labels and information hierarchy;
   - menus, drawers, modals, tables, filters and empty states;
   - interaction patterns and visual feedback.

2. `/apps/*` is the source of truth for:
   - real application routes;
   - authentication and authorization;
   - company/tenant scope;
   - production data;
   - APIs, Supabase access and Paraşüt integration;
   - mutations and business rules;
   - existing working form submissions and workflows.

3. Demo mock values must never replace real application data.

4. Existing `/demo/*` pages must not be modified during convergence unless the owner explicitly requests a correction to the reference design.

5. Do not solve visual differences by embedding demo pages, using iframes, duplicating an entire application tree, or routing production users into `/demo/*`.

6. Do not modify database schemas, migrations, RLS policies, Edge Functions, synchronization logic, production records or backend contracts merely to achieve visual parity.

7. If a demo component expects data that production does not currently provide:
   - preserve the approved visual structure;
   - show a truthful loading, empty, unavailable or error state;
   - record the missing data contract as a blocker;
   - do not invent production values.

8. The approved shell is globally protected:
   - sidebar;
   - top header;
   - global search;
   - quick actions;
   - notifications;
   - calendar;
   - user area;
   - footer;
   - page-width and spacing system.

9. Modify only the phase currently being executed. Unrelated pages and features must remain untouched.

## 3. Route-Matching Convention

The normal mapping rule is:

```text
/demo/<module>/<page>
        ↓
/apps/<module>/<page>
```

Dashboard mapping:

```text
/demo
  ↓
/apps
```

Route pairs must be confirmed from the actual router before implementation. Do not guess a route from a menu label. Where the demo uses a legacy or shortened URL, map it to the corresponding existing `/apps/*` production route and document the exception.

## 4. Definition of Visual Parity

“Same” means materially indistinguishable at the same viewport and UI state, excluding legitimate differences caused by real data.

For every route pair compare:

- sidebar expansion and active-item state;
- header dimensions and alignment;
- page title, breadcrumb and action placement;
- grid and section structure;
- component dimensions;
- typography size, weight, line height and color;
- background, border, radius, shadow and accent colors;
- icon identity, size and alignment;
- table columns, density, headers and row actions;
- tabs, filters, search, pagination and sorting controls;
- forms, validation messages and disabled states;
- modal, drawer, dropdown and tooltip behavior;
- loading, empty, error and populated states;
- desktop and mobile/responsive behavior;
- keyboard focus and basic accessibility behavior.

Pixel-perfect work must not make real data unreadable. Long customer names, large Turkish Lira values, missing optional fields and multi-line content must be tested explicitly.

## 5. Baseline Observations — 25 July 2026

Observed live pages:

- Reference: `https://erp.dayandisli.com/demo`
- Production: `https://erp.dayandisli.com/apps/`

Confirmed:

- Both pages use the same general dark ERP shell.
- The demo sidebar currently demonstrates expanded accounting navigation.
- The apps sidebar initially shows collapsed module navigation.
- Demo dashboard cards contain reference labels and example values.
- Apps dashboard cards contain live values and live integration states.
- Real values cause visible differences in number format, line wrapping and empty-state presentation.
- Dashboard convergence must preserve live data while adopting the demo component geometry and presentation rules.

## 6. Phase 00 — Inventory and Baseline Capture

### Work

1. Inspect the route configuration and produce a complete route-pair matrix:

   | Demo reference | Apps implementation | Status | Notes |
   |---|---|---|---|
   | `/demo` | `/apps` | Confirmed | Dashboard |
   | `/demo/finance` | `/apps/finance` | Confirmed | Finance overview |
   | `/demo/crm/customers` | `/apps/crm/customers` | Confirmed | CRM customers |
   | `/demo/sales/quotes` | `/apps/sales/quotes` | Confirmed | Priority: new-quote customer selector bug (Phase 05) |
   | `/demo/sales/orders` | `/apps/sales/orders` | Confirmed | |
   | `/demo/sales/activities` | `/apps/sales/activities` | Confirmed | |
   | `/demo/reports/collections` | `/apps/reports/collections` | Confirmed | |
   | `/demo/reports/income-expense` | `/apps/reports/income-expense` | Confirmed | |
   | `/demo/reports/cash-bank` | `/apps/reports/cash-bank` | Confirmed | |
   | `/demo/reports/production` | `/apps/reports/production` | Confirmed | |
   | `/demo/finance/income/invoices` | `/apps/finance/income/invoices` | Confirmed | Phase 03B |
   | `/demo/finance/income/customers` | `/apps/finance/income/customers` | Confirmed | Phase 03B |
   | `/demo/finance/income/collection-report` | `/apps/finance/income/collection-report` | Confirmed | Phase 03B |
   | `/demo/finance/expense/list` | `/apps/finance/expense/list` | Confirmed | Phase 03C |
   | `/demo/finance/expense/incoming-invoices` | `/apps/finance/expense/incoming-invoices` | Confirmed | Phase 03C |
   | `/demo/finance/expense/income-expense-report` | `/apps/finance/expense/income-expense-report` | Confirmed | Phase 03C |
   | `/demo/finance/expense/payments-report` | `/apps/finance/expense/payments-report` | Confirmed | Phase 03C |
   | `/demo/finance/expense/vat-report` | `/apps/finance/expense/vat-report` | Confirmed | Phase 03C |
   | `/demo/finance/purchasing/orders` | `/apps/finance/purchasing/orders` | Confirmed | Phase 03D |
   | `/demo/finance/purchasing/suppliers` | `/apps/finance/purchasing/suppliers` | Confirmed | Phase 03D |
   | `/demo/finance/cash/accounts` | `/apps/finance/cash/accounts` | Confirmed | Phase 03E |
   | `/demo/finance/cash/checks` | `/apps/finance/cash/checks` | Confirmed | Phase 03E |
   | `/demo/finance/cash/cash-bank-report` | `/apps/finance/cash/cash-bank-report` | Confirmed | Phase 03E |
   | `/demo/finance/cash/cash-flow-report` | `/apps/finance/cash/cash-flow-report` | Confirmed | Phase 03E |
   | `/demo/finance/inventory/products` | `/apps/finance/inventory/products` | Confirmed | Phase 03F |
   | `/demo/finance/inventory/outgoing-dispatches` | `/apps/finance/inventory/outgoing-dispatches` | Confirmed | Phase 03F |
   | `/demo/finance/inventory/incoming-dispatches` | `/apps/finance/inventory/incoming-dispatches` | Confirmed | Phase 03F |
   | `/demo/finance/inventory/history` | `/apps/finance/inventory/history` | Confirmed | Phase 03F |
   | `/demo/finance/inventory/report` | `/apps/finance/inventory/report` | Confirmed | Phase 03F |
   | `/demo/commerce` (unprefixed stub) | `/apps/commerce` | Dead reference | See router evidence below; not a real route pair |
   | `/demo/production` (unprefixed stub) | `/apps/production` | Dead reference | See router evidence below; not a real route pair |
   | `/demo/quality` (unprefixed stub) | `/apps/quality` | Dead reference | See router evidence below; not a real route pair |
   | `/demo/hr` (unprefixed stub) | `/apps/hr` | Dead reference | See router evidence below; not a real route pair |
   | `/demo/website` (unprefixed stub) | `/apps/website` | Dead reference | See router evidence below; not a real route pair |
   | `/demo/settings` (unprefixed stub) | `/apps/settings` | Dead reference | See router evidence below; not a real route pair |

   Router evidence: `src/App.tsx` uses React Router v6 with two catch-all routes — `<Route path="/demo/*" element={<EbruDemoPage />} />` (`src/App.tsx:133`, component at `src/features/ebru-demo/EbruPreviewPage.tsx`) and `<Route path="/apps/*" element={<EbruPreviewPage />} />` (`src/App.tsx:140`, component at `src/features/ebru-preview/EbruPreviewPage.tsx`). Neither route tree uses nested `<Route>` elements; each component branches internally on `location.pathname`. Sub-routes are enumerated in sibling data files: `previewData.ts`, `crm-preview/crmCustomerData.ts`, `sales-preview/salesData.ts`, `finance-preview/financePreviewData.ts`, `reports-preview/reportsPreviewData.ts`, duplicated near-identically under both `src/features/ebru-demo/` and `src/features/ebru-preview/`.

   Every route the demo emits has a byte-identical `/apps/*` counterpart (prefix differs only). No demo-only routes were found.

   **Known inconsistency**: in `previewData.ts`, sidebar entries for E-Ticaret/Üretim/Kalite/HR/Website/Ayarlar are `/apps/...`-prefixed on the apps side but left unprefixed (`/commerce`, `/production`, `/quality`, `/hr`, `/website`, `/settings`) on the demo side (`src/features/ebru-demo/previewData.ts:10-15` vs `src/features/ebru-preview/previewData.ts:10-15`). Neither target is mounted as a top-level `<Route>` in `App.tsx`, so both fall through to `LegacyRootToAppsRedirect` (`src/App.tsx:50-53,144`) and land back on `/apps/...`. These are not real, navigable route pairs today — do not build Phase 07–11 work against them until they are actually mounted; treat their absence as a Phase 00 blocker for those phases.

   **Apps-only routes with no demo reference:**
   - `/apps/ebru-preview/*` — redirect stub to `/apps` (`src/App.tsx:137`), no content, no demo equivalent.
   - `/apps/parasut/*` — legacy redirect handler via `resolveLegacyParasutRoute` (`src/App.tsx:71-74`, `138`), no demo equivalent.
   - The much larger `applicationRegistry.ts` module tree (`/apps/website`, `/apps/commerce`, `/apps/crm`, `/apps/sales`, `/apps/invoicing`, `/apps/accounting`, `/apps/expenses`, `/apps/inventory`, `/apps/purchasing`, `/apps/production`, `/apps/quality`, etc. — `src/features/erp/apps/applicationRegistry.ts:62-211`) is **defined but unmounted**: only consumed by `ApplicationShellPage.tsx`, `AppsLayout.tsx`, and `src/pages/Apps.tsx`, none of which `src/App.tsx`'s live route table references. It appears to be a separate, more granular canonical-ERP-shell registry (likely the intended target for Phases 07–11's modules) that is not currently reachable at runtime. **This is the single biggest open question for this plan**: Phases 07 (E-Ticaret), 08 (Üretim), 09 (Kalite/Bakım), 10 (İK), and part of 11 (Web Sitesi) have no live `/apps/*` route to converge into yet. Resolve this before starting those phases — confirm with the owner whether `applicationRegistry.ts` is the intended production surface to wire up, or whether those modules should be added to `EbruPreviewPage`'s path-switch instead.

2. Inventory reusable components used by each side:
   - shell components;
   - navigation definitions;
   - page layouts;
   - cards and charts;
   - tables;
   - filters;
   - forms;
   - modal/drawer components;
   - shared tokens and styles.

3. Capture baseline screenshots at agreed viewport sizes:
   - desktop: 1440 × 900;
   - laptop: 1366 × 768;
   - mobile: 390 × 844 where the page supports mobile.

4. Record current validation commands:
   - targeted tests;
   - typecheck;
   - lint;
   - production build;
   - approved deploy command.

5. Identify missing demo-to-app route pairs and routes that exist only on one side.

### Deliverable

Add a checked route matrix and baseline evidence section to this document.

### Acceptance criteria

- Every discovered `/demo/*` route has an explicit status.
- Every matching `/apps/*` route is identified by router evidence.
- No source files, database objects or production data are changed.

## 7. Phase 01 — Shared Design System and Shell Lock

### Work

1. Extract or consolidate the demo’s reusable visual tokens:
   - background and surface colors;
   - accent/status colors;
   - typography scale;
   - spacing scale;
   - border radii;
   - border and shadow styles;
   - standard control heights;
   - table density;
   - responsive breakpoints.

2. Make `/apps/*` consume the approved shared tokens/components where safe.

3. Align the production shell with the demo reference without changing:
   - authentication;
   - permissions;
   - navigation destinations;
   - real notification/calendar/user behavior.

4. Verify expanded, collapsed, hover, active and keyboard-focus navigation states.

### Acceptance criteria

- `/apps` shell matches `/demo` at the agreed desktop viewport.
- All existing production routes remain reachable.
- Permission-gated modules remain permission-gated.
- No demo mock data enters production.
- Dashboard and representative deep links pass refresh/direct-navigation tests.

## 8. Phase 02 — Dashboard Convergence

### Route pair

```text
/demo
/apps
```

### Work

Match:

- greeting/hero area;
- date, weather and exchange-rate cards;
- quick-action cards;
- primary KPI cards;
- collection and payment charts;
- upcoming payments/collections;
- approval queue;
- system notifications;
- footer and vertical rhythm.

Retain:

- live weather/exchange-rate behavior;
- real invoice, payment, cash/bank and Paraşüt values;
- real empty and unavailable states;
- real quick-action destinations.

Explicitly test:

- zero values;
- missing provider data;
- long company names;
- large TRY amounts;
- loading and API error states;
- notification/approval lists with zero and many items.

### Acceptance criteria

- Side-by-side desktop comparison shows the same component geometry.
- Apps values remain live and traceable to current data sources.
- No placeholder financial or operational value is displayed as real.
- Quick actions navigate to the correct `/apps/*` pages.
- Targeted tests, typecheck, lint and production build pass.

## 9. Phase 03 — Muhasebe ve Finans

Implement in small route groups. Complete and validate one group before starting the next.

### Phase 03A — Güncel Durum

- Current financial overview
- Collection details
- Payment details

### Phase 03B — Gelir Yönetimi

- Faturalar
- Yeni fatura
- Müşteriler
- Yeni müşteri
- Tahsilat Raporu

### Phase 03C — Gider Yönetimi

- Gider Listesi
- Yeni gider/fatura
- Gelen Faturalar
- Gelir-Gider Raporu
- Ödemeler Raporu
- KDV Raporu

### Phase 03D — Satın Alma

- Siparişler
- Yeni satın alma siparişi
- Tedarikçiler
- Yeni tedarikçi

### Phase 03E — Kasa

- Kasa ve Bankalar
- Çekler
- Çek Ekle
- Nakit Akışı Raporu
- Kasa-Banka Raporu

### Phase 03F — Stok Yönetimi

- Hizmet ve Ürünler
- Hizmet/Ürün Ekle
- Giden İrsaliyeler
- Gelen İrsaliyeler
- Stok Geçmişi
- Stoktaki Ürünler Raporu

### Finance-specific safeguards

- Preserve actual Paraşüt IDs and source mappings.
- Preserve monetary precision and currency.
- Preserve invoice/payment status logic.
- Preserve pagination and server-side filters.
- Do not hide data inconsistencies with frontend-only filtering.
- Exported PDF/Excel contents must remain correct even if export button styling changes.

### Acceptance criteria for each subphase

- All mapped route pairs visually match.
- Search/filter/sort/pagination behaviors still work.
- Create/edit/detail flows retain existing real behavior.
- Back navigation goes to the correct production list.
- Loading, empty, error and populated states are verified.
- Focused regression tests and full build pass.

## 10. Phase 04 — Müşteri İlişkileri

### Work

- Inventory all CRM/stakeholder route pairs.
- Match lists, profiles, activities, notes, filters, forms and detail layouts.
- Preserve production customer identity and company scope.
- Reuse the verified customer normalization layer rather than introducing page-specific mappings.

### Acceptance criteria

- Customer names and identifiers render from verified real fields.
- Customer/supplier classifications are not altered for visual reasons.
- Deep links and selection flows work after refresh.
- Visual parity and responsive checks pass.

## 11. Phase 05 — Satış

### Work

- Teklif listesi
- Yeni teklif
- Teklif detay/düzenleme
- Related sales routes discovered in Phase 00

Priority regression:

- `https://erp.dayandisli.com/apps/sales/quotes/new`
- “Müşteri Seç” must display readable real customers.
- Selecting a customer must populate the quote form.
- No `"."`, blank or punctuation-only customer option may appear.

### Acceptance criteria

- Quote pages visually match their `/demo/*` references.
- Real customer selection, search and form population work.
- Totals, taxes and currency presentation remain correct.
- No sales business rule changes are introduced.

## 12. Phase 06 — Raporlar

### Work

- Inventory all report route pairs.
- Align filter bars, date controls, summaries, charts and tables.
- Preserve real query parameters and export behavior.

### Acceptance criteria

- Screen totals equal export totals for the same filters.
- Empty and partial-data states match the reference design.
- Charts remain legible with real extremes and zero series.

### Phase 07–10 prerequisite — route mounting blocker

Phase 00 (§6) found that neither `/demo/*` nor the live `/apps/*` route table (`src/App.tsx`) exposes a real, navigable route for e-commerce, production, quality/maintenance, or HR today. The demo's sidebar targets for these modules (`/commerce`, `/production`, `/quality`, `/hr`) are unprefixed stubs that fall through to `LegacyRootToAppsRedirect` and never render module content. A separate, more granular route/component tree exists at `src/features/erp/apps/applicationRegistry.ts:62-211` (covering `/apps/website`, `/apps/commerce`, `/apps/crm`, `/apps/sales`, `/apps/invoicing`, `/apps/accounting`, `/apps/expenses`, `/apps/inventory`, `/apps/purchasing`, `/apps/production`, `/apps/quality`, etc.) but it is not wired into `src/App.tsx`'s route table and is unreachable at runtime.

Per §22 Stop Conditions ("no reliable demo-to-app route pair exists"), **Phases 07–10 (and the module-specific portion of Phase 11) are BLOCKED** until the owner decides one of:

1. Wire `applicationRegistry.ts` into `App.tsx` as the canonical destination and treat it as the real `/apps/*` implementation for these modules; or
2. Add real path-switch cases for these modules to `EbruPreviewPage.tsx` (mirroring the pattern used for finance/crm/sales/reports); or
3. Some other owner-directed resolution.

Do not begin implementation work on these phases until this is resolved and recorded here. The phase descriptions below define scope for when unblocked; they are not a signal that a route pair currently exists.

## 13. Phase 07 — E-Ticaret (BLOCKED — see prerequisite above)

Converge every mapped e-commerce list, detail, configuration and dashboard page while preserving permissions and existing integrations.

## 14. Phase 08 — Üretim (BLOCKED — see prerequisite above)

Converge production-planning and execution pages, including the discovered routes for:

- work orders;
- routes/operations;
- turning;
- milling;
- grinding;
- wire EDM;
- subcontracting;
- machine and production status views.

Do not change manufacturing calculations, status transitions or operational data contracts.

## 15. Phase 09 — Kalite ve Bakım Yönetimi (BLOCKED — see prerequisite above)

Converge:

- quality records;
- inspections;
- nonconformities;
- maintenance plans;
- maintenance work;
- machine/service histories;
- related reports.

Do not change inspection criteria, approval rules or maintenance schedules.

## 16. Phase 10 — İnsan Kaynakları (BLOCKED — see prerequisite above)

Starting production route observed:

```text
/apps/hr/employees
```

Converge employee, attendance, leave and related HR pages discovered in Phase 00. Preserve access restrictions and sensitive-data visibility.

## 17. Phase 11 — Web Sitesi and Ayarlar (BLOCKED — no live route pair)

### Investigation (25 July 2026)

Re-verified the Phase 00 finding specifically for Web Sitesi and Ayarlar before starting any implementation, per workflow rule "inspect first":

1. `src/App.tsx` has no `<Route>` for `/apps/website` or `/apps/settings` beyond the generic catch-all `path="/apps/*"` → `EbruPreviewPage` (`src/App.tsx:140`). There is no dedicated settings/website route or component.
2. `src/features/ebru-preview/EbruPreviewPage.tsx` branches on `location.pathname` (see `routePath` at line 122 and the large path-switch used for rendering). Grepping the full path-switch shows cases for dashboard, finance, crm, sales, reports, inventory, purchasing, cash — but **no case for `/website` or `/settings`**. Visiting either falls through to whatever the default/dashboard branch renders.
3. `src/features/ebru-demo/EbruPreviewPage.tsx` has the equivalent path-switch (`location.pathname === "/demo"`, `.includes("/reports/")`, `.includes("/sales/")`, etc.) and likewise has **no case for `/demo/website` or `/demo/settings`**.
4. Sidebar data confirms the mismatch already documented in Phase 00: `src/features/ebru-preview/previewData.ts:14-15` points at `/apps/website` and `/apps/settings`; `src/features/ebru-demo/previewData.ts:14-15` points at unprefixed `/website` and `/settings`. Neither is a mounted route; both fall through to `LegacyRootToAppsRedirect` / the default view.
5. Live check: `https://erp.dayandisli.com/apps/website`, `/apps/settings`, `/demo/website`, `/demo/settings` all serve the same SPA shell with no page-specific content distinguishable at the fetch level, consistent with the code-level finding that no path-switch branch exists for any of the four.
6. The only real, working "settings" affordance found anywhere in the live route table is the **Ayarlar** link in the account/user menu (`src/features/ebru-preview/EbruPreviewPage.tsx:812-813`), which points at `/settings` — itself unmounted and outside `/apps/*`, so it does not resolve to a real settings page either.
7. The larger `applicationRegistry.ts` tree (`src/features/erp/apps/applicationRegistry.ts:62-211`) does define `/apps/website`-style entries in a separate, more granular registry, but per the explicit owner decision recorded in the task brief for this run, wiring `applicationRegistry.ts` into `App.tsx` is out of scope — Phases 07-10 and the module-mounting question are to be left untouched and documented as blocked, not resolved unilaterally.

### Conclusion

There is no reliable demo-to-app route pair for Web Sitesi or Ayarlar today (§22 stop condition: "no reliable demo-to-app route pair exists"). There is no demo reference UI to converge toward and no distinct `/apps/*` implementation with real settings data/behavior to preserve — both routes currently render identical fallback content. Building a new settings/website page from scratch to satisfy this phase would mean inventing a UI not specified by any approved reference, which is out of scope for a convergence project and was not authorized.

**Status: BLOCKED.** Unblocking requires the same owner decision already pending for Phases 07-10 (§12): either wire `applicationRegistry.ts` into `App.tsx` as the canonical destination, or add real path-switch cases (with an actual approved demo design) for `/website` and `/settings` to both `EbruPreviewPage.tsx` files. No code was changed for this phase; `/demo/*` was not touched.

## 18. Phase 12 — Cross-Module Hardening

### Work

1. Run the complete route matrix at desktop and mobile sizes.
2. Verify:
   - direct URL entry;
   - browser refresh;
   - back/forward navigation;
   - loading/error recovery;
   - permission-denied states;
   - long Turkish text;
   - Turkish character search;
   - large and negative currency values;
   - empty and high-volume tables.
3. Remove visual duplication only when removal is proven safe.
4. Check bundle size and avoid importing the entire demo tree into production routes.
5. Run the full test, typecheck, lint and production build suite.

### Acceptance criteria

- All route pairs are marked complete or explicitly blocked.
- No visual parity change broke production data flows.
- No unauthorized backend/database change exists.
- No console error is introduced on reviewed routes.
- Production build completes successfully.

### Execution record (25 July 2026)

Phases 00-06 were already implemented in prior sessions (commits `b98a7d5`, `58d42be`, `390c9ed`, `51d8414`, `7ddf7f3`, `180b278`). Phase 11 produced no code change (blocked, see §17). Since no source files were modified in this run, cross-module hardening consisted of running the full validation suite against the current `main` HEAD to confirm nothing regressed and the tree is deployable:

- `npm run typecheck` — **PASS**, zero errors.
- `npm test -- --run` — **PASS**, 71 test files / 906 tests passed, 0 failed.
- `npm run build` — **PASS**. Production bundle safeguard (`scripts/verify-production-bundle.mjs`) and ERP production boundary safeguard (`scripts/verify-erp-production-boundary.mjs`) both passed. One pre-existing bundle-size warning (`index-D8_WjkHv.js`, 596.58 kB / 178.46 kB gzip) — not introduced this run, not a regression, no route-mounting change made that would affect it.
- `npm run lint` — 32 pre-existing errors / 48 pre-existing warnings, all in files untouched by this run (`quotation` PDF feature, `pdfFonts.ts`, `supabaseClient.ts`, Supabase edge functions, `tailwind.config.ts`). These predate this session and are outside Phase 11's scope (Web Sitesi/Ayarlar); not fixed here to keep the diff confined to the current phase, per §2 rule 9 ("modify only the phase currently being executed").

Manual route-matrix walk (desktop/mobile viewport comparison, refresh/back-forward, permission states) was not re-run beyond what prior phase sessions already recorded, since this session made no visual/behavioral changes to any mounted route. No new console errors were introduced because no runtime code changed.

**Status: COMPLETE for the no-op case** (nothing this run touched required hardening); the underlying route-matrix hardening evidence from Phases 00-06 remains as recorded in those commits' own sessions.

## 19. Phase 13 — Controlled Production Deployment and Final Audit

### Work

1. Review the complete diff and exclude unrelated changes.
2. Commit in phase-sized, reversible commits.
3. Push the correct branch.
4. Use only the repository’s existing approved deployment workflow.
5. Verify the deployed `/apps/*` routes against `/demo/*`.
6. Record final live screenshots and acceptance results.

### Acceptance criteria

- Deployment succeeds with zero build/deploy errors.
- Live `/apps/*` pages use real production data.
- Live visual and behavioral parity is confirmed route by route.
- `/demo/*` remains unchanged.
- Rollback points are clear from phase commits.

### Execution record (25 July 2026)

`git status`/`git diff` review: the only change in this session is this document (`docs/DAYANDISLI_DEMO_TO_APPS_FRONTEND_MASTER_PLAN.md`), which was already untracked at session start and is in-scope (the task ledger itself). No `/demo/*`, `/apps/*`, database, migration, RLS, Edge Function, or Paraşüt-sync file was touched. `git log origin/main..HEAD` was empty at session start — `main` was already up to date with `origin/main` (the prior sessions' Phase 00-06 commits were already pushed).

The repository's approved deploy workflow is `DEPLOY/deploy-dayan.bat`: `npm run typecheck` → `npm test -- --run` → `npm run build` → `python scripts\deploy_ftp.py --diff` (FTP diff-deploy to production). The first three steps were run directly in this session (see §18 record) and all passed.

The FTP diff-deploy step was **deliberately not executed** in this session. Rationale: this run made zero changes to any application source file — the only diff is documentation. Phase 11 (the only phase assigned to this run with potential code changes) is fully blocked with no code to ship (§17). Running a production FTP deploy with no corresponding source change carries deployment risk (any drift between the FTP target and `main` would be masked as "this session's deploy") without a matching benefit, and whether prior sessions' already-pushed commits (`51d8414` etc.) have been separately deployed and live-verified is outside this session's visibility. Per §22 stop conditions, an unforced production action was intentionally deferred rather than executed speculatively.

**Recommendation for the owner**: run `DEPLOY\deploy-dayan.bat` (or `python scripts/deploy_ftp.py --diff` directly) when ready to sync `main` HEAD to `https://erp.dayandisli.com`, then spot-check `/apps` against `/demo` live. This session confirms the local build is deploy-ready (typecheck/test/build all green) but did not perform the live sync or live visual re-verification, since there was no code change to verify.

**Status: Phase 13 partially executed** — diff review, commit readiness, and pre-deploy validation done; live FTP deploy deferred (no-op session, see rationale above).

## 20. Per-Page Execution Template

Use this checklist for every route pair:

```markdown
### [Page name]

- Demo route:
- Apps route:
- Owner-approved reference state:
- Production data sources:
- Existing working behaviors to preserve:
- Visual differences:
- Interaction differences:
- Loading state:
- Empty state:
- Error state:
- Responsive differences:
- Files changed:
- Tests added/updated:
- Local screenshot comparison:
- Typecheck:
- Lint:
- Build:
- Deployed screenshot comparison:
- Status: NOT STARTED | IN PROGRESS | BLOCKED | COMPLETE
- Blocker/notes:
```

## 21. Required Workflow for Every Phase

1. Inspect first; do not begin with bulk replacement.
2. Confirm route pairs from code and live navigation.
3. Compare both pages in the same viewport and equivalent UI state.
4. Identify protected production behaviors and data flows.
5. Implement only the current phase.
6. Add or update focused regression tests.
7. Run targeted tests, typecheck, lint and full production build.
8. Review the diff for scope confinement.
9. Deploy only when the phase is approved for deployment.
10. Verify the live page visually and functionally.
11. Update this document with evidence and final status.

## 22. Stop Conditions

Stop and report instead of guessing if:

- no reliable demo-to-app route pair exists;
- the demo and owner-approved design conflict;
- matching the demo would require changing a real business rule;
- required production data is unavailable;
- a database, RLS, schema, sync or backend change appears necessary;
- a permission boundary would be weakened;
- an unrelated dirty-worktree change overlaps the target;
- the approved build/deploy workflow fails.

## 23. Final Completion Standard

The project is complete only when:

1. every intended `/apps/*` page has a documented `/demo/*` reference or an approved exception;
2. every `/apps/*` page matches the approved demo design in layout and behavior;
3. every `/apps/*` page continues using real production data and business logic;
4. permissions, authentication and integrations remain intact;
5. tests, typecheck, lint and production build pass;
6. live deployment is visually and functionally verified;
7. the owner approves the final production result.

