# Phase 10 Authorization, Roles and Access Control Report

## Objective

Phase 10 establishes the ERP authorization foundation before HR, reporting, e-commerce, and website administration work continues. The implementation centralizes permission definitions, adds role and permission management surfaces, connects the Applications Hub and ERP navigation to those permissions, and introduces route-level protection without replacing the existing Supabase identity model.

## Permission Architecture

The permission architecture is centralized in `src/features/erp/shared/permissions.ts`.

Implemented capabilities:

- User permissions are resolved from the existing `erp_users` record.
- A user can have one primary `role`, multiple `roles`, and direct `permissions`.
- Permission actions are modeled around `view`, `create`, `edit`, `delete`, `export`, and `manage`.
- Applications, modules, navigation entries, and protected routes read from the same helper layer.
- Admin users retain full access through the `admin` role.

Core helpers added or expanded:

- `getUserRoles(user)`
- `getUserPermissions(user)`
- `hasPermission(user, permission)`
- `hasAnyPermission(user, permissions)`
- `hasRole(user, roles)`
- `canManageERP(user)`
- `canManageUsers(user)`
- `filterApplicationsByPermission(user)`
- `filterModulesByPermission(modules, user)`
- `getRequiredPermissionForPath(pathname)`
- `getCurrentERPUserSafe()`

The permission catalog is built from application registry permissions plus explicit system-level permissions for users, roles, permissions, reports, finance, production, inventory, purchasing, HR, and quality.

## Role Architecture

The ERP role type now supports the required foundation roles:

- `admin` - Süper Yönetici
- `planner` - Yönetici
- `sales` - Satış
- `finance` - Finans
- `operator` - Üretim
- `purchasing` - Satın Alma
- `warehouse` - Depo
- `hr` - İnsan Kaynakları
- `quality` - Kalite
- `viewer` - Misafir

Role labels remain Turkish in the UI. Code identifiers remain English.

Role permission mappings are foundation-level only. They are intentionally simple and designed to support future multi-role, department, approval, record-level, and audit-log expansion.

## Supabase Mapping

Existing Supabase identity structures are reused:

- Supabase Auth remains the authentication source.
- `admin_users` remains the superadmin/admin gate used by the existing protected route.
- `erp_users` remains the ERP profile and authorization record.

No second authentication architecture was created.

### Migration

Created migration:

- `supabase/migrations/20260601142414_phase10_authorization_foundation.sql`

The migration extends `public.erp_users`:

- Adds `roles text[] not null default '{}'`
- Adds `permissions text[] not null default '{}'`
- Backfills `roles` from the existing primary `role`
- Adds indexes for `role`, `roles`, and `permissions`

This keeps the current `role` field compatible while preparing for multi-role users and direct permission overrides.

## ERP API Updates

Added user management API helpers in `src/features/erp/shared/erpApi.ts`:

- `listERPUsers()`
- `createERPUser(payload)`
- `updateERPUser(id, payload)`

These functions use the existing Supabase client and `erp_users` table. They do not create auth users directly; user identity provisioning remains tied to the existing Supabase Auth model.

## User Management Structure

The ERP settings page now includes management tabs:

- Kullanıcılar
- Roller
- Yetkiler

Implemented in `src/features/erp/settings/ERPSettingsPage.tsx`.

### Kullanıcılar

Implemented:

- Create ERP user profile
- Activate/deactivate user
- Assign primary role
- Add direct permission
- Clear direct permissions
- Search users
- Filter by role

### Roller

Implemented:

- Lists all foundation roles
- Shows Turkish role labels
- Shows role descriptions
- Shows mapped permission counts
- Marks roles as ready

### Yetkiler

Implemented:

- Lists permission catalog using Turkish area/action labels
- Avoids exposing English permission keys as primary visible UI
- Shows each permission as a defined system capability

## Applications Integration

Updated:

- `src/pages/Apps.tsx`
- `src/features/erp/apps/ApplicationShellPage.tsx`
- `src/features/erp/layout/ERPSidebar.tsx`
- `src/config/erpModules.ts`

Applications Hub behavior:

- Loads the current ERP user.
- Displays only applications permitted for that user.
- Keeps all visible text Turkish.

Application shell behavior:

- Redirects unauthorized users safely back to `/apps`.
- Filters visible modules by module permission.
- Shows a Turkish empty state if no module is available.

Sidebar behavior:

- Filters ERP modules by `requiredPermission`.
- Keeps navigation labels Turkish.

## Route Protection Strategy

`src/components/ProtectedRoute.tsx` now performs two checks:

1. Existing admin authentication check using the current admin flow.
2. ERP permission check based on `getRequiredPermissionForPath(location.pathname)`.

Unauthorized access redirects safely to `/apps`. Unauthenticated access still redirects to `/login`.

The route map covers:

- `/apps`
- `/apps/:appId`
- CRM routes
- Sales routes
- Inventory routes
- Purchasing routes
- Production routes
- Finance routes
- Quality routes
- Maintenance routes
- Reports routes
- HR routes
- Settings/admin routes

## Implemented Screens

Created or extended:

- Applications Hub permission filtering
- Application shell permission filtering
- ERP sidebar permission filtering
- Settings > Kullanıcılar
- Settings > Roller
- Settings > Yetkiler

No business workflow UI was changed beyond access visibility and management screens.

## Files Modified

- `src/components/ProtectedRoute.tsx`
- `src/config/erpModules.ts`
- `src/features/erp/apps/ApplicationShellPage.tsx`
- `src/features/erp/layout/ERPSidebar.tsx`
- `src/features/erp/settings/ERPSettingsPage.tsx`
- `src/features/erp/shared/erpApi.ts`
- `src/features/erp/shared/permissions.ts`
- `src/features/erp/shared/types.ts`
- `src/pages/Apps.tsx`
- `supabase/migrations/20260601142414_phase10_authorization_foundation.sql`
- `docs/phase-10-authorization-roles-access-control-report.md`

## Validation

Command run:

```bash
npm run build
```

Result:

- Build succeeded.
- Vite reported existing large chunk warnings.
- Vite reported an existing `pdfjs-dist` eval warning.
- Browserslist data warning remains informational.

## Risks

- Frontend permission checks improve UX and route safety but are not a complete database security boundary.
- RLS policies still need a dedicated pass to enforce the same access model at the Supabase layer.
- `createERPUser()` creates an ERP profile record, not a Supabase Auth user. Auth user provisioning still needs an admin-safe process before broad rollout.
- Existing single-superadmin assumptions may need hardening when multiple real users are introduced.
- Direct permission assignment is intentionally simple; future screens may need grouping, bulk assignment, and audit history.
- Permission route matching is path-based. Future route additions must add explicit permission mappings.

## Recommendations

- Add Supabase RLS policies for ERP tables using server-side authorization rules.
- Introduce an audit log for user, role, and permission changes.
- Add admin-safe Supabase Auth invitation or user creation flow.
- Add tests for route-to-permission mapping and role permission resolution.
- Consider a dedicated permission matrix editor once roles stabilize.
- Keep permission labels centralized so future modules inherit Turkish UI labels consistently.

## Proposed Phase 11 Scope

Recommended Phase 11: HR and Organization Foundation.

Suggested scope:

- HR application screens for employees, departments, positions, attendance, leave, and onboarding foundation.
- Organization structure that can later feed department permissions.
- User-to-employee linking.
- Audit log foundation for authorization and HR changes.
- RLS planning for ERP user, HR, and permission-sensitive records.

