# /apps Empty State Fix Report

## Root Cause Confirmed

Confirmed root cause: `/apps` rendered before the ERP user resolution completed, then filtered the static app registry with `user === null`.

Before this fix, the first render executed:

```ts
filterApplicationsByPermission(null)
```

That returned:

```ts
[]
```

because every top-level ERP app has an app-specific permission key and `hasPermission(null, permission)` returns `false`.

The persistent empty-state cause remains permission resolution. If `getCurrentERPUserSafe()` resolves a fallback `viewer` user, or any user with only `dashboard.view`, the user can pass the `/apps` route guard but still see zero app cards because top-level app cards require permissions such as `crm.view`, `sales.view`, `inventory.view`, and `settings.view`.

## User Resolved

Production runtime verification is now exposed through temporary `/apps` console diagnostics.

The page logs:

```text
[Apps] ERP user resolved
```

with:

- resolved ERP user object
- resolved roles
- resolved permissions
- visible application count
- required top-level application permission keys
- missing top-level application permission keys

Local static SQL export previously showed these active `erp_users` records:

```text
info@dayandisli.com      admin
planlama@dayandisli.com  planner
operator@dayandisli.com  operator
```

Expected production behavior:

- `info@dayandisli.com` should resolve as `admin`.
- `planlama@dayandisli.com` should resolve as `planner`.
- `operator@dayandisli.com` should resolve as `operator`.
- Any authenticated email that does not match an active `erp_users` or active `admin_users` row can resolve as fallback `viewer`.

## Role Resolved

Role resolution uses:

```text
src/features/erp/shared/permissions.ts
getUserRoles(user)
```

The temporary debug log now prints the resolved role list.

Expected role-to-card behavior:

- `admin`: all 16 app cards
- `planner`: broad ERP app access
- `operator`: production and inventory-oriented app access
- `viewer`: 0 app cards under the current top-level registry permissions
- `null`: 0 app cards, now hidden behind the loading state while resolving

## Permissions Resolved

Permission resolution uses:

```text
src/features/erp/shared/permissions.ts
getUserPermissions(user)
FOUNDATION_ROLE_PERMISSION_MAP
```

The static registry uses these top-level app permission keys:

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

The temporary debug log now prints both the resolved permissions and the missing top-level app permissions.

## Visible Application Count Before Fix

Initial render before fix:

```text
0
```

Reason:

```ts
user === null
filterApplicationsByPermission(user) === []
```

Persistent count before fix for a fallback `viewer`:

```text
0
```

Reason:

```text
viewer permissions: dashboard.view
app card permissions: app-specific *.view
```

## Visible Application Count After Fix

Initial render after fix:

```text
Loading state, no empty card grid rendered
```

After ERP user resolution:

- `admin`: expected 16 visible applications
- `planner`: expected broad application visibility
- `operator`: expected operational application visibility
- `viewer`: 0 visible applications with Turkish diagnostic message
- `null`: 0 visible applications with Turkish diagnostic message

The exact production count is now logged in the browser console as:

```text
visibleApplicationsCount
```

## Files Modified

```text
src/pages/Apps.tsx
docs/apps-empty-state-fix-report.md
```

## Implementation Summary

`src/pages/Apps.tsx` now includes:

- ERP user loading state while `getCurrentERPUserSafe()` is pending
- Turkish loading text: `Yükleniyor...`
- Turkish empty-state diagnostics:
  - `Bu kullanıcıya atanmış ERP uygulaması bulunamadı.`
  - `Rol ve yetkilerinizi kontrol edin.`
- Turkish diagnostic details:
  - user email
  - role
  - permission count
  - visible application count
- temporary debug logging for:
  - resolved ERP user
  - resolved role
  - resolved permissions
  - visible application count
  - app permission keys
  - missing app permissions

## Production Verification

Production verification requires checking the deployed browser console and active Supabase project.

Runtime verification:

1. Sign in to production.
2. Open `/apps`.
3. Check the browser console for:

```text
[Apps] ERP user resolved
```

4. Confirm:

```text
user.email
roles
permissions
visibleApplicationsCount
missingApplicationPermissions
```

Supabase SQL verification for the authenticated production email:

```sql
select
  id,
  auth_user_id,
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
  id,
  email,
  role,
  is_active,
  created_at
from public.admin_users
where lower(email) = lower('<signed-in-email>');
```

Expected result:

- At least one active `erp_users` or `admin_users` record should exist for the authenticated email.
- If neither query returns a record, `getCurrentERPUserSafe()` can resolve a fallback `viewer`.
- If the resolved role is `viewer`, `filterApplicationsByPermission(user)` correctly returns an empty array under the current permission model.

## Why `filterApplicationsByPermission(user)` Returns Empty

It returns an empty array when the resolved user does not have any top-level app permission keys.

Exact condition:

```ts
erpApplications.every((app) => !hasPermission(user, app.permissionKey))
```

For `user === null`, this is true because `hasPermission()` returns `false`.

For `viewer`, this is true because `viewer` has:

```text
dashboard.view
```

but the registry requires:

```text
*.view
```

for each app.

## Remaining Notes

This fix does not grant new permissions and does not change tenant or RLS behavior. It makes the existing permission outcome visible and diagnosable.

The debug logging is intentionally temporary and should be removed after production confirmation.
