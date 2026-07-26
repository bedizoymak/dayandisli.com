// Phase 2A: pure, offline, read-only-safe derivation of typed rows from the
// canonical field-mapping registry. This module performs no database calls,
// no HTTP calls, has no environment dependency, and has no production side
// effects — see docs/parasut/PARASUT_PROFESSIONAL_INTEGRATION_MASTER_PLAN.md
// §15.4 for the Phase 2A/2B boundary this file must stay inside of.
//
// It is a thin driver over the already-existing, already-tested
// deriveTypedRow() (typed-row.ts) — it does not reimplement conversion
// logic, it only supplies the per-resource ColumnSpec[] from
// FIELD_MAPPING_REGISTRY instead of a hand-picked numeric-only subset.
//
// Do not import this module from server/parasut/upsert-resource.ts or any
// sync-*.ts wrapper in Phase 2A. Wiring it into the production write path
// is Phase 2B work and remains BLOCKED pending the production-write gate
// (master plan §15.3).

import type { JsonApiResource } from "./types.ts";
import { deriveTypedRow, type ColumnSpec, type ConversionWarning } from "./typed-row.ts";
import { FIELD_MAPPING_REGISTRY, REGISTRY_RESOURCES, type FieldMapping } from "./field-mapping-registry.ts";

export interface OfflineDerivationResult {
  resourceType: string;
  /** One key per registry field for this resource type — never a missing key. */
  values: Readonly<Record<string, unknown>>;
  warnings: readonly ConversionWarning[];
}

const COLUMN_SPECS_BY_RESOURCE: ReadonlyMap<string, readonly ColumnSpec[]> = (() => {
  const map = new Map<string, ColumnSpec[]>();
  for (const field of FIELD_MAPPING_REGISTRY) {
    const list = map.get(field.resource) ?? [];
    list.push({ name: field.expectedColumn, kind: field.expectedPgType });
    map.set(field.resource, list);
  }
  return map;
})();

export function columnSpecsForResource(resourceType: string): readonly ColumnSpec[] {
  return COLUMN_SPECS_BY_RESOURCE.get(resourceType) ?? [];
}

export function registryFieldsForResource(resourceType: string): readonly FieldMapping[] {
  return FIELD_MAPPING_REGISTRY.filter((f) => f.resource === resourceType);
}

/**
 * Pure derivation: given one API resource (or a stored raw_payload's `data`
 * object, which has the same JsonApiResource shape), returns every typed
 * value the canonical registry defines for its resource type. Does not
 * mutate `resource`. Deterministic — same input always produces the same
 * output, no I/O of any kind.
 */
export function deriveOfflineRow(resource: JsonApiResource): OfflineDerivationResult {
  const columns = columnSpecsForResource(resource.type);
  if (columns.length === 0) {
    return { resourceType: resource.type, values: Object.freeze({}), warnings: [] };
  }
  const { values, warnings } = deriveTypedRow(resource, [...columns]);
  return { resourceType: resource.type, values: Object.freeze({ ...values }), warnings };
}

/** Mechanical proof helper: total registry field count. */
export function registryFieldCount(): number {
  return FIELD_MAPPING_REGISTRY.length;
}

/** Mechanical proof helper: resources with zero registry fields (should be empty). */
export function resourcesWithZeroFields(): readonly string[] {
  return REGISTRY_RESOURCES.filter((r) => columnSpecsForResource(r).length === 0);
}
