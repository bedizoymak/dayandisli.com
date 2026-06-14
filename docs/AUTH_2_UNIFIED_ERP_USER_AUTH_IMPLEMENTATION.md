# AUTH-2 — Unified ERP User Authorization Implementation

## Objective

Make `public.erp_users` the only runtime ERP authorization authority while retaining Supabase Auth for credentials and sessions.

## Migration

Created:

`supabase/migrations/20260614061645_unified_erp_user_authorization.sql`

The migration:

- preserves `admin_users` and `allowed_emails`;
- verifies required `erp_users` authorization columns;
- links null `auth_user_id` values to matching `auth.users` rows by normalized email;
- adds unique non-null Auth UUID and normalized email indexes;
- adds narrow active self-read RLS;
- adds a private, hardened permission helper for ERP-user administration and legacy policy replacement;
- removes broad browser writes to `erp_users`;
- denies anonymous `erp_users` access;
- converts effective policies that reference legacy authorization objects to ERP-user authorization;
- revokes browser execution of `is_email_allowed`.

No password fields are introduced and `auth.users` is read only for linkage.

## Runtime Auth Flow

```text
Supabase Auth session
→ resolveERPUserForAuthUser()
→ first match active erp_users.auth_user_id
→ otherwise match active null-linked erp_users.email case-insensitively
→ reject missing or inactive ERP profile
→ derive roles and permissions
→ authorize protected routes
```

## Application Changes

### Login

`Login.tsx` now resolves an active ERP user after password authentication. Missing, inactive, or inaccessible ERP profiles retain the existing Turkish unauthorized message and cause sign-out.

### Session Provider

`ERPAuthProvider` no longer queries `admin_users`. It resolves the current ERP profile once and exposes `isAuthorizedERPUser`.

### Protected Routes

`ProtectedRoute` uses role-neutral ERP authorization state instead of admin-specific state. Existing permission checks remain unchanged.

### ERP API

`getCurrentERPUser()` delegates to the unified resolver. The `admin_users` fallback and implicit viewer fallback were removed.

### Payment Refund

The Edge Function resolves the active ERP profile by Auth UUID first and transitional email second. Refund review requires:

- `admin` role;
- `finance` role;
- `finance.edit`; or
- `system.manage`.

## Generated Supabase Types

The migration changes indexes, policies, grants, and a private helper but does not change the existing public `erp_users` row shape. The legacy tables remain physically present by requirement. Therefore the checked-in generated public types require no content change in this phase.

Types must be regenerated after local migration application when local Supabase is available, and again after any future AUTH-3 table removal.

## Tests

Added:

- `auth.test.ts`
  - UUID-first resolution;
  - transitional normalized email resolution;
  - missing-user rejection;
  - lookup error behavior.
- `authRls.test.ts`
  - active own-row policy;
  - anonymous/write denial;
  - legacy-table preservation and dependency revocation.
- `authRuntime.test.ts`
  - no runtime legacy authorization references;
  - role-neutral route state;
  - no implicit viewer.

Updated:

- `ProtectedRoute.test.tsx`
  - active and inactive ERP-user semantics.

## Local Database Validation

`supabase status -o json` was attempted before database execution. Docker Desktop was not running, so no local migration was applied. No remote or production fallback was attempted.

Static migration tests cover the required RLS and safety clauses. Local database application and authenticated RLS integration remain required before deployment.

## Safety

- No production access.
- No remote migration.
- No table drop.
- No password changes.
- No direct write to `auth.users`.
- No commit or push.
- Legacy tables remain physically present.

## AUTH-3 Readiness

AUTH-3 may remove legacy tables only after:

1. local migration application succeeds;
2. authenticated self-read and cross-user denial are integration-tested;
3. all effective policy expressions are verified free of legacy dependencies;
4. generated types are regenerated;
5. explicit owner approval is provided for destructive table removal.

