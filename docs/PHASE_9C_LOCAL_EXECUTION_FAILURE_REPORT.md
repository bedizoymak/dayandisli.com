# Phase 9C — Local Execution Failure Report

## Objective

Define a pure, deterministic, sanitized failure-report contract for local execution-plan orchestration.

## Contract

The report contains only:

- execution status and plan mode
- planned and completed counts
- completed resources
- failed resource
- ordered resources not attempted
- sanitized error code, message, and retryability

## Behavior

The helper accepts an existing execution plan and explicit failure state. It does not execute resources, catch orchestration failures, alter CLI behavior, or perform output.

Completed and remaining resource arrays are detached from caller-owned input. Remaining resources preserve plan order and exclude the failed resource.

Error fields are normalized through the existing observability error-summary contract. Runtime properties outside the allowlist are discarded.

## Safety

- No setup or context state in reports
- No credentials, metadata, or payloads
- No console output
- No environment mutation
- No live Supabase or Paraşüt access
- No migrations or domain mappings
- No production access
- No commit or push

## Validation

See `docs/phase-results/PHASE_9C_RESULT.md`.

## Next Recommended Phase

Phase 10A should define a deterministic local execution result envelope for successful and failed orchestration without changing CLI UX.
