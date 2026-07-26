// Phase 1 permanent verification tooling: pure classification logic for the
// three-way comparison (OpenAPI vs migration SQL vs live schema).
//
// Corrects the audit-confirmed bug in the earlier scratchpad script: that
// script computed "extra migration/live columns" by excluding only
// attribute names and redirected names, never excluding relationship-backed
// column names — so it mislabeled all 67 relationship-backed columns as
// having "no corresponding official OpenAPI field." This module excludes
// relationship-backed columns from the extras calculation explicitly and
// separately (TASK 3/TASK 9 invariant #5).

import type { ResolvedField, ResolvedRelationship } from "./openapi-extractor.ts";

export interface ColumnInfo {
  name: string;
  pgType: string;
}

// created_at/updated_at/archived are official attribute names the mirror
// deliberately redirects to source_created_at/source_updated_at/source_archived
// — evidence: server/parasut/typed-row.ts SOURCE_TIMESTAMP_FIELDS (lines
// 37, 163-189) AND server/parasut/upsert-resource.ts's sourceTimestamp()/
// source_archived assignment, two independent code sites, not a guess.
const REDIRECT_TARGETS: Record<string, string> = {
  created_at: "source_created_at",
  updated_at: "source_updated_at",
  archived: "source_archived",
};

export type AttributeClassification =
  | "EXACT_MATCH"
  | "EXPLICIT_COMPATIBLE_REDIRECT"
  | "INCOMPATIBLE_REDIRECT"
  | "MISSING_MIGRATION_COLUMN"
  | "MISSING_PRODUCTION_COLUMN"
  | "MIGRATION_TYPE_MISMATCH"
  | "PRODUCTION_TYPE_MISMATCH"
  | "UNRESOLVED";

export interface AttributeComparisonResult {
  field: string;
  jsonPointer: string;
  openApiType: string;
  openApiFormat: string | null;
  classification: AttributeClassification;
  migrationColumn: string | null;
  migrationPgType: string | null;
  productionColumn: string | null;
  productionPgType: string | null;
  evidence: string;
}

function expectedPgFamily(field: ResolvedField): string {
  if (field.openApiType === "string") {
    if (field.format === "date-time") return "timestamptz";
    if (field.format === "date") return "date";
    return "text";
  }
  if (field.openApiType === "number" || field.openApiType === "integer") return "numeric";
  if (field.openApiType === "boolean") return "boolean";
  if (field.openApiType === "object" || field.openApiType === "array") return "jsonb";
  return "unknown";
}

function pgFamily(pgType: string): string {
  if (["numeric", "bigint", "integer", "smallint", "double precision"].includes(pgType)) return "numeric";
  if (pgType === "boolean") return "boolean";
  if (pgType === "timestamp with time zone" || pgType === "timestamptz") return "timestamptz";
  if (pgType === "date") return "date";
  if (pgType === "jsonb" || pgType === "json") return "jsonb";
  return "text";
}

/**
 * Redirect compatibility, TASK 4: does NOT auto-accept `format: date` as an
 * exact match against a `timestamptz` target. `date` and `timestamptz` are
 * different PG type families. A date-only string ("2026-06-01") is a valid,
 * safe, well-defined input to a timestamptz column (Postgres parses it as
 * midnight UTC) — this is a genuine, provable, lossless conversion, not a
 * guess and not something that requires reading business payload values —
 * so it is classified EXPLICIT_COMPATIBLE_REDIRECT, backed by the general
 * SQL-standard rule that `date` widens losslessly to `timestamptz`, not by
 * inspecting any actual stored value.
 */
function redirectCompatibility(field: ResolvedField, targetColumn: ColumnInfo | undefined): AttributeClassification {
  if (!targetColumn) return "MISSING_MIGRATION_COLUMN";
  const targetFamily = pgFamily(targetColumn.pgType);
  const sourceFamily = expectedPgFamily(field);
  if (sourceFamily === targetFamily) return "EXPLICIT_COMPATIBLE_REDIRECT";
  if (sourceFamily === "date" && targetFamily === "timestamptz") return "EXPLICIT_COMPATIBLE_REDIRECT";
  if (sourceFamily === "timestamptz" && targetFamily === "date") return "INCOMPATIBLE_REDIRECT"; // narrowing, lossy
  return "INCOMPATIBLE_REDIRECT";
}

