# /apps Empty State Diagnostic Report

## Scope

This audit investigates why `/apps` can render the page header while showing no application cards.

No application code was modified. No migrations were created. No commits or pushes were performed.

## Executive Summary

The `/apps` cards are defined in a static client-side registry, not loaded from Supabase. The page renders cards only after filtering that registry through the currently resolved ERP user permissions.

The highest-probability root cause is a permission mismatch: `/apps` itself is guarded by `dashboard.view`, but every visible app card requires app-specific permissions such as `crm.view`, `sales.view`, `inventory.view`, or `settings.view`. A user with only `dashboard.view`, or a fallback `viewer` user, can pass the route guard and still receive zero cards.

A second important cause is the initial loading behavior. `Apps.tsx` initializes the ERP user as `null`, immediately filters the registry, and renders an empty card list until `getCurrentERPUserSafe()` resolves. If the user lookup is slow, fails silently, or resolves to a low-permission fallback user, the screen remains header-only.

## Root Cause Candidates Ranked

### 1. Route Permission Allows Access, App Permissions Remove Every Card

Risk level: High

Exact files and functions:

- `src/App.tsx`
  - `/apps` route renders `<Apps />` through `protectedElement(<Apps />)`.
- `src/components/ProtectedRoute.tsx`
  - `getRequiredPermissionForPath(location.pathname)`
  - `routePermissions`
- `src/pages/Apps.tsx`
  - `getCurrentERPUserSafe().then(setUser)`
  - `filterApplicationsByPermission(user)`
- `src/features/erp/shared/permissions.ts`
  - `filterApplicationsByPermission(user)`
  - `hasPermission(user, permission)`
  - `getUserPermissions(user)`
  - `FOUNDATION_ROLE_PERMISSION_MAP`
- `src/features/erp/apps/applicationRegistry.ts`
  - `erpApplications`

Exact condition causing empty apps:

```ts
const applications = filterApplicationsByPermission(user);
```

returns an empty array when:

```ts
hasPermission(user, app.permissionKey) === false
```

for every top-level app in `erpApplications`.

The `/apps` route requires only:

```ts
dashboard.view
```

but the top-level app cards require permissions such as:

```text
website.view
commerce.view
crm.view
sales.view
invoicing.view
accounting.view
expenses.view
inventory.view
purchasing.view
production.view
quality.view
maintenance.view
repair.view
hr.view
reports.view
settings.view
```

The `viewer` role receives only:

```ts
["dashboard.view"]
```

Therefore, a `viewer` or fallback user can pass the `/apps` route guard but fail every app-card permission check.

### 2. Initial ERP User Is `null` and There Is No Loading State

Risk level: High

Exact files and functions:

- `src/pages/Apps.tsx`
  - `const [user, setUser] = useState<ERPUser | null>(null)`
  - `useEffect(() => { getCurrentERPUserSafe().then(setUser); }, [])`
  - `filterApplicationsByPermission(user)`
- `src/features/erp/shared/permissions.ts`
  - `hasPermission(null, permission)` returns `false`

Exact condition causing empty apps:

On the first render:

```ts
user === null
```

Then:

```ts
filterApplicationsByPermission(null)
```

returns:

```ts
[]
```

because `hasPermission()` returns `false` when a permission is required and no user is present.

The page still renders the header and maps an empty array, so the visible result is a header-only `/apps` page. If `getCurrentERPUserSafe()` returns `null`, the empty state is permanent.

### 3. ERP User Lookup Falls Back to `viewer`

Risk level: High

Exact files and functions:

- `src/features/erp/shared/erpApi.ts`
  - `getCurrentERPUser()`
  - `getCurrentERPUserSafe()`

Exact condition causing empty apps:

`getCurrentERPUser()` first queries `erp_users` by authenticated email. If no active ERP user is found, it checks `admin_users`. If neither path returns a privileged user, the function returns a fallback user:

```ts
role: "viewer"
```

That fallback role has `dashboard.view` but no app-level `*.view` permissions. The result is:

```ts
filterApplicationsByPermission(viewerUser) === []
```

This is especially likely when the signed-in production account email does not exactly match an active `erp_users.email` row or when the production Supabase project differs from the project containing the expected seed/admin rows.

### 4. Production Supabase Project or Migration Mismatch

Risk level: Medium to High

Exact files and functions:

- `src/integrations/supabase/client.ts`
  - reads `VITE_SUPABASE_URL`
  - reads `VITE_SUPABASE_PUBLISHABLE_KEY`
