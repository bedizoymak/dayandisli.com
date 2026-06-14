# Phase 8A — Local Observability Sink

## Objective

Add an opt-in, local CLI observability adapter that emits sanitized JSON Lines without changing core synchronization behavior.

## Scope

- Local CLI adapter only
- Disabled by default
- Enabled only by `PARASUT_SYNC_OBSERVABILITY=1`
- Existing `SyncSummary` and `ErrorSummary` contracts
- Failure-isolated line output

## Design

`createLocalObservabilitySink()` accepts an environment map and an injected line writer. It always returns a valid sink. When the opt-in value is absent, its methods are no-ops.

When enabled, the sink reconstructs output objects from explicit allowlists. Runtime-only properties such as `request_metadata` and `raw_payload` are discarded even if a caller bypasses TypeScript.

Summary identifiers and all error text pass through the existing observability sanitizer. Each emitted object is serialized to compact JSON followed by one newline.

## CLI Integration

The local sync script creates the sink after local target validation and injects it into `SyncContext`. No core helper writes to the console.

## Safety

- No external logging service
- No database logging
- No production access
- No Paraşüt test requests or writes
- No migrations or domain mappings
- No secrets in exported artifacts

## Validation

See `docs/phase-results/PHASE_8A_RESULT.md`.

## Remaining Risks

- The CLI's normal final aggregate report remains separate from observability JSONL.
- Future contract fields require an explicit allowlist update and regression coverage.

## Next Recommended Phase

Phase 8B should verify local CLI observability composition without live Paraşüt or database access.
