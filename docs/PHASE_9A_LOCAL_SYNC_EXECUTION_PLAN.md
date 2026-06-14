# Phase 9A — Local Sync Execution Plan

## Objective

Define a pure, deterministic execution-plan contract for local Paraşüt mirror synchronization.

## Supported Resources

1. `contacts`
2. `products`
3. `sales_invoices`
4. `purchase_bills`
5. `accounts`

This sequence is the explicit default order.

## Contract

The plan contains only:

```text
mode
count
resources
```

Empty input creates a default plan. Non-empty input creates a custom plan that preserves request order.

Unknown and duplicate resources fail deterministically. Helpers never mutate input, environment state, or external systems.

## CLI Integration

The local CLI creates and validates the execution plan from command arguments before environment loading, Supabase CLI inspection, database setup, OAuth setup, or network activity.

The execution loop consumes `plan.resources`; sync behavior remains sequential and otherwise unchanged.

## Safety

- Pure helpers only
- No console output
- No credentials or payloads in plans
- No live Supabase or Paraşüt access in tests
- No migrations or domain mappings
- No production access
- No commit or push

## Validation

See `docs/phase-results/PHASE_9A_RESULT.md`.

## Next Recommended Phase

Phase 9B should verify execution-plan integration and fail-fast ordering at the local CLI boundary.
