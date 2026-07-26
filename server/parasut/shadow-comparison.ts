// Phase 2A: zero-write shadow comparison. Compares current live typed-column
// values against values the offline mapper (offline-mapper.ts) would derive
// from raw_payload, entirely in memory. This module performs NO database
// writes and does not define, import, or call any write-capable method
// (insert/update/delete/upsert/merge). It only consumes rows handed to it —
// how those rows were read (a SELECT) is the caller's responsibility, kept
// entirely outside this file so this file cannot itself issue any query.
//
// See docs/parasut/PARASUT_PROFESSIONAL_INTEGRATION_MASTER_PLAN.md §15.3 for
// the full production-write gate this utility is one input to. Passing a
// clean comparison here does NOT clear that gate by itself.

import type { JsonApiResource } from "./types.ts";
import { deriveOfflineRow, registryFieldsForResource } from "./offline-mapper.ts";

/** One live row's raw payload plus its current typed-column snapshot. Never
 * returned or logged by this module — only aggregate counts are. */
export interface ShadowComparisonRow {
  rawPayload: JsonApiResource;
  currentTyped: Readonly<Record<string, unknown>>;
}

export interface FieldComparisonAggregate {
  resource: string;
  attribute: string;
  totalRows: number;
  comparableRows: number;
  equalCount: number;
  mismatchCount: number;
  currentNullProposedNonNullCount: number;
  currentNonNullProposedNullCount: number;
  bothNullCount: number;
  normalizationOnlyDifferenceCount: number;
  notVerifiableCount: number;
  notVerifiableReason: string | null;
}

function isNullish(value: unknown): boolean {
  return value === null || value === undefined;
}

/**
 * Recursively sorts object keys so two structurally-identical objects with
 * different key insertion order canonicalize to the same string — while
 * array element order is always preserved (arrays are semantically
 * order-significant; objects are not). Same convention already established
 * by upsert-resource.ts's canonicalValue() for payload-hash comparison —
 * reused here for consistency, not reinvented.
 */
function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalize(item)]),
    );
  }
  return value;
}

function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

function normalizedEqual(a: unknown, b: unknown, kind: string): boolean {
  if (kind === "numeric") {
    const na = typeof a === "number" ? a : Number(a);
    const nb = typeof b === "number" ? b : Number(b);
    return Number.isFinite(na) && Number.isFinite(nb) && na === nb;
  }
  if (kind === "boolean") return Boolean(a) === Boolean(b);
  if (kind === "timestamptz" || kind === "date") {
    const da = new Date(String(a)).getTime();
    const db = new Date(String(b)).getTime();
    return Number.isFinite(da) && Number.isFinite(db) && da === db;
  }
  if (kind === "text") return String(a).trim() === String(b).trim();
  // jsonb: canonical (key-order-independent for objects, order-preserving
  // for arrays) structural comparison — see canonicalize() above.
  return canonicalStringify(a) === canonicalStringify(b);
}

/**
 * Pure aggregate comparison — no I/O, no mutation of `rows`, returns counts
 * only. Never includes an actual value from any row in its output.
 */
export function compareResourceRows(
  resource: string,
  rows: readonly ShadowComparisonRow[],
): FieldComparisonAggregate[] {
  const fields = registryFieldsForResource(resource);
  const results: FieldComparisonAggregate[] = [];

  for (const field of fields) {
    const agg: FieldComparisonAggregate = {
      resource,
      attribute: field.attribute,
      totalRows: rows.length,
      comparableRows: 0,
      equalCount: 0,
      mismatchCount: 0,
      currentNullProposedNonNullCount: 0,
      currentNonNullProposedNullCount: 0,
      bothNullCount: 0,
      normalizationOnlyDifferenceCount: 0,
      notVerifiableCount: 0,
      notVerifiableReason: null,
    };

    if (rows.length === 0) {
      agg.notVerifiableCount = 0;
      agg.notVerifiableReason = "ZERO_ROWS";
      results.push(agg);
      continue;
    }

    for (const row of rows) {
      if (row.rawPayload.type !== resource) {
        agg.notVerifiableCount++;
        agg.notVerifiableReason = "resource_type_mismatch_in_input_row";
        continue;
      }
      const proposed = deriveOfflineRow(row.rawPayload).values[field.expectedColumn];
      const current = row.currentTyped[field.expectedColumn];
      agg.comparableRows++;

      const currentNull = isNullish(current);
      const proposedNull = isNullish(proposed);

      if (currentNull && proposedNull) {
        agg.bothNullCount++;
      } else if (currentNull && !proposedNull) {
        agg.currentNullProposedNonNullCount++;
      } else if (!currentNull && proposedNull) {
        agg.currentNonNullProposedNullCount++;
      } else if (JSON.stringify(current) === JSON.stringify(proposed)) {
        agg.equalCount++;
      } else if (normalizedEqual(current, proposed, field.expectedPgType)) {
        agg.normalizationOnlyDifferenceCount++;
      } else {
        agg.mismatchCount++;
      }
    }
    results.push(agg);
  }
  return results;
}

/** Aggregate roll-up across every field in a set of per-field results — for
 * a whole-resource or whole-run summary, still counts only. */
export function summarizeAggregates(aggregates: readonly FieldComparisonAggregate[]) {
  return aggregates.reduce(
    (acc, a) => ({
      fields: acc.fields + 1,
      equal: acc.equal + a.equalCount,
      mismatch: acc.mismatch + a.mismatchCount,
      normalizationOnly: acc.normalizationOnly + a.normalizationOnlyDifferenceCount,
      currentNullProposedNonNull: acc.currentNullProposedNonNull + a.currentNullProposedNonNullCount,
      currentNonNullProposedNull: acc.currentNonNullProposedNull + a.currentNonNullProposedNullCount,
      bothNull: acc.bothNull + a.bothNullCount,
      notVerifiable: acc.notVerifiable + a.notVerifiableCount,
    }),
    { fields: 0, equal: 0, mismatch: 0, normalizationOnly: 0, currentNullProposedNonNull: 0, currentNonNullProposedNull: 0, bothNull: 0, notVerifiable: 0 },
  );
}
