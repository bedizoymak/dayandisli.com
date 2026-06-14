# Phase 10E — Local CLI Execution Envelope Diagnostics

## Objective

Compose the Phase 10D execution-envelope diagnostic adapter into the local Paraşüt sync CLI without changing sync behavior, aggregate reporting, or CLI failure propagation.

## Scope

- Reuse the existing CLI diagnostic writer.
- Keep execution-envelope diagnostics disabled by default.
- Enable diagnostics only when `PARASUT_EXECUTION_ENVELOPE_DIAGNOSTICS=1`.
- Deliver completed envelopes before aggregate report output.
- Deliver failed envelopes before existing CLI failure formatting and rethrow the original execution error.

## Composition

The local orchestration creates an execution composition from the validated plan and sequential resource executor. The composition is passed to the Phase 10C consumer with a Phase 10D diagnostic adapter configured from the injected environment and the existing diagnostic writer.

The adapter receives only the sanitized completed or failed envelope. It does not receive resource reports, setup state, credentials, metadata, payloads, or the retained original error.

## Output Ordering

Successful execution:

1. Complete all selected resources.
2. Deliver the completed envelope when diagnostics are enabled.
3. Return unchanged resource reports.
4. Write the existing aggregate report byte-for-byte.

Failed execution:

1. Stop after the first failed resource.
2. Deliver the failed envelope when diagnostics are enabled.
3. Rethrow the exact original execution error.
4. Preserve the existing CLI failure formatting path.

## Failure Isolation

Diagnostic writer failures are non-blocking. They do not alter successful reports and never replace the original execution error.

## Safety

- No live Supabase access.
- No live Paraşüt access.
- No production access.
- No Paraşüt writes.
- No database or migration changes.
- No secrets, payloads, request metadata, reports, setup state, or original error objects are written in envelope diagnostics.

## Validation

Repository type checking, tests, build, server TypeScript compilation, focused tests, and focused lint are required.

