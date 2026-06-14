# AUTH-1 — Unified ERP User Auth Preparation

## Objective

Prepare the migration from the current mixed authorization model to a single `public.erp_users` authority. This phase performs impact analysis only. It makes no application, database, migration, RLS, or production changes.

## Current Database Context

Production was manually reduced to:

- `admin_users`
- `allowed_emails`
- `erp_users`
- `machines`

The target is to retain `erp_users` as the only ERP authentication and authorization profile table. Supabase Auth remains responsible for password authentication and session issuance.

## Current Authentication Flow

### Email And Password Login

1. `src/pages/Login.tsx` calls `supabase.auth.signInWithPassword`.
2. Supabase Auth validates the email and password and returns an authenticated user.
3. The page reads `data.user.email`.
4. The page queries `admin_users` by exact email with `is_active = true`.
5. A query error or missing row causes immediate `signOut()` and the Turkish unauthorized message.
6. A successful lookup writes a non-blocking ERP audit event and navigates to `/apps`.

This makes `admin_users`, not `erp_users`, the current post-login gate.

### Session Restore

1. `ERPAuthProvider` reads the current session.
2. It requires `session.user.email`.
3. It repeats the active `admin_users` lookup.
4. Failure signs the user out and clears auth state.
5. Success calls `getCurrentERPUser()`.
6. Roles and permissions are derived from the returned ERP user.

### ERP User Resolution

`getCurrentERPUser()`:

1. Calls `supabase.auth.getUser()`.
2. Queries active `erp_users` by exact email.
3. Returns that row when found.
4. Otherwise queries active `admin_users`.
5. An `admin_users` match becomes an in-memory ERP administrator.
6. If neither row exists, it creates an in-memory active `viewer` fallback.

The viewer fallback means a Supabase Auth account can resolve to an ERP identity even without an `erp_users` row, although the separate `admin_users` gate currently prevents that fallback from reaching protected routes.

### Route Protection

`ProtectedRoute` consumes centralized provider state:

- loading state renders the existing Turkish loading screen;
- missing Supabase session redirects to `/login`;
- inactive/missing `admin_users` state redirects to `/login`;
- missing route permission redirects to `/apps`;
- otherwise protected content renders.

### Permission Resolution

`getUserRoles()` combines:

- `erp_users.role`
- `erp_users.roles`

`getUserPermissions()` combines:

- permissions mapped from every resolved role;
- explicit `erp_users.permissions`.

The `admin` role receives all permissions. `ProtectedRoute`, app cards, sidebars, and application shells consume the centralized `hasPermission()` callback.

## Target Authentication Flow

```text
Supabase Auth signInWithPassword
→ authenticated auth user
→ resolve one public.erp_users row
→ prefer auth_user_id = auth.uid()
→ allow normalized email bootstrap only while auth_user_id is null
→ require erp_users.is_active = true
→ load role, roles, and permissions
→ derive route and module permissions
→ allow protected navigation
```

Target behavior:

- No runtime query to `admin_users`.
- No runtime query or RPC dependency on `allowed_emails`.
- No implicit viewer profile for an unregistered Supabase Auth account.
- A missing or inactive `erp_users` row is unauthorized.
- Login and session restoration use the same ERP-user resolver.
- `erp_users` is the single source of ERP roles and permissions.

## Required `erp_users` Shape

Required columns:

| Column | Requirement |
| --- | --- |
| `id uuid` | Stable ERP profile primary key |
| `auth_user_id uuid null` | Supabase Auth linkage; nullable only during controlled transition |
| `email text` | Unique normalized login identity and bootstrap key |
| `full_name text null` | Display identity |
| `role text` | Primary compatibility role |
| `roles text[]` | Additional role assignments |
| `permissions text[]` | Explicit permission overrides/additions |
| `is_active boolean` | Mandatory authorization gate |
| `created_at timestamptz` | Audit timestamp |
| `updated_at timestamptz` | Audit timestamp |

Existing enterprise fields may remain:

- `department`
- `default_company_id`
- `default_branch_id`
- `accessible_company_ids`
- `accessible_branch_ids`

Recommended constraints:

- primary key on `id`;
- unique index on `lower(email)`;
- partial unique index on non-null `auth_user_id`;
- role validation aligned with `ERPRole`;
- non-null defaults for `roles`, `permissions`, and `is_active`.

Do not place passwords in `erp_users`. Passwords remain exclusively in Supabase Auth.

## Required RLS Design

### Browser Self-Read

The browser must be able to read only its own active ERP profile:

```sql
to authenticated
using (
  is_active = true
  and (
    auth_user_id = (select auth.uid())
    or (
      auth_user_id is null
      and lower(email) = lower((select auth.jwt() ->> 'email'))
    )
  )
)
```

