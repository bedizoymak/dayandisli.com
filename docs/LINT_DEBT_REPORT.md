# Lint Debt Report

## Objective

Record the existing ESLint backlog by category so lint can remain visible but non-blocking until the debt is addressed deliberately.

## Baseline

`npm run lint` currently reports 72 findings: 32 errors and 40 warnings. Lint is therefore reported but non-blocking in Phase 4 CI.

## Explicit Any

- **Count:** 27 errors
- **Locations:** calculator receipts, contact form, language context, quotation/PDF code, Supabase compatibility clients, and Supabase Edge Functions.
- **Effort:** High
- **Approach:** Introduce focused request, response, form, PDF, and error types by domain. Avoid replacing `any` with unsafe assertions.

## Hook Dependency Warnings

- **Count:** 30 warnings
- **Locations:** ERP data-loading pages and quotation gesture/form hooks.
- **Effort:** High
- **Approach:** Stabilize loaders with `useCallback` or move request functions inside effects. Verify behavior carefully because mechanical dependency additions can create request loops.

## Fast Refresh Warnings

- **Count:** 10 warnings
- **Locations:** shared UI component modules and React context modules that export components together with helpers.
- **Effort:** Medium
- **Approach:** Move reusable constants, hooks, and helpers into adjacent modules while preserving public imports.

## Empty Interfaces

- **Count:** 2 errors
- **Locations:** `src/components/ui/command.tsx` and `src/components/ui/textarea.tsx`.
- **Effort:** Low
- **Approach:** Replace empty extending interfaces with type aliases or use the inherited prop type directly.

## CommonJS Usage

- **Count:** 1 error
- **Location:** `tailwind.config.ts`
- **Effort:** Low
- **Approach:** Replace the plugin `require()` with an ESM import supported by the current Tailwind configuration.

## Other Findings

- **Count:** 2 `prefer-const` errors
- **Location:** quotation PDF generation.
- **Effort:** Low
- **Approach:** Convert variables that are never reassigned to `const`.

## Recommended Order

1. Fix empty interfaces, CommonJS usage, and `prefer-const` errors.
2. Split Fast Refresh-incompatible exports.
3. Resolve explicit `any` findings by domain.
4. Audit hook dependencies page by page with behavior verification.
5. Remove `continue-on-error` from the CI lint step once the baseline is clean.
