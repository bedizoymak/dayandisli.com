# Phase 5 — Supabase CRUD Health Check and ERP API Split Preparation

## Objective

Verify that the local environment can safely exercise CRUD operations against a dedicated Supabase smoke-test table, then prepare a low-risk domain boundary for the monolithic ERP API without changing business behavior.

## Starting Findings

- TypeScript, tests, and production builds pass.
- The repository has automated permission and protected-route regression tests.
- Live Supabase CRUD and RLS behavior has not been verified.
- `src/features/erp/shared/erpApi.ts` remains a large cross-domain service.

## Files Inspected

- `.env` and `.env.local` presence and variable names only
- `.gitignore`
- `package.json`
- `src/integrations/supabase/client.ts`
- `src/lib/supabase.ts`
- `src/features/erp/shared/erpApi.ts`
- `src/features/erp/shared/types.ts`
- `supabase/migrations/`
- `supabase/functions/`
- Phase 1 through Phase 4 stabilization documentation
- Current Supabase changelog and CLI help

## Supabase Environment Detection

Local environment files are ignored by Git. Values were not printed or copied.

| Variable | Found | Notes |
|---|---:|---|
| `VITE_SUPABASE_URL` | Yes | Present in `.env` and `.env.local`; value redacted |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Present in `.env` and `.env.local`; value redacted |
| `VITE_SUPABASE_ANON_KEY` | No | Publishable key is used instead |
| `SUPABASE_ACCESS_TOKEN` | No | Not present in project files or the current process |
| `SUPABASE_PROJECT_ID` | No | No project reference is stored under this name |
| `VITE_SUPABASE_PROJECT_ID` | No | No project reference is stored under this name |
| `SUPABASE_SMOKE_TEST_EMAIL` | No | Optional dedicated test-user credential |
| `SUPABASE_SMOKE_TEST_PASSWORD` | No | Optional dedicated test-user credential |

The frontend client uses only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.

## Supabase Auth Status

- Supabase CLI is installed at version `2.101.0`; the CLI reported `2.106.0` as available.
- `supabase projects list` succeeded, confirming CLI authentication.
- Two projects are accessible, but neither is marked as linked to this workspace.
- No project reference was guessed or written.
- `supabase status` attempted to inspect the local Docker stack and failed because Docker Desktop's Linux engine was unavailable.
- The installed CLI does not provide the prompt's `supabase db remote list` command; CLI help was used to verify available commands.

To link the intended project after confirming its reference:

```bash
supabase link --project-ref <project-ref>
```

## Supabase CRUD Health Check

- Added `scripts/supabase-crud-health-check.mjs`.
- The script reads ignored local env files, uses only publishable/anon client credentials, and rejects service-role variables.
- It refuses to run unless `RUN_SUPABASE_CRUD_HEALTH_CHECK=1`.
- It touches only `public.smoke_test`.
- It supports optional dedicated-user authentication through `SUPABASE_SMOKE_TEST_EMAIL` and `SUPABASE_SMOKE_TEST_PASSWORD`.
- It never prints credentials, tokens, or row contents.
- It attempts insert, select, update, delete, deletion confirmation, and best-effort cleanup.
- `ALLOW_CREATE_SMOKE_TEST_TABLE=1` does not silently create schema. Without a reviewed linked-CLI method, it prints the required SQL and exits non-zero.

Observed runs:

1. Without opt-in: refused as designed and exited `1`.
2. With opt-in and local publishable credentials: connected to the Data API, found `public.smoke_test`, and failed insert with PostgreSQL code `42501` because anonymous writes violate RLS.

Full CRUD was not claimed. A dedicated authenticated smoke user is required to test the current RLS policy.

## RLS / Permission Observations

- The table exists and is exposed through the Data API because the response came from PostgreSQL RLS rather than a missing-table/schema-cache error.
- Anonymous insert is denied, which is the safer default.
- No policy or grant was changed.
- The reviewed setup SQL grants CRUD only to `authenticated`, enables RLS, and limits the proposed policy to rows whose names start with `crud-health-`.
- Supabase announced on April 28, 2026 that new public tables are no longer automatically exposed to the Data API. Future smoke-table creation must include explicit table and sequence grants together with RLS and policies.

## ERP API Split Preparation

Created `src/features/erp/shared/api/README.md` with the target domain modules and extraction rules.

No production CRM functions were moved. The CRM block is contiguous, but it depends on private shared helpers for tenant scope, ownership, numbering, audits, errors, and result construction. Moving it now would require duplicating behavior or broadening internal APIs before live authenticated CRUD is healthy. The README records the safe dependency order for a later extraction.

## Changes Made

- Added the safe local CRUD health-check script and package command.
- Added guarded, review-first smoke-table SQL guidance.
- Added the ERP API domain split directory and CRM extraction plan.
- Added this factual environment, CLI, RLS, and validation record.

## Validation Results

- `npm run supabase:crud-check`: refused without opt-in as designed.
- Opted-in CRUD check: reached the existing table but stopped at anonymous insert due to RLS code `42501`.
- `node --check scripts/supabase-crud-health-check.mjs`: passed.
- `git diff --check`: passed.
- `npm run typecheck`: passed.
- `npm run test`: passed, 109 tests across 2 files.
- `npm run build`: passed with the existing Browserslist, PDF.js `eval`, and large-chunk advisories.
- `npm run lint`: failed on the unchanged known baseline of 32 errors and 40 warnings.

## Manual QA Checklist

- Run the CRUD script without opt-in and confirm it refuses to execute.
- Confirm no credentials or access tokens are printed.
- Run the opted-in health check with local frontend-safe Supabase credentials.
- Confirm the script touches only `public.smoke_test`.
- Confirm one uniquely named row is inserted, selected, updated, deleted, and absent afterward.
- Confirm failures exit non-zero and preserve actionable, redacted output.
- Confirm existing ERP imports continue to resolve after API split preparation.
- Confirm TypeScript, tests, and production build pass.

## Remaining Risks

- Full CRUD remains unverified until dedicated authenticated smoke-user credentials are provided locally.
- The workspace is not linked to a confirmed Supabase project.
- Docker Desktop is unavailable, so the local Supabase stack cannot be inspected.
- The installed Supabase CLI is five patch releases behind the reported current version.
- Existing migrations include broad historical authenticated policies; this phase did not audit or modify production-table RLS.
- `erpApi.ts` remains monolithic; only the split boundary and dependency order were prepared.

## Next Recommended Phase

Configure a dedicated non-production smoke user, link the confirmed Supabase project, complete authenticated CRUD verification, and then extract shared API internals followed by the CRM domain in a separately reviewed change.