The email fallback is transitional. AUTH-2 should link the matching row to `auth.uid()` after safe verification or provide an owner-run backfill step. The long-term policy should rely on `auth_user_id`.

### Administrative Management

Ordinary authenticated users must not read the full `erp_users` directory or modify roles. Management policies should require an active ERP profile with:

- `admin` in `role` or `roles`; or
- an explicit `users.edit` / `roles.manage` permission.

Avoid recursive RLS evaluation on `erp_users`. If admin management cannot be expressed without recursion, use a narrowly scoped private helper function with explicit `auth.uid()` checks, hardened search path, revoked `PUBLIC` execution, and only required grants. Do not introduce a public unrestricted `SECURITY DEFINER` function.

### Grants

- `authenticated`: SELECT only for self-resolution unless a separately reviewed management policy requires more.
- Browser INSERT/UPDATE/DELETE: denied by default.
- `service_role`: retained for trusted server administration.
- `anon`: no access.

## Runtime References Requiring AUTH-2 Changes

### Direct `admin_users` Dependencies

- `src/pages/Login.tsx`
  - Replace the post-login `admin_users` query with unified ERP-user resolution.
- `src/contexts/ERPAuthContext.tsx`
  - Remove `ActiveAdminUser`, `adminUser`, and the repeated admin lookup.
  - Derive active authorization from `erpUser?.is_active`.
  - Rename `isActiveAdmin` to a role-neutral state such as `isAuthorizedERPUser`, or preserve a temporary compatibility alias during one phase.
- `src/features/erp/shared/erpApi.ts`
  - Remove `admin_users` from database health requirements.
  - Remove the fallback query and implicit viewer fallback from `getCurrentERPUser()`.
- `supabase/functions/payment-refund/index.ts`
  - Replace the active `admin_users` lookup with an active `erp_users` authorization check using `auth_user_id` or normalized email plus required admin/finance permission rules.
- `src/integrations/supabase/types.ts`
  - Regenerate after the later database migration; do not hand-edit.

### Direct `allowed_emails` / `is_email_allowed` Dependencies

No current frontend login code uses these objects.

Historical/runtime database references remain in:

- `supabase/migrations/20251208092932_b7d45e49-989a-4ea1-a451-45de4f44dffd.sql`
- generated Supabase types
- legacy policies created by historical migrations for commerce tables

AUTH-2 must not rewrite old migration history. It should add a new migration that replaces effective policies still querying `allowed_emails`. Table removal belongs to a later owner-approved destructive phase.

### Direct `erp_users` Dependencies

- `src/features/erp/shared/erpApi.ts`
  - current-user resolution, user listing, creation, updates, and database health checks;
- `src/features/erp/shared/api/internal.ts`
  - default enterprise scope resolution;
- `src/features/erp/settings/ERPSettingsPage.tsx`
  - user, role, active-state, and membership administration;
- `src/features/erp/hr/EmployeesPage.tsx`
  - ERP-user assignment;
- `src/integrations/supabase/types.ts`
  - generated schema contract;
- ERP migrations for schema, authorization arrays, enterprise scope, and RLS.

## Migration And Policy References

### Auth Table Creation

- `20251208092932_b7d45e49-989a-4ea1-a451-45de4f44dffd.sql`
  - creates `allowed_emails` and `is_email_allowed`;
- `20260517110000_admin_users_auth.sql`
  - creates `admin_users`, seed, RLS, and authenticated SELECT;
- `20260517153000_erp_core_schema.sql`
  - creates `erp_users` and initial administrator profile.

### ERP Authorization Evolution

- `20260517230000_erp_phase2_phase3_readiness.sql`
- `20260518143000_erp_phase6_workflow_notifications.sql`
- `20260601142414_phase10_authorization_foundation.sql`
- `20260601143710_phase11_hr_organization_foundation.sql`
- `20260603120000_phase24_multi_company_branch_enterprise_foundation.sql`
- `20260603130000_phase26_supabase_production_security_governance.sql`

### Effective Policies Depending On `admin_users`

Historical migrations use active `admin_users` checks for:

- companies, branches, warehouses, and memberships;
- tenant administration;
- commerce and payment operations;
- Paraşüt mirror administrator reads;
- broad tenant security governance.

AUTH-2 must inventory the currently surviving production tables before applying policy replacements because production was manually reduced. It should modify only policies on objects that exist.

## Test Impact

Existing direct coverage:

- `src/components/ProtectedRoute.test.tsx`
  - currently models `isActiveAdmin`;
  - must be updated to role-neutral active ERP authorization.

Missing focused coverage to add in AUTH-2:

