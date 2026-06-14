# Emergency Authorization Restore Result

## Root Cause

Supabase Auth password verification succeeds first. The application then performs a browser-side authorization lookup against `public.admin_users`.

The read-only production schema dump showed:

- `public.admin_users` exists.
- RLS is enabled on `public.admin_users`.
- The required authenticated SELECT policy is missing.
- `public.erp_users` exists.
- RLS is enabled on `public.erp_users`.
- The authenticated SELECT policy required by the current application is missing.

With RLS enabled and no applicable SELECT policy, the login authorization query cannot return the active administrator row. `Login.tsx` treats either a query error or no row as unauthorized, signs the user out, and displays `Bu e-posta sistemde yetkili değil.`

## Exact Code Path

1. `src/pages/Login.tsx` calls `supabase.auth.signInWithPassword`.
2. After successful authentication, it reads `data.user.email`.
3. It queries `admin_users` for matching `email` and `is_active = true`.
4. Any query error or missing row triggers sign-out and the unauthorized message.
5. `ERPAuthProvider` repeats the same active `admin_users` lookup for session resolution.
6. It then calls `getCurrentERPUser()`.
7. `getCurrentERPUser()` queries active `erp_users` by email.
8. If no ERP row exists, it falls back to the active `admin_users` row and creates an in-memory admin identity linked to the current Supabase Auth user UUID.
9. `ProtectedRoute` requires both an authenticated session and an active administrator.

Authorization linkage is email-based. The current code does not require `erp_users.auth_user_id` or a direct foreign key to `auth.users` for login. The dump stores `auth_user_id` as null for the restored ERP administrator. No password or `auth.users` modification is required.

## Objects Restored

- `public.admin_users`
  - Exact dump-compatible columns.
  - Two active administrator rows from the full dump.
  - Unique email identity.
  - RLS enabled.
  - Authenticated SELECT policy.
  - Authenticated SELECT grant.
- `public.erp_users`
  - Exact dump-compatible columns.
  - The active `info@dayandisli.com` ERP administrator row from the full dump.
  - Unique email identity.
  - RLS enabled.
  - Authenticated SELECT policy restored from the repository's ERP authorization migration pattern.
  - Authenticated SELECT grant.

`allowed_emails`, `is_email_allowed`, and `company_memberships` are not part of the current login path. The full dump contains no `company_memberships` rows. They are intentionally excluded from this minimum repair.

## SQL File

`docs/emergency/RESTORE_AUTHORIZATION_FROM_DUMP.sql`

## Manual Execution Instructions

1. Open the Supabase Dashboard for production project `meauutjsnnggzcigyvfp`.
2. Open SQL Editor and create a new query.
3. Review `docs/emergency/RESTORE_AUTHORIZATION_FROM_DUMP.sql`.
4. Run the complete script once.
5. Confirm the transaction commits successfully.
6. Review the verification result sets at the end of the script.
7. Sign out of the ERP completely, clear the stale browser session if necessary, and sign in again with an administrator email that already exists in Supabase Auth.
8. Confirm `/apps` loads and protected application routes recognize the administrator role.

## Verification SQL

The repair file includes queries that verify:

- Both dump administrator emails exist and are active.
- The ERP administrator profile exists and has the `admin` role.
- SELECT policies exist for `admin_users` and `erp_users`.
- The `authenticated` role has table SELECT privileges.

For an authenticated API-level verification, sign in normally and confirm these client queries return without error:

```ts
supabase
  .from("admin_users")
  .select("email, is_active")
  .eq("email", signedInEmail)
  .eq("is_active", true)
  .maybeSingle();

supabase
  .from("erp_users")
  .select("*")
  .eq("email", signedInEmail)
  .eq("is_active", true)
  .maybeSingle();
```

## Current Versus Dump Comparison

| Object | Full dump | Current production schema | Repair |
| --- | --- | --- | --- |
| `admin_users` table | Present | Present, compatible columns | Preserve/create if absent |
| Active admin rows | Two rows | Not safely inspectable through schema-only audit | Idempotent upsert from dump |
| `admin_users` SELECT policy | Present | Missing | Restore |
| `erp_users` table | Present | Present, compatible columns | Preserve/create if absent |
| ERP admin row | Present | Not safely inspectable through schema-only audit | Idempotent upsert from dump |
| `erp_users` SELECT policy | Required by code and repository migrations | Missing | Restore |
| `company_memberships` | Present, zero rows | Missing from current schema dump | Excluded |
| `allowed_emails` | Present | Present with a later manually changed shape | Excluded from current login repair |

## Rollback Notes

The repair is additive and uses idempotent upserts. It does not drop tables, delete rows, or modify `auth.users`.

If rollback is required, remove only the two policies created by this repair:

```sql
drop policy if exists "Allow admin_users read for authenticated"
  on public.admin_users;

drop policy if exists "erp_users_select_authenticated"
  on public.erp_users;
```

Do not delete restored administrator rows until the owner confirms which Supabase Auth identities must retain access. Removing the policies will reproduce the login failure.

## Validation

- `npm run typecheck`: passed.
- `npm run test`: passed, 19 files and 290 tests.
- `npm run build`: passed with existing dependency and bundle-size warnings.
- Focused code-path search: passed.
- Read-only linked production schema dump: completed; no database changes were made.
