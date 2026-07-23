// Pure decision logic for "deletion reconciliation": deciding which
// previously-mirrored rows should be marked `source_archived = true` after a
// COMPLETE Paraşüt list snapshot, because Paraşüt's own GET /contacts (and
// the equivalent list endpoint for any other direct-list resource) simply
// omits a deleted record — confirmed empirically 2026-07-23 against a real
// deleted contact (GET .../contacts/{id} returned HTTP 404, not
// attributes.archived === true). Absence-based reconciliation is therefore
// the correct mechanism for this provider; requirement #16 (prefer an
// authoritative `archived` attribute when the provider supplies one) does
// not apply here because Paraşüt does not supply one for hard deletes.
//
// Deliberately has no knowledge of SQL, Postgres, or any particular
// database client — same convention as typed-row.ts. The caller
// (sync-base.ts) is responsible for actually issuing the scoped UPDATE.

export interface ReconciliationSkipDecision {
  skip: boolean;
  reason: string | null;
}

/**
 * Guards against ever mass-archiving a resource's rows because of a
 * transient or malformed run rather than a real, complete "this ID is
 * genuinely gone" signal (requirement #7/#8). Every one of these checks
 * must pass before the caller computes/applies any archival diff.
 */
export function evaluateReconciliationEligibility(input: {
  /** Whether syncCollection's page loop completed without throwing. */
  loopCompletedWithoutError: boolean;
  /** counters.errors from the just-finished run — per-resource upsert/DB errors. */
  errorCount: number;
  /** counters.pages — must be >= 1: "at least one valid API response was received". */
  pagesFetched: number;
  /** Number of resources of this exact resourceType observed in the completed run (excludes `included` sub-resources). */
  observedCount: number;
  /** How many rows are currently active (source_archived is not true) in the mirror for this exact company/resource scope, before this run. */
  previouslyActiveCount: number;
}): ReconciliationSkipDecision {
  if (!input.loopCompletedWithoutError) {
    return { skip: true, reason: "sync_run_did_not_complete" };
  }
  if (input.errorCount > 0) {
    return { skip: true, reason: "sync_run_had_errors" };
  }
  if (input.pagesFetched < 1) {
    return { skip: true, reason: "no_pages_fetched" };
  }
  // A "suspiciously empty" snapshot: the API returned nothing (or far less
  // than expected) for a resource that previously had real rows. This is far
  // more likely to be a transient provider/auth glitch that happens to
  // return an empty (but HTTP-200) page than a business fact ("the customer
  // deleted every contact today") — never mass-archive on that basis.
  if (input.observedCount === 0 && input.previouslyActiveCount > 0) {
    return { skip: true, reason: "suspiciously_empty_snapshot" };
  }
  return { skip: false, reason: null };
}

/**
 * Rows present (and active) in the mirror before this run, but absent from
 * the set actually observed in this complete run, are exactly the rows that
 * must be archived. Order-independent, dedupes, never returns an id that
 * doesn't come from `previouslyActiveIds` — the archival set can never
 * exceed what already existed in the mirror.
 */
export function computeIdsToArchive(
  previouslyActiveIds: readonly string[],
  observedIds: ReadonlySet<string> | readonly string[],
): string[] {
  const observed = observedIds instanceof Set ? observedIds : new Set(observedIds);
  const result = new Set<string>();
  for (const id of previouslyActiveIds) {
    if (!observed.has(id)) result.add(id);
  }
  return [...result];
}
