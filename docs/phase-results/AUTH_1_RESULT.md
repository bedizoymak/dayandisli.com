# AUTH-1 Result

## Status

Preparation and impact analysis completed. No application or database behavior changed.

## Current Authority

- Supabase Auth validates credentials.
- `admin_users` is the post-login and session-restoration gate.
- `erp_users` supplies the role and permission profile.
- `getCurrentERPUser()` falls back to `admin_users`, then to an implicit viewer.
- `allowed_emails` is legacy and is not used by the current login UI.

## Target Authority

`erp_users` becomes the sole ERP authorization source:

- active profile required;
- `auth_user_id` preferred;
- normalized email permitted only for transitional linkage;
- roles and permissions read from the same row;
- no legacy table fallback;
- no implicit viewer for unregistered Auth accounts.

## Primary AUTH-2 Changes

- Add narrow `erp_users` self-read RLS and identity constraints.
- Refactor Login and ERPAuthProvider.
- Simplify `getCurrentERPUser()`.
- Replace admin-specific route state.
- Update payment-refund authorization.
- Replace effective legacy-table policies on surviving objects.
- Add focused auth and RLS tests.
- Regenerate Supabase types.

## Validation

- `npm run typecheck`: passed.
- `npm run test`: passed, 19 files and 290 tests.
- `npm run build`: passed with existing dependency and bundle-size warnings.

## Safety

No database changes, migrations, production access, frontend behavior changes, table drops, commits, or pushes were performed.
