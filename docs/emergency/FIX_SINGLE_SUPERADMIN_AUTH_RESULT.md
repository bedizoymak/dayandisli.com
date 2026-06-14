# Emergency Single Superadmin Auth Result

## Root Cause

The production Supabase Auth account exists for:

`bedizoymak@eclipsemuhendislik.com`

Production has no matching `public.erp_users` row. The current login flow successfully authenticates the password, then calls `resolveERPUserForAuthUser()`. That resolver first searches active `erp_users.auth_user_id`, then allows normalized email bootstrap only for an existing null-linked ERP row. Both searches return no row, producing the existing Turkish unauthorized message.

Production evidence:

- matching `auth.users` rows: `1`;
- matching `erp_users` rows: `0`;
- active ERP users: `3`;
- AUTH-2 and AUTH-4 migrations: recorded remotely;
- self-read policy: present;
- management policy: present;
- legacy tables and function: absent.

Therefore the failure is not caused by legacy frontend queries, missing migrations, policy recursion, stale generated types, or email case normalization. The immediate database cause is the missing ERP authorization profile and Auth UUID linkage.

## Exact Code Path

1. `Login.tsx` calls `supabase.auth.signInWithPassword`.
2. Supabase Auth returns the production Auth user.
3. `resolveERPUserForAuthUser()` queries active `erp_users` by `auth_user_id`.
4. It then queries active null-linked `erp_users` by normalized email.
5. No row exists, so Login signs out and displays `Bu e-posta sistemde yetkili değil.`
6. `ERPAuthProvider` uses the same resolver through `getCurrentERPUser()`.

No active runtime file queries `admin_users`, `allowed_emails`, or `is_email_allowed`.

## Repair File

`docs/emergency/FIX_SINGLE_SUPERADMIN_AUTH.sql`

The repair:

- refuses execution unless exactly one matching Auth user exists;
- deactivates every other ERP user;
- clears conflicting use of the target Auth UUID;
- upserts the target ERP profile;
- sets `role = 'admin'`;
- sets `roles = array['admin']`;
- sets `permissions = array['system.manage']`;
- sets `is_active = true`;
- links `auth_user_id` to the existing Auth user;
- recreates UUID-only self-read RLS;
- retains permission-based ERP-user management;
- revokes browser writes;
- refuses completion if legacy objects or policies remain;
- verifies exactly one active ERP user before commit.

No password is stored or modified. The script does not write to `auth.users`.

## Code Changes

No frontend or runtime code change is required. Current source already uses `erp_users` exclusively and implements UUID-first resolution.

## Manual Execution

1. Open the production Supabase project `dayandisli.com`.
2. Open SQL Editor.
3. Review `docs/emergency/FIX_SINGLE_SUPERADMIN_AUTH.sql`.
4. Run the entire file once.
5. Confirm every value in the final JSON verification object is `true`.
6. Sign out any existing browser session.
7. Clear site storage or use a private browser window.
8. Sign in with `bedizoymak@eclipsemuhendislik.com`.

If the script raises an exception, the transaction rolls back. Do not bypass the exception; investigate the reported failed gate.

## Deployment Requirement

The checked source is correct, but the production website must be rebuilt and redeployed if its deployed bundle predates AUTH-2. A stale bundle may still query `admin_users`, which AUTH-4 removed.

After SQL repair:

1. build the current repository;
2. deploy the current `dist/erp/` bundle;
3. invalidate CDN/browser cache if applicable;
4. retest login in a private window.

## Safety

- Production was inspected read-only.
- The repair SQL was created but not automatically executed.
- No password or Auth user was modified.
- No extra auth table was created.
- No commit or push occurred.