- `supabase/migrations/20260601142414_phase10_authorization_foundation.sql`
  - adds `roles` and `permissions` foundations to `erp_users`
- `supabase/migrations/20260603120000_phase24_multi_company_branch_enterprise_foundation.sql`
  - creates `company_memberships`
  - adds default company and branch context fields to `erp_users`

Evidence observed:

- `.env` and `.env.local` contain Supabase variables, with values intentionally not recorded in this report.
- `.env.example` includes `VITE_SUPABASE_URL` and an empty `VITE_SUPABASE_PUBLISHABLE_KEY`.
- The local Supabase CLI was not available, so live migration status could not be verified through the CLI.
- The desktop SQL export for `company_memberships` reported:

```text
ERROR: 42P01: relation "company_memberships" does not exist
```

This suggests the inspected Supabase database may not have the Phase 24 migration applied, or the SQL was run against a different project/schema than the repository expects.

Impact on `/apps`:

`/apps` does not query `company_memberships`, so this is not a direct app-card filter. The risk is indirect: a wrong or partially migrated production project can also be missing expected `erp_users`, `admin_users`, roles, permissions, or tenant context rows, causing the app to fall back to a low-permission user.

### 5. Missing Empty-State Diagnostics Hide the Failure

Risk level: Medium

Exact file:

- `src/pages/Apps.tsx`

Exact condition:

When:

```ts
applications.length === 0
```

the page renders no diagnostic message, no loading skeleton, and no permission explanation. This makes a permission problem look like a rendering or registry problem.

## Apps Registry Source

The app cards are defined statically in:

```text
src/features/erp/apps/applicationRegistry.ts
```

The exported registry is:

```ts
erpApplications
```

The registry contains 16 top-level app cards:

```text
website
commerce
crm
sales
invoicing
accounting
expenses
inventory
purchasing
production
quality
maintenance
repair
hr
reports
settings
```

There is no Supabase registry table involved in `/apps`.

The registry is filtered in:

```text
src/features/erp/shared/permissions.ts
```

with:

```ts
export function filterApplicationsByPermission(user: ERPUser | null) {
  return erpApplications.filter((app) => hasPermission(user, app.permissionKey));
}
```

## Permission Filtering

Relevant behavior:

```ts
if (!permission) return true;
if (!user) return false;
if (getUserRoles(user).includes("admin")) return true;
return getUserPermissions(user).includes(permission);
```

Important implication:

- `admin` sees all cards.
- `planner` should see many cards through mapped permissions.
- `operator` should see operational cards.
- `viewer` sees no top-level app cards because the app cards do not use `dashboard.view`.
- `null` user sees no cards.

The `/apps` route and app-card filters are not aligned. `/apps` allows `dashboard.view`, while cards require app-level permissions.

## Multi-Company Filtering

No direct multi-company filtering was found in `/apps`.

`/apps` does not query:

```text
company_memberships
companies
company_branches
default_company_id
default_branch_id
accessible_company_ids
accessible_branch_ids
```

No direct `return []` logic tied to company or branch context was found in the `/apps` card rendering path.

The multi-company risk is indirect. If Phase 24 tenant tables or user context columns are missing from the production Supabase project, later ERP screens may fail after navigation. For `/apps`, the more immediate issue remains user permission resolution.

## Supabase Calls on `/apps`

Before `Apps.tsx` renders, `ProtectedRoute` runs:

```text
settings.select("auth_enabled").eq("id", "1").maybeSingle()
supabase.auth.getSession()
admin_users.select("email, is_active").eq("email", session.user.email).eq("is_active", true).maybeSingle()
```

If an active admin user exists, it calls `getCurrentERPUser()`, which runs:

```text
supabase.auth.getUser()
erp_users.select("*").eq("email", authData.user.email).eq("is_active", true).limit(1).maybeSingle()
admin_users.select("id, email, role, is_active, created_at").eq("email", authData.user.email).eq("is_active", true).limit(1).maybeSingle()
```

After `Apps.tsx` mounts, it calls `getCurrentERPUserSafe()`, which repeats the ERP user lookup.

Supabase calls that do not run for `/apps` card loading:

```text
No app registry query
No company_memberships query
No company query
No branch query
No tenant-scoped module query
```

Silent failure path:

`getCurrentERPUserSafe()` catches errors and returns `null`. That makes:

```ts
filterApplicationsByPermission(null)
```

return an empty array.

## SQL Checks Performed

