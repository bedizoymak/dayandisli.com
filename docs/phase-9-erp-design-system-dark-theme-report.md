# Phase 9 ERP Design System and Dark Theme Migration Report

Date: 2026-06-01  
Scope: ERP visual language, centralized design tokens, global dark theme foundation.  
Constraints followed: no business logic changes, no Supabase architecture changes, no workflow changes, no permission changes.

## Theme Architecture

Phase 9 establishes a centralized ERP dark theme through CSS variables and Tailwind token mapping.

The ERP theme is scoped by the `erp-theme` class and applied to:

- `/apps`
- `/apps/:appId`
- all pages using `ERPLayout`

This keeps the dark ERP system separate from the public website while allowing all ERP modules to inherit the same visual language.

## Design Token Structure

Central tokens were added in `src/index.css`:

- `--erp-bg`
- `--erp-bg-soft`
- `--erp-surface`
- `--erp-surface-raised`
- `--erp-card`
- `--erp-border`
- `--erp-text`
- `--erp-text-muted`
- `--erp-primary`
- `--erp-primary-hover`
- `--erp-success`
- `--erp-warning`
- `--erp-danger`
- `--erp-info`
- `--erp-shadow`

Tailwind mappings were added in `tailwind.config.ts` under `colors.erp`.

Shared ERP component classes were added:

- `erp-theme`
- `erp-shell`
- `erp-surface`
- `erp-subtle-surface`
- `erp-icon-surface`

The base shadcn variables now point to ERP dark tokens for ERP-compatible defaults:

- background
- foreground
- card
- popover
- primary
- secondary
- muted
- accent
- border
- input
- ring
- sidebar tokens

## Components Migrated

### Global ERP Shell

- `ERPLayout`
  - Applies `erp-theme` and `erp-shell`.
  - All future ERP module pages that use `ERPLayout` inherit the dark system automatically.

### Navigation

- `ERPTopBar`
  - Dark surface.
  - Token-based search input.
  - Token-based icon container.

- `ERPSidebar`
  - Dark surface.
  - Consistent active/hover states.
  - Token-based sidebar styling.

### Applications Hub

- `/apps`
  - Dark background.
  - Dark application cards.
  - Consistent icon containers.
  - Token-based hover/focus states.
  - Responsive layout preserved.
  - Existing application cards preserved.

### Application Shells

- `/apps/:appId`
  - Dark header.
  - Dark app summary panel.
  - Dark module sidebar.
  - Dark module cards.
  - Token-based text, border, and hover states.

### Shared ERP UI

- `PageHeader`
  - Unified dark header surface for module pages.

- `DataTable`
  - Dark table container.
  - Dark table header.
  - Dark hover states.

- `EmptyState`
  - Dark dashed card styling.
  - Token-based icon surface.

## Components Remaining

Some pages still contain historical utility classes such as direct slate color usage or local cards. The new `erp-theme` includes compatibility overrides for common older classes, but future cleanup should continue replacing page-local color classes with token-based classes.

Known remaining areas for visual refinement:

- Legacy `/admin/*` screens.
- Some quotation/PDF workflow dialogs.
- Older finance/customer pages that predate the ERP shell.
- Some status and alert variants that use explicit red/amber classes.
- Dialog/dropdown edge cases where content comes from generic shadcn components.

## Visual Consistency Improvements

Phase 9 improves consistency across:

- Backgrounds.
- Surfaces.
- Cards.
- Tables.
- Headers.
- Sidebar navigation.
- Application cards.
- Icon containers.
- Focus rings.
- Hover states.
- Muted text.
- Borders and shadows.

The ERP now has a single dark visual baseline for current and future modules.

## Accessibility

Maintained or improved:

- High contrast foreground/background tokens.
- Visible focus rings using the primary ring token.
- Keyboard focus behavior on links/buttons remains intact.
- Responsive `/apps` grid preserved.
- Responsive sidebar behavior preserved.

## Files Modified

- `src/index.css`
- `tailwind.config.ts`
- `src/features/erp/layout/ERPLayout.tsx`
- `src/features/erp/layout/ERPTopBar.tsx`
- `src/features/erp/layout/ERPSidebar.tsx`
- `src/pages/Apps.tsx`
- `src/features/erp/apps/ApplicationShellPage.tsx`
- `src/components/erp/PageHeader.tsx`
- `src/components/erp/DataTable.tsx`
- `src/components/erp/EmptyState.tsx`
- `docs/phase-9-erp-design-system-dark-theme-report.md`

## Risks

- Some older ERP pages still have hardcoded utility color classes. Compatibility overrides reduce mixed styling, but deeper component-by-component cleanup remains useful.
- The public website also uses the global CSS variables, so future public-site work should confirm the intended public visual language separately.
- Visual QA in the in-app browser could not be run because the browser tool was not exposed in this session.
- Build validation does not replace full viewport-by-viewport visual QA.
- Bundle size warnings remain unrelated to this visual phase.

## Recommendations

- Continue replacing local color classes with token classes as pages are touched.
- Move status colors onto dedicated tokenized status components.
- Audit `/admin/*` separately if it remains part of ERP operations.
- Add visual regression screenshots after the browser tool is available.
- Consider route-level code splitting in a future performance phase.

## Proposed Phase 10 Scope

Recommended Phase 10: HR and workforce operations on the new ERP design system.

Suggested scope:

- HR dashboard.
- Employee records.
- Time entries.
- Work assignment views.
- Maintenance/personnel link readiness.
- Continue tokenized component cleanup.
- Avoid permissions until the dedicated permissions phase.

## Validation

Command:

```bash
npm run build
```

Result:

- Passed.

Known warnings remain:

- Browserslist/caniuse-lite data is stale.
- `pdfjs-dist` eval warning.
- Main bundle exceeds Vite's 500 kB chunk warning threshold.

