# Phase 8C — Local CLI Output Stream Separation

## Objective

Separate local observability diagnostics from the final aggregate report through injected output channels while preserving the current CLI experience.

## Output Contract

- Diagnostic output contains compact observability JSONL.
- Report output contains the existing pretty-printed aggregate report.
- Both channels default to stdout for backward compatibility.
- Either channel can receive a future file writer through dependency injection.
- Diagnostic writer failures remain non-blocking.
- Report writer failures remain explicit and follow the CLI failure path.

## Changes

- Added pure output-channel composition.
- Added explicit aggregate report writing.
- Renamed the sync-context option to `diagnosticWriter`.
- Routed the live CLI through separate diagnostic and report writer references.
- Added deterministic routing, ordering, compatibility, and failure tests.

## Safety

- No live Supabase or Paraşüt access
- No database operations
- No production access
- No migrations or domain mappings
- No commit or push

## Validation

See `docs/phase-results/PHASE_8C_RESULT.md`.

## Next Recommended Phase

Phase 9A should define a local sync execution plan contract before adding scheduling or incremental behavior.