- login permits an active matching `erp_users` profile;
- login rejects missing ERP profile;
- login rejects inactive ERP profile;
- login signs out after failed authorization;
- session restore resolves the same ERP user;
- session restore rejects missing/inactive ERP user;
- `getCurrentERPUser()` has no `admin_users` fallback;
- no implicit viewer is created for unregistered Auth users;
- roles and explicit permissions are preserved;
- RLS permits self-read and denies another user's ERP row;
- `auth_user_id` match takes precedence over email bootstrap;
- null `auth_user_id` email bootstrap is case-insensitive and transitional.

## Risks

1. Existing `erp_users.auth_user_id` values may be null, requiring controlled linkage.
2. Exact email matching currently risks case differences; normalization must be consistent.
3. A broad `TO authenticated USING (true)` policy would expose every ERP profile and permission array.
4. Self-referencing admin policies on `erp_users` can cause infinite RLS recursion.
5. Removing the implicit viewer fallback changes behavior for Auth accounts without ERP profiles; this is intentional but must be tested.
6. `payment-refund` currently treats `admin_users` as its authorization authority and could break after table retirement.
7. Historical policies on surviving tables may still query `admin_users` or `allowed_emails`.
8. Generated Supabase types may continue exposing legacy tables until regenerated.
9. `isActiveAdmin` naming is embedded in route tests and may encourage admin-only semantics even though valid ERP roles include planners, operators, finance, and others.
10. Dropping legacy tables before all effective policies and functions are migrated would break authorization queries.

## AUTH-2 Implementation Plan

1. Create a new additive migration through the Supabase CLI.
2. Verify and normalize the required `erp_users` columns and constraints.
3. Add a partial unique index for non-null `auth_user_id` and a unique normalized email index.
4. Add the transitional own-active-row SELECT policy and explicit grants.
5. Add a safe owner-run linkage/backfill query that matches existing Auth users by normalized email without changing passwords.
6. Replace effective policies/functions on currently existing tables that query `admin_users` or `allowed_emails`.
7. Refactor `getCurrentERPUser()` into the only current-user resolver and remove all fallbacks.
8. Refactor `Login.tsx` and `ERPAuthProvider` to call that resolver.
9. Replace admin-specific provider state with active ERP-user authorization state.
10. Update `ProtectedRoute` and its tests.
11. Replace `payment-refund` authorization with `erp_users` role/permission checks.
12. Regenerate Supabase types.
13. Add focused auth resolver, login, provider, route, and RLS tests.
14. Validate locally before any production action.
15. Keep `admin_users` and `allowed_emails` tables intact until a later destructive cleanup phase receives explicit owner approval.

## Exact AUTH-2 Prompt

```text
Read and strictly follow docs/ENGINEERING_CONSTITUTION.md.

# PHASE AUTH-2 — IMPLEMENT UNIFIED ERP USER AUTHORIZATION

Use:

- docs/AUTH_1_UNIFIED_ERP_USER_AUTH_PREPARATION.md
- docs/phase-results/AUTH_1_RESULT.md

Objective:

Implement an additive migration and application refactor so `public.erp_users`
is the only runtime ERP authorization authority.

Requirements:

- Keep Supabase Auth for password authentication and sessions.
- Resolve authorization from one active `erp_users` row.
- Prefer `auth_user_id = auth.uid()`.
- Support normalized email matching only as a transitional bootstrap when
  `auth_user_id` is null.
- Require `erp_users.is_active = true`.
- Use `role`, `roles`, and `permissions` from `erp_users`.
- Remove runtime dependencies on `admin_users`, `allowed_emails`, and
  `is_email_allowed`.
- Remove the implicit viewer fallback for unregistered Auth users.
- Update Login, ERPAuthProvider, ProtectedRoute, `getCurrentERPUser()`,
  payment-refund authorization, focused tests, and generated Supabase types.
- Add narrow self-read RLS for `erp_users`; do not expose all ERP users to every
  authenticated account.
- Replace effective policies on existing tables that still query legacy auth
  tables.
- Do not drop `admin_users` or `allowed_emails`.
- Do not modify passwords or write directly to `auth.users`.
- Local validation first.
- No production access.
- No commit.
- No push.

Create:

- docs/AUTH_2_UNIFIED_ERP_USER_AUTH_IMPLEMENTATION.md
- docs/phase-results/AUTH_2_RESULT.md

Validation:

npm run typecheck
npm run test
npm run build
npx tsc -p tsconfig.server.json
focused auth and RLS tests
focused ESLint

Export exactly one package file under:

C:\Users\Bediz\Desktop\dayandisli_diff_files_all\auth_2\AUTH_2_PACKAGE.md
```

