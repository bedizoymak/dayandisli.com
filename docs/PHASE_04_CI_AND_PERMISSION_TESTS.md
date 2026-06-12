# Phase 4 — CI and Permission Tests

## Objective

Add lightweight automated regression checks for ERP permission contracts and protected-route behavior, then run them as blocking GitHub Actions quality gates alongside TypeScript and production builds.

## Starting Findings

- The repository had no automated test framework or `test` script.
- TypeScript and production builds passed.
- Repository-wide lint remained blocked by known legacy debt.
- Application cards, sidebar modules, and route permissions were defined in separate static sources without automated consistency checks.
- `ProtectedRoute` behavior was not covered for loading, logged-out, inactive-admin, allowed, or denied states.

## Files Inspected

- `package.json`
- `package-lock.json`
- `vite.config.ts`
- `tsconfig.app.json`
- `eslint.config.js`
- `.github/workflows/deploy.yml`
- `src/features/erp/shared/permissions.ts`
- `src/components/ProtectedRoute.tsx`
- `src/features/erp/apps/applicationRegistry.ts`
- `src/config/erpModules.ts`
- `src/App.tsx`

## New Test Infrastructure

- Added pinned Vitest, React Testing Library, jest-dom, and jsdom development dependencies.
- Added `vitest.config.ts` with the existing `@` alias, React SWC support, jsdom, and a shared setup file.
- Added `npm run test` for deterministic CI execution and `npm run test:watch` for local development.
- Kept the test layer focused on unit and component smoke tests; no browser E2E infrastructure was introduced.

## Permission Test Coverage

- Every application launcher route is checked against its declared permission.
- Every application module route is checked against its declared permission.
- Every visible sidebar route is checked against its declared permission.
- Explicit cross-surface contracts cover Finance (`finance.view`), CRM (`crm.view`), and Production (`production.view`).
- The hidden legacy root sidebar record is intentionally excluded because it is not rendered and `/` is the dashboard route.
- `ProtectedRoute` covers loading, logged-out, inactive-admin, missing-permission, and allowed states.
- Tests assert that the existing Turkish loading text remains unchanged.

## CI Workflow

`.github/workflows/quality.yml` runs on pull requests and pushes to `main` with Node.js 20 and `npm ci`.

The blocking steps are:

1. `npm run typecheck`
2. `npm run test`
3. `npm run build`

`npm run lint` runs with `continue-on-error: true`. This keeps the known debt visible in Actions without allowing unrelated legacy findings to block permission and build regression protection.

## Validation Results

- `npm run typecheck`: passed.
- `npm run test`: passed, 109 tests across 2 files.
- `npm run build`: passed with existing Browserslist, PDF.js `eval`, and large-chunk advisories.
- Phase-scoped ESLint for the new test/config files: passed.
- Repository-wide `npm run lint`: known non-blocking baseline of 32 errors and 40 warnings.
- `npm ci`: passed; npm reported 27 dependency audit findings for separate review.
- `git diff --check`: passed.

## Manual QA Checklist

- Open a protected ERP route while logged out and confirm redirect to `/login`.
- Confirm the Turkish permission-loading message remains visible while auth is resolving.
- Login with an active admin who has the route permission and confirm protected content renders.
- Login with an inactive admin and confirm redirect to `/login`.
- Login without the route permission and confirm redirect to `/apps`.
- Confirm Finance, CRM, and Production application cards match sidebar and route permission requirements.
- Confirm the GitHub Actions quality workflow runs typecheck, build, and tests.
- Confirm lint is reported without blocking the workflow.

## Remaining Risks

- Tests validate frontend permission contracts and route decisions, not database RLS policies.
- Auth-provider integration with live Supabase sessions still requires manual or future integration testing.
- The hidden legacy root sidebar configuration remains intentionally outside visible-sidebar contracts.
- Repository-wide lint debt remains non-blocking until it is reduced.
- Build advisory warnings and dependency audit findings require separate maintenance work.

## Next Recommended Phase

Reduce lint debt in small rule-focused batches, then make lint blocking in the quality workflow once the baseline reaches zero.
