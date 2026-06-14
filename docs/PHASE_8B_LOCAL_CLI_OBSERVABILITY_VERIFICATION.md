# Phase 8B — Local CLI Observability Verification

## Objective

Verify deterministic composition of the local sync CLI and the Phase 8A observability adapter without live database or Paraşüt access.

## Design

The CLI now exports pure helpers for:

- composing a sync context with the local observability adapter
- formatting the existing aggregate report
- formatting sanitized CLI failures

The module executes `run()` only when launched as the main script. Importing it from tests performs no environment loading, Supabase CLI execution, database access, OAuth work, or network access.

## Coverage

- Disabled observability emits no lines.
- Enabled observability emits separate valid JSONL objects.
- Summary and error contracts retain their exact allowlists.
- Writer failures do not alter mocked sync results.
- Aggregate report formatting remains unchanged.
- CLI failure formatting removes secrets, personal data, request metadata, and raw payload markers.
- Supplied environment maps are not mutated.
- Formatting helpers do not write to stdout or stderr.

## Safety

- No live Supabase access
- No live Paraşüt access
- No database writes or logging
- No production access
- No migrations or domain mappings
- No commit or push

## Validation

See `docs/phase-results/PHASE_8B_RESULT.md`.

## Next Recommended Phase

Phase 8C should verify deterministic ordering and stream separation when observability JSONL and the final aggregate report share the CLI output writer.