export function classifyAttribute(
  field: ResolvedField,
  migrationColumns: readonly ColumnInfo[],
  productionColumns: readonly ColumnInfo[],
): AttributeComparisonResult {
  const expected = expectedPgFamily(field);
  const redirectTarget = REDIRECT_TARGETS[field.name];

  if (redirectTarget) {
    const migTarget = migrationColumns.find((c) => c.name === redirectTarget);
    const prodTarget = productionColumns.find((c) => c.name === redirectTarget);
    const migClass = redirectCompatibility(field, migTarget);
    const prodClass = redirectCompatibility(field, prodTarget);
    const classification: AttributeClassification =
      migClass === "EXPLICIT_COMPATIBLE_REDIRECT" && prodClass === "EXPLICIT_COMPATIBLE_REDIRECT"
        ? "EXPLICIT_COMPATIBLE_REDIRECT"
        : migClass === "MISSING_MIGRATION_COLUMN" || prodClass === "MISSING_MIGRATION_COLUMN"
          ? "MISSING_MIGRATION_COLUMN"
          : "INCOMPATIBLE_REDIRECT";
    return {
      field: field.name,
      jsonPointer: field.jsonPointer,
      openApiType: field.openApiType,
      openApiFormat: field.format,
      classification,
      migrationColumn: migTarget?.name ?? null,
      migrationPgType: migTarget?.pgType ?? null,
      productionColumn: prodTarget?.name ?? null,
      productionPgType: prodTarget?.pgType ?? null,
      evidence: `Redirected per server/parasut/typed-row.ts SOURCE_TIMESTAMP_FIELDS + upsert-resource.ts. Spec declares openApiType=${field.openApiType}/format=${field.format ?? "none"} (family=${expected}); target column family=${migTarget ? pgFamily(migTarget.pgType) : "MISSING"}.`,
    };
  }

  const mig = migrationColumns.find((c) => c.name === field.name);
  const prod = productionColumns.find((c) => c.name === field.name);

  let classification: AttributeClassification;
  if (!mig) classification = "MISSING_MIGRATION_COLUMN";
  else if (!prod) classification = "MISSING_PRODUCTION_COLUMN";
  else if (pgFamily(mig.pgType) !== expected) classification = "MIGRATION_TYPE_MISMATCH";
  else if (pgFamily(prod.pgType) !== expected) classification = "PRODUCTION_TYPE_MISMATCH";
  else classification = "EXACT_MATCH";

  return {
    field: field.name,
    jsonPointer: field.jsonPointer,
    openApiType: field.openApiType,
    openApiFormat: field.format,
    classification,
    migrationColumn: mig?.name ?? null,
    migrationPgType: mig?.pgType ?? null,
    productionColumn: prod?.name ?? null,
    productionPgType: prod?.pgType ?? null,
    evidence: `Direct name match against migration/production columns. Expected PG family from spec: ${expected}.`,
  };
}

export type RelationshipClassification =
  | "FULLY_VERIFIED_RELATIONSHIP_BACKED_COLUMN"
  | "JSON_ONLY_RELATIONSHIP"
  | "MISSING_MIGRATION_MAPPING"
  | "MISSING_PRODUCTION_MAPPING"
  | "AMBIGUOUS_MAPPING"
  | "STRUCTURALLY_EXTRACTED_SEMANTICALLY_UNVERIFIED";

export interface RelationshipComparisonResult {
  key: string;
  jsonPointer: string;
  targetType: string | null;
  isArray: boolean;
  expectedInternalColumn: string;
  migrationColumn: string | null;
  migrationPgType: string | null;
  productionColumn: string | null;
  productionPgType: string | null;
  classification: RelationshipClassification;
  openApiProvenanceComplete: boolean;
  applicationMappingEvidence: string;
}

/**
 * TASK 5: the internal DB mapping (column-naming convention) is authorized
 * by repository code (typed-row.ts's `_parasut_id` suffix rule), NOT by the
 * OpenAPI spec — the spec cannot and does not dictate internal column
 * names. Both provenance layers are recorded separately and explicitly,
 * never conflated as "the API says so."
 */
export function classifyRelationship(
  rel: ResolvedRelationship,
  migrationColumns: readonly ColumnInfo[],
  productionColumns: readonly ColumnInfo[],
): RelationshipComparisonResult {
  const expectedColumn = rel.isArray ? rel.key : `${rel.key}_parasut_id`;
  const mig = migrationColumns.find((c) => c.name === expectedColumn);
  const prod = productionColumns.find((c) => c.name === expectedColumn);
  const openApiProvenanceComplete = Boolean(rel.targetType) && !rel.insufficientSemantics;

  let classification: RelationshipClassification;
  if (!openApiProvenanceComplete) {
    classification = "STRUCTURALLY_EXTRACTED_SEMANTICALLY_UNVERIFIED";
  } else if (!mig && !prod) {
    classification = "JSON_ONLY_RELATIONSHIP";
  } else if (!mig) {
    classification = "MISSING_MIGRATION_MAPPING";
  } else if (!prod) {
    classification = "MISSING_PRODUCTION_MAPPING";
  } else {
    classification = "FULLY_VERIFIED_RELATIONSHIP_BACKED_COLUMN";
  }

  return {
    key: rel.key,
    jsonPointer: rel.jsonPointer,
    targetType: rel.targetType,
    isArray: rel.isArray,
    expectedInternalColumn: expectedColumn,
    migrationColumn: mig?.name ?? null,
    migrationPgType: mig?.pgType ?? null,
    productionColumn: prod?.name ?? null,
    productionPgType: prod?.pgType ?? null,
    classification,
    openApiProvenanceComplete,
    applicationMappingEvidence:
      "Column-naming convention (`<key>_parasut_id` for single, `<key>` for array) is application code (server/parasut/typed-row.ts's relationship handling), not an OpenAPI-declared rule — OpenAPI specs do not define internal DB schema. Recorded as a separate provenance layer.",
  };
}

/**
 * TASK 9 invariant #5/#6: computes migration/live "extras" with relationship-
 * backed columns AND redirect-target columns explicitly excluded — the exact
 * bug found in the earlier scratchpad script, fixed here structurally so it
 * cannot recur silently.
 */
export function computeGenuineExtras(
  officialAttributeNames: readonly string[],
  relationshipExpectedColumns: readonly string[],
  envelopeColumnNames: readonly string[],
  columns: readonly ColumnInfo[],
): string[] {
  const redirectTargets = new Set(Object.values(REDIRECT_TARGETS));
  const excluded = new Set([
    ...officialAttributeNames,
    ...relationshipExpectedColumns,
    ...envelopeColumnNames,
    ...redirectTargets,
  ]);
  return columns.filter((c) => !excluded.has(c.name)).map((c) => c.name);
}