The following SQL-export evidence was reviewed from the desktop files referenced by the user.

### `erp_users`

Observed rows:

```text
info@dayandisli.com      role admin     active true
planlama@dayandisli.com  role planner   active true
operator@dayandisli.com  role operator  active true
```

Interpretation:

- `info@dayandisli.com` should see all app cards if that exact authenticated email resolves to the active ERP user row.
- `planlama@dayandisli.com` should not be empty under the current planner permission map.
- `operator@dayandisli.com` should not be fully empty under the current operator permission map.
- If production `/apps` is empty for one of these users, verify the authenticated email, Supabase project, and whether the runtime query sees the same rows.

### `company_memberships`

Observed export:

```text
ERROR: 42P01: relation "company_memberships" does not exist
```

Interpretation:

- The inspected database may not have the Phase 24 migration applied.
- This is not a direct `/apps` empty-card cause because `/apps` does not query `company_memberships`.
- It is still a production readiness risk for tenant-scoped ERP behavior.

Recommended SQL checks to run in the active production Supabase project:

```sql
select
  email,
  role,
  roles,
  permissions,
  is_active,
  default_company_id,
  default_branch_id
from public.erp_users
where lower(email) = lower('<signed-in-email>');
```

```sql
select
  email,
  role,
  is_active
from public.admin_users
where lower(email) = lower('<signed-in-email>');
```

```sql
select *
from public.company_memberships
where lower(email) = lower('<signed-in-email>');
```

```sql
select to_regclass('public.company_memberships') as company_memberships_table;
```

## Browser and Network Observations

Automated browser/network tracing was not completed because no browser automation dependency was available in the repository, and no dependency was added due to the no-code-change audit constraint.

Local observations from code-level tracing are sufficient to identify the `/apps` data path:

- App cards are not fetched from a network endpoint.
- Supabase is used only to resolve authentication and ERP user permissions before filtering the static registry.
- A network failure or silent ERP user lookup failure can result in `user === null`, which produces an empty card list.

No production browser console or deployed network log was available in this workspace during the audit.

## Production-Only Issue Review

Production-specific causes to verify:

1. `VITE_SUPABASE_URL` points to the intended Supabase project.
2. `VITE_SUPABASE_PUBLISHABLE_KEY` is present in the deployed environment.
3. The deployed project contains the expected `admin_users` and `erp_users` rows.
4. The signed-in email exactly matches an active ERP user or admin user.
5. Phase 10 and Phase 24 migrations are applied to the deployed database.
6. RLS does not block the authenticated user from reading their own `erp_users` row.

If the deployed environment points to a Supabase project that lacks the expected rows, `/apps` can resolve to a fallback or null ERP user and show no cards.

## Recommended Fix

Do not implement this fix yet. This report is diagnostic only.

Recommended implementation plan:

1. Add an explicit loading state in `src/pages/Apps.tsx` while `getCurrentERPUserSafe()` is pending.
2. Add a Turkish empty-state message for `applications.length === 0` that distinguishes missing permissions from loading failure.
3. Align `/apps` route access with app-card permissions:
   - either require at least one top-level app permission before allowing `/apps`,
   - or grant a visible default app/card to the lowest allowed role,
   - or redirect users with no app permissions to a Turkish access-denied page.
4. Add a small helper such as `hasAnyApplicationPermission(user)` so the route guard and card filtering share the same access model.
5. Verify production `erp_users`, `admin_users`, and Supabase environment variables against the active deployed project.
6. Apply missing non-destructive migrations to the correct Supabase project if `company_memberships` or Phase 10/24 user columns are missing.

## Risk Assessment

Overall risk level: High

Reason:

The current behavior can make a valid route appear broken without surfacing whether the problem is loading, auth, permissions, environment configuration, or migration drift. Because `/apps` is the ERP application hub, a header-only page blocks user navigation and obscures the actual failure mode.

Data leakage risk from this specific `/apps` issue is low because the filter removes cards rather than exposing unauthorized cards. Operational risk is high because users can be incorrectly locked out of ERP modules.

## Conclusion

The most likely root cause is not a missing static app registry. The registry exists and contains the expected cards.

The likely failure is permission resolution:

```text
/apps route permission: dashboard.view
app card permissions: app-specific *.view permissions
fallback/viewer permissions: dashboard.view only
result: header renders, cards array is empty
```

The recommended next step is to fix the loading and empty-permission states, then align the `/apps` route guard with the top-level application permission model. No fix was implemented during this audit.
