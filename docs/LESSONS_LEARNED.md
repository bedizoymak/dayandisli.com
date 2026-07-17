# Lessons Learned

## "Placeholder — adjust at approval time" comments are only useful if actually revisited at approval time

The forward migration shipped a real bug for weeks: `company_id references public.erp_users(id)`, flagged inline as a placeholder to fix "at approval time." When approval time actually came, the fix only happened because the pre-apply audit step re-queried production's actual schema (confirming no table anywhere uses a `company_id` FK) rather than trusting the file's own prior self-assessment that it was ready. **Takeaway:** a migration proposal that has sat untouched since being drafted should be re-derived against the live schema immediately before applying it, not just re-read — comments describing a known gap are a todo list, not evidence the gap was closed.

## Never assume production secrets exist just because a dependent feature works today

Assumed `PARASUT_CLIENT_ID`/`SECRET`/etc. would already be present as Supabase Edge Function secrets, since Paraşüt integration has been live in production for months. Checking `supabase secrets list` before deployment revealed they were never provisioned there at all — the existing read-only `parasut-api` function never calls Paraşüt itself (it only reads the mirror), and the actual sync runs via a local script reading `.env` directly. A new function that is the *first* to need a given credential in a *new* execution context (serverless vs. local script) cannot assume that credential is already available there just because the underlying integration has long been working elsewhere. **Takeaway:** for any new deployment target (a new Edge Function, a new host, a new CI runner), explicitly verify every credential it needs is provisioned *in that target's actual secret store*, not just that the credential exists somewhere in the project.

## A relative-import-depth bug can hide from one test runner and still be real

`supabase/functions/parasut-write-api/handlers.test.ts` had the exact same `../../server/...` vs `../../../server/...` off-by-one that was already fixed once in `index.ts` and `handlers.ts` — but it went unnoticed because Vitest (Node/Vite module resolution) resolved the wrong path silently in some way that still worked, while `deno check`'s strict URL-based resolution correctly failed on it. **Takeaway:** fixing an import-depth bug in sibling files doesn't guarantee every file with the same copy-pasted import block was fixed too — grep for the exact broken pattern across all files once it's found in one, and always run the stricter checker (here, `deno check`) as the final word for Deno-targeted files, never just the test runner that happens to pass.

## `@testing-library/react`'s auto-cleanup is not automatic in every Vitest setup

`vitest.config.ts` in this project does not set `test.globals: true`. `@testing-library/react`'s automatic `afterEach(cleanup)` registration depends on detecting a global test framework, and did not fire under this configuration — every `render()` call across every `it()` in a test file was accumulating in the same jsdom document instead of unmounting between tests. This was invisible in test files with only one `render()` per file, or where duplicate elements didn't happen to collide with a `getByRole` query, but surfaced as a "found multiple elements" error the moment a test file exercised a component with an interactive trigger button rendered fresh in multiple tests (`CreateCustomerDialog.test.tsx`).

**Fix:** added an explicit `afterEach(() => cleanup())` to `src/test/setup.ts`, project-wide — not just for the one failing file. Re-running the full suite afterward showed all 548 previously-passing tests still passed (the bug was latent, not previously triggered), confirming this was a correctness gap in every prior test file that happened not to collide on it.

**Takeaway:** when relying on a testing library's "automatic" behavior, verify the precondition that behavior depends on (here: `test.globals`) is actually met in this specific config, rather than assuming the library's defaults apply. A test failure that looks like a component bug ("why are there two buttons?") can be a test-harness gap instead — check whether the failure reproduces with a single, isolated render before assuming the component itself is wrong.

## `deno check` and `tsc --noEmit` do not check the same files

A missing `short_name` field in `ParasutContactCreateAttributes` was caught by `deno check` but not by `tsc --noEmit`, because this project's `tsc` configuration does not type-check everything under `server/` and `supabase/functions/` the way `deno check` does for Deno-targeted files.

**Takeaway:** for any file destined to run under Deno (Edge Functions and anything they import), `deno check` is not a redundant extra step alongside `tsc` — it is the only check that actually validates that file. Both must be run; neither substitutes for the other in this repository's current tooling setup.

## A capability model that starts as a boolean should be designed as a struct from the start

`ProviderCapabilities.contacts` began as a flat boolean (Phase 006) and had to become `{read, create, update, archive, delete}` once a write capability was introduced (Phase 007) — a breaking change requiring updates to every provider implementation and their tests. In hindsight, any capability flag that plausibly gates more than one verb (read vs. write vs. delete) should be modeled as a struct from its first introduction, even before a second verb is actually implemented, to avoid a breaking change later.

## Permission-string wildcards need an explicit test the moment a new capability is namespaced under an existing prefix

The `financePermissions` filter's `startsWith("accounting.")` match nearly caused a silent over-grant the moment `accounting.contacts.create` was added to the catalog (see `docs/RISK_REGISTER.md` R-002). This was caught by reading the permissions file before adding the new strings, not by a pre-existing test failing — there was no test at the time that would have caught it. **Takeaway:** whenever a new permission string is added under an existing prefix-matched namespace, check every wildcard/prefix filter that touches that namespace before assuming the addition is safe, and add a regression test for the specific new string, not just the general pattern.
