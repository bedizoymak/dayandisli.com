# Phase 8A Result

## Objective

Implement an opt-in local observability sink and CLI reporting adapter.

## Created Files

- `server/parasut/local-observability-sink.ts`
- `server/parasut/local-observability-sink.test.ts`
- `docs/PHASE_8A_LOCAL_OBSERVABILITY_SINK.md`
- `docs/phase-results/PHASE_8A_RESULT.md`

## Modified Files

- `scripts/run-parasut-sync-local.mjs`

## Behavior

- Disabled unless `PARASUT_SYNC_OBSERVABILITY=1`
- Emits compact JSONL through the CLI adapter
- Enforces exact summary and error allowlists
- Sanitizes identifiers and error fields
- Discards runtime metadata and payload properties
- Isolates writer failures

## Validation

- `npm run typecheck`: passed
- `npm run test`: passed, 12 files and 215 tests
- `npm run build`: passed with existing dependency and chunk-size warnings
- `npx tsc -p tsconfig.server.json`: passed
- Focused Vitest: passed, 3 files and 48 tests
- `npx eslint server/parasut scripts/run-parasut-sync-local.mjs`: passed

## Safety

- Production access: none
- Paraşüt requests in tests: none
- Paraşüt writes: none
- Database logging: none
- Migration changes: none
- Commit or push: not performed
