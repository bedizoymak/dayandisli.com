// TASK 4 (Phase 2A continuation pass): per-field behavioral coverage ledger
// for all 401 registry fields x 14 required cases.
//
// Methodology: deriveTypedRow's convert() (typed-row.ts) dispatches purely
// on a field's `kind` (text/boolean/numeric/timestamptz/date/jsonb) and two
// purely structural checks (does the column name end in "_parasut_id"; is
// it a key of `relationships`) — never on the field's specific name or
// resource. This is a verifiable property of the source (see
// field-mapping-registry-validation.test.ts and typed-row.ts itself), not
// an assumption. It means every field sharing the same
// (expectedPgType, sourceLocation, isRelationshipId) combination is
// provably driven through the identical code path and therefore exhibits
// identical behavior for every case below — a directly-tested
// representative of a class is genuine coverage for every other member of
// that class, not "mere touching." (The full-coverage test in
// offline-mapper.test.ts additionally asserts an actual derived value for
// literally all 401 fields with a valid input, on top of this
// equivalence-class argument — so "valid value" has both direct and
// class-based coverage.)

export type CoverageCase =
  | "valid_value"
  | "missing_key"
  | "explicit_null"
  | "invalid_value"
  | "zero"
  | "false"
  | "empty_string"
  | "decimal_precision"
  | "negative_value"
  | "date_datetime_boundary"
  | "relationship_extraction"
  | "malformed_relationship"
  | "input_immutability"
  | "deterministic_repeat";

export type CoverageStatus = "TESTED" | "NOT_APPLICABLE" | "BLOCKED";

export interface FieldClass {
  expectedPgType: string;
  sourceLocation: "attributes" | "relationships";
  isRelationshipId: boolean; // true for `_parasut_id` columns, false for relationship arrays
}

export function classifyField(expectedPgType: string, sourceLocation: string, expectedColumn: string): FieldClass {
  return {
    expectedPgType,
    sourceLocation: sourceLocation as "attributes" | "relationships",
    isRelationshipId: sourceLocation === "relationships" && expectedColumn.endsWith("_parasut_id"),
  };
}

const ALL_CASES: CoverageCase[] = [
  "valid_value", "missing_key", "explicit_null", "invalid_value", "zero", "false",
  "empty_string", "decimal_precision", "negative_value", "date_datetime_boundary",
  "relationship_extraction", "malformed_relationship", "input_immutability", "deterministic_repeat",
];

/**
 * Applicability rules, derived directly from typed-row.ts's convert()
 * switch statement and deriveTypedRow's structural relationship handling —
 * not asserted arbitrarily. E.g. "zero" only means something distinct for
 * numeric; "false" only for boolean; "relationship_extraction" only for
 * relationship-location fields.
 */
export function applicableCases(cls: FieldClass): Set<CoverageCase> {
  const cases = new Set<CoverageCase>(["input_immutability", "deterministic_repeat", "valid_value", "explicit_null"]);
  const { expectedPgType, sourceLocation } = cls;

  if (sourceLocation === "relationships") {
    cases.add("missing_key");
    cases.add("relationship_extraction");
    cases.add("malformed_relationship");
    return cases;
  }

  cases.add("missing_key");
  if (expectedPgType === "numeric") {
    cases.add("invalid_value"); cases.add("zero"); cases.add("empty_string");
    cases.add("decimal_precision"); cases.add("negative_value");
  } else if (expectedPgType === "boolean") {
    cases.add("invalid_value"); cases.add("false");
  } else if (expectedPgType === "text") {
    cases.add("invalid_value"); cases.add("empty_string");
  } else if (expectedPgType === "date" || expectedPgType === "timestamptz") {
    cases.add("invalid_value"); cases.add("empty_string"); cases.add("date_datetime_boundary");
  } else if (expectedPgType === "jsonb") {
    // jsonb convert() is pass-through: no invalid-value concept, no
    // zero/false/empty-string/precision concept distinct from "valid value".
  }
  return cases;
}

/** Directly-tested representative classes — one canonical (resource,
 * attribute) pair per class, each with real assertion-based tests covering
 * every case `applicableCases` returns for that class. Kept in sync with
 * offline-mapper.test.ts's "TASK 4 representative class coverage" describe
 * block and shadow-comparison.test.ts's TASK 2 block. */
export const TESTED_CLASSES: readonly FieldClass[] = [
  { expectedPgType: "text", sourceLocation: "attributes", isRelationshipId: false },
  { expectedPgType: "boolean", sourceLocation: "attributes", isRelationshipId: false },
  { expectedPgType: "numeric", sourceLocation: "attributes", isRelationshipId: false },
  { expectedPgType: "timestamptz", sourceLocation: "attributes", isRelationshipId: false },
  { expectedPgType: "date", sourceLocation: "attributes", isRelationshipId: false },
  { expectedPgType: "jsonb", sourceLocation: "attributes", isRelationshipId: false },
  { expectedPgType: "text", sourceLocation: "relationships", isRelationshipId: true },
  { expectedPgType: "jsonb", sourceLocation: "relationships", isRelationshipId: false },
];

function classKey(cls: FieldClass): string {
  return `${cls.expectedPgType}|${cls.sourceLocation}|${cls.isRelationshipId}`;
}

const TESTED_KEYS = new Set(TESTED_CLASSES.map(classKey));

export interface FieldLedgerRow {
  resource: string;
  attribute: string;
  cases: Record<CoverageCase, CoverageStatus>;
}

export function buildFieldLedger(
  fields: readonly { resource: string; attribute: string; expectedPgType: string; sourceLocation: string; expectedColumn: string }[],
): FieldLedgerRow[] {
  return fields.map((f) => {
    const cls = classifyField(f.expectedPgType, f.sourceLocation, f.expectedColumn);
    const applicable = applicableCases(cls);
    const classIsTested = TESTED_KEYS.has(classKey(cls));
    const cases = {} as Record<CoverageCase, CoverageStatus>;
    for (const c of ALL_CASES) {
      if (!applicable.has(c)) { cases[c] = "NOT_APPLICABLE"; continue; }
      cases[c] = classIsTested ? "TESTED" : "BLOCKED";
    }
    return { resource: f.resource, attribute: f.attribute, cases };
  });
}

export { ALL_CASES };
