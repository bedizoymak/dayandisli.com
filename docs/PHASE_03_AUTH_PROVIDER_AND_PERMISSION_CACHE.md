# Phase 3 — Auth Provider and Permission Cache

## Objective

Centralize ERP authentication and authorization state so protected routes and navigation consumers share one validated Supabase session, active-admin record, ERP user, role list, and permission list.

## Starting Findings

- `ProtectedRoute` fetched the session, active `admin_users` record, and ERP user on every protected pathname or query-string change.
- The applications page, application shell, and ERP sidebar independently fetched the ERP user again.
- Logout logic was implemented separately in multiple shells.
- Supabase auth state changes were not managed by one ERP-wide listener.
- Protected children were already withheld during route validation, preventing unauthenticated ERP content flicker.

## Files Inspected

- `src/App.tsx`
- `src/components/ProtectedRoute.tsx`
- `src/pages/Login.tsx`
- `src/pages/Apps.tsx`
- `src/features/erp/apps/ApplicationShellPage.tsx`
- `src/features/erp/apps/AppsLayout.tsx`
- `src/features/erp/layout/ERPLayout.tsx`
- `src/features/erp/layout/ERPTopBar.tsx`
- `src/features/erp/layout/ERPSidebar.tsx`
- `src/features/erp/shared/erpApi.ts`
- `src/features/erp/shared/permissions.ts`
- `src/features/erp/shared/types.ts`
- `src/integrations/supabase/client.ts`

## Existing Auth Flow Before

`ProtectedRoute` repeated `getSession`, active `admin_users`, and ERP-user resolution whenever the protected pathname or search string changed. `Apps`, `ApplicationShellPage`, and `ERPSidebar` then fetched the ERP user independently. `ERPTopBar` maintained a second Supabase auth listener, while three different shells owned separate logout implementations.

## New Auth Flow After

`ERPAuthProvider` is mounted inside `BrowserRouter` and enabled only when ERP routes are exposed. It resolves the persisted session once, validates the active admin record, resolves the ERP user, derives roles and permissions, and publishes the cached result through `useERPAuth`.

The provider owns the Supabase auth-state subscription and cleans it up on unmount. Auth changes invalidate in-flight resolutions before replacing the cache. `ProtectedRoute` withholds children while this resolution is loading, then performs pathname permission checks synchronously against the cached permission list.

## Changes Made

- Added `ERPAuthProvider` and `useERPAuth`, exposing session, Supabase user, active admin, ERP user, permissions, roles, loading/auth flags, refresh, logout, and permission checks.
- Refactored `ProtectedRoute` to consume central state without route-change queries.
- Refactored the applications launcher, application shell, ERP sidebar, and ERP top bar to consume cached identity and permissions.
- Consolidated logout audit logging, Supabase sign-out, redirect-path cleanup, and provider-state cleanup.
- Removed redundant application-level loading states and debug logging.

## Query Reduction Notes

Normal protected navigation no longer runs session, `admin_users`, or ERP-user queries per pathname. The applications page, application shell, sidebar, and top bar also no longer issue their own identity queries or auth subscriptions. Queries now occur on provider initialization, explicit refresh, or a Supabase auth-state change.

## Security Considerations

- A Supabase session alone is insufficient; the provider still requires an active matching `admin_users` row.
- Invalid or inactive admin sessions are signed out and cached state is cleared.
- Protected children remain hidden while authentication and permissions are unresolved.
- Each auth resolution has an identifier so stale asynchronous responses cannot overwrite a newer session.
- Route, application, module, and sidebar checks all use the same derived permission set.
- Public-only deployments mount the provider disabled and perform no ERP auth queries.

## Validation Results

- `npm run typecheck`: passed.
- `npm run build`: passed. Vite reported existing advisory warnings for stale Browserslist data, `eval` in `pdfjs-dist`, and chunks over 500 kB.
- `npm run lint`: failed on the existing repository baseline with 32 errors and 41 warnings. Errors are outside Phase 3 files; the new provider has only the same Fast Refresh export warning pattern already present in other context modules.
- Phase-scoped ESLint command: passed with zero errors and one Fast Refresh warning for the provider/hook export.
- `git diff --check`: passed.

## Manual QA Checklist

- Open an ERP route while logged out and confirm ERP content never flashes.
- Confirm redirect to `/login` still works.
- Login with an active admin user.
- Confirm `/apps` loads applications without a temporary empty-state flicker.
- Open multiple ERP routes and confirm auth loading does not flash on every navigation.
- Confirm sidebar modules match the logged-in user permissions.
- Confirm application shell modules match the logged-in user permissions.
- Logout from the ERP UI and confirm state clears.
- Login again and confirm fresh permissions are loaded.
- Confirm denied routes still show Turkish denied/redirect behavior.

## Remaining Risks

- Live authenticated browser QA requires valid Supabase credentials and test users for each role.
- Permission changes made server-side during an unchanged session require `refreshAuth`, a new auth event, or a new login before the cache is replaced.
- Repository-wide lint remains blocked by pre-existing issues outside this phase.

## Next Recommended Phase

Add focused auth-provider tests with mocked Supabase events, then address the repository-wide ESLint baseline so CI can enforce lint regressions cleanly.
