import { describe, expect, it } from "vitest";
import {
  classifyAttribute,
  classifyRelationship,
  computeGenuineExtras,
  type ColumnInfo,
} from "./three-way-comparator.ts";
import type { ResolvedField, ResolvedRelationship } from "./openapi-extractor.ts";

function field(overrides: Partial<ResolvedField>): ResolvedField {
  return {
    name: "x", openApiType: "string", format: null, enumValues: null, nullable: false,
    required: false, itemType: null, jsonPointer: "#/definitions/X/properties/x",
    provenance: "#/definitions/X/properties/x", insufficientSemantics: false,
    ...overrides,
  };
}

describe("three-way-comparator — attribute classification", () => {
  it("classifies EXACT_MATCH when types agree on both sides", () => {
    const f = field({ name: "name", openApiType: "string" });
    const result = classifyAttribute(f, [{ name: "name", pgType: "text" }], [{ name: "name", pgType: "text" }]);
    expect(result.classification).toBe("EXACT_MATCH");
  });

  it("classifies MISSING_MIGRATION_COLUMN when the migration has no such column", () => {
    const f = field({ name: "ghost", openApiType: "string" });
    const result = classifyAttribute(f, [], [{ name: "ghost", pgType: "text" }]);
    expect(result.classification).toBe("MISSING_MIGRATION_COLUMN");
  });

  it("classifies MISSING_PRODUCTION_COLUMN when production has no such column", () => {
    const f = field({ name: "ghost", openApiType: "string" });
    const result = classifyAttribute(f, [{ name: "ghost", pgType: "text" }], []);
    expect(result.classification).toBe("MISSING_PRODUCTION_COLUMN");
  });

  it("classifies MIGRATION_TYPE_MISMATCH when migration type family disagrees with the spec", () => {
    const f = field({ name: "amount", openApiType: "number" });
    const result = classifyAttribute(f, [{ name: "amount", pgType: "text" }], [{ name: "amount", pgType: "numeric" }]);
    expect(result.classification).toBe("MIGRATION_TYPE_MISMATCH");
  });

  it("classifies PRODUCTION_TYPE_MISMATCH when production type family disagrees with the spec", () => {
    const f = field({ name: "amount", openApiType: "number" });
    const result = classifyAttribute(f, [{ name: "amount", pgType: "numeric" }], [{ name: "amount", pgType: "text" }]);
    expect(result.classification).toBe("PRODUCTION_TYPE_MISMATCH");
  });

  it("does NOT treat OpenAPI format:date as an exact match against a timestamptz column for an ordinary (non-redirect) field (TASK 4 requirement)", () => {
    // Deliberately NOT one of the 3 documented redirect field names — the
    // date/timestamptz widening exception is scoped narrowly to the
    // code-evidenced redirects (see the redirect-specific test below), not
    // silently applied to every date-formatted field. An ordinary field
    // with a genuine family mismatch is conservatively flagged, not waved
    // through.
    const f = field({ name: "issued_on", openApiType: "string", format: "date" });
    const result = classifyAttribute(f, [{ name: "issued_on", pgType: "timestamptz" }], [{ name: "issued_on", pgType: "timestamptz" }]);
    expect(result.classification).not.toBe("EXACT_MATCH");
    expect(result.classification).toBe("MIGRATION_TYPE_MISMATCH");
  });

  it("classifies the actual created_at redirect (format:date -> source_created_at:timestamptz) as EXPLICIT_COMPATIBLE_REDIRECT with cited code evidence", () => {
    const f = field({ name: "created_at", openApiType: "string", format: "date" });
    const result = classifyAttribute(
      f,
      [{ name: "source_created_at", pgType: "timestamptz" }],
      [{ name: "source_created_at", pgType: "timestamptz" }],
    );
    expect(result.classification).toBe("EXPLICIT_COMPATIBLE_REDIRECT");
    expect(result.migrationColumn).toBe("source_created_at");
    expect(result.evidence).toContain("typed-row.ts");
  });

  it("classifies the archived redirect (boolean -> boolean) as EXPLICIT_COMPATIBLE_REDIRECT", () => {
    const f = field({ name: "archived", openApiType: "boolean" });
    const result = classifyAttribute(
      f,
      [{ name: "source_archived", pgType: "boolean" }],
      [{ name: "source_archived", pgType: "boolean" }],
    );
    expect(result.classification).toBe("EXPLICIT_COMPATIBLE_REDIRECT");
  });

  it("classifies a redirect as MISSING_MIGRATION_COLUMN when the target column doesn't exist at all", () => {
    const f = field({ name: "updated_at", openApiType: "string", format: "date" });
    const result = classifyAttribute(f, [], []);
    expect(result.classification).toBe("MISSING_MIGRATION_COLUMN");
  });

  it("classifies a genuinely incompatible redirect target type as INCOMPATIBLE_REDIRECT (narrowing timestamptz->date is lossy)", () => {
    const f = field({ name: "created_at", openApiType: "string", format: "date-time" });
    const result = classifyAttribute(
      f,
      [{ name: "source_created_at", pgType: "date" }],
      [{ name: "source_created_at", pgType: "date" }],
    );
    expect(result.classification).toBe("INCOMPATIBLE_REDIRECT");
  });
});

describe("three-way-comparator — relationship classification", () => {
  function rel(overrides: Partial<ResolvedRelationship>): ResolvedRelationship {
    return { key: "category", targetType: "item_categories", isArray: false, jsonPointer: "#/x", insufficientSemantics: false, ...overrides };
  }

  it("classifies FULLY_VERIFIED_RELATIONSHIP_BACKED_COLUMN when the expected column exists on both sides and spec provenance is complete", () => {
    const r = rel({});
    const result = classifyRelationship(r, [{ name: "category_parasut_id", pgType: "text" }], [{ name: "category_parasut_id", pgType: "text" }]);
    expect(result.classification).toBe("FULLY_VERIFIED_RELATIONSHIP_BACKED_COLUMN");
    expect(result.expectedInternalColumn).toBe("category_parasut_id");
  });

  it("uses the bare key (no _parasut_id suffix) as the expected column for array-cardinality relationships", () => {
    const r = rel({ key: "tags", isArray: true, targetType: "tags" });
    const result = classifyRelationship(r, [{ name: "tags", pgType: "jsonb" }], [{ name: "tags", pgType: "jsonb" }]);
    expect(result.expectedInternalColumn).toBe("tags");
    expect(result.classification).toBe("FULLY_VERIFIED_RELATIONSHIP_BACKED_COLUMN");
  });

  it("classifies JSON_ONLY_RELATIONSHIP when no column exists on either side", () => {
    const r = rel({ key: "phantom", targetType: "phantoms" });
    const result = classifyRelationship(r, [], []);
    expect(result.classification).toBe("JSON_ONLY_RELATIONSHIP");
  });

  it("classifies MISSING_MIGRATION_MAPPING when only production has the column", () => {
    const r = rel({ key: "phantom", targetType: "phantoms" });
    const result = classifyRelationship(r, [], [{ name: "phantom_parasut_id", pgType: "text" }]);
    expect(result.classification).toBe("MISSING_MIGRATION_MAPPING");
  });

  it("classifies MISSING_PRODUCTION_MAPPING when only migration has the column", () => {
    const r = rel({ key: "phantom", targetType: "phantoms" });
    const result = classifyRelationship(r, [{ name: "phantom_parasut_id", pgType: "text" }], []);
    expect(result.classification).toBe("MISSING_PRODUCTION_MAPPING");
  });

  it("classifies STRUCTURALLY_EXTRACTED_SEMANTICALLY_UNVERIFIED when OpenAPI provenance is incomplete (no target type), regardless of column presence", () => {
    const r = rel({ key: "mystery", targetType: null, insufficientSemantics: true });
    const result = classifyRelationship(r, [{ name: "mystery_parasut_id", pgType: "text" }], [{ name: "mystery_parasut_id", pgType: "text" }]);
    expect(result.classification).toBe("STRUCTURALLY_EXTRACTED_SEMANTICALLY_UNVERIFIED");
  });

  it("records the internal-mapping evidence as application-code-sourced, never claimed as OpenAPI-declared", () => {
    const r = rel({});
    const result = classifyRelationship(r, [{ name: "category_parasut_id", pgType: "text" }], [{ name: "category_parasut_id", pgType: "text" }]);
    expect(result.applicationMappingEvidence).toContain("typed-row.ts");
    expect(result.applicationMappingEvidence).not.toContain("OpenAPI-declared rule\"");
  });
});

describe("three-way-comparator — computeGenuineExtras (regression test for the audit-confirmed bug)", () => {
  it("does NOT classify a relationship-backed column as an extra (the exact bug found in the earlier scratchpad script)", () => {
    const officialAttrs = ["name"];
    const relColumns = ["category_parasut_id", "tags"]; // one _parasut_id, one array
    const envelope = ["id", "company_id"];
    const columns: ColumnInfo[] = [
      { name: "name", pgType: "text" },
      { name: "category_parasut_id", pgType: "text" },
      { name: "tags", pgType: "jsonb" },
      { name: "id", pgType: "uuid" },
      { name: "company_id", pgType: "uuid" },
    ];
    const extras = computeGenuineExtras(officialAttrs, relColumns, envelope, columns);
    expect(extras).toEqual([]);
  });

  it("does NOT classify a redirect-target column (source_created_at etc.) as an extra", () => {
    const columns: ColumnInfo[] = [{ name: "source_created_at", pgType: "timestamptz" }];
    const extras = computeGenuineExtras([], [], [], columns);
    expect(extras).toEqual([]);
  });

  it("DOES classify a column matching none of attributes/relationships/envelope/redirects as a genuine extra", () => {
    const columns: ColumnInfo[] = [{ name: "totally_unexplained_column", pgType: "text" }];
    const extras = computeGenuineExtras(["name"], ["category_parasut_id"], ["id"], columns);
    expect(extras).toEqual(["totally_unexplained_column"]);
  });

  it("reproduces the real-world case: 5 relationship-backed contacts columns are all correctly excluded from extras", () => {
    const officialAttrs = ["name", "email", "balance"];
    const relColumns = ["category_parasut_id", "contact_portal_parasut_id", "contact_people"];
    const envelope = ["id", "company_id", "parasut_id", "resource_type", "raw_payload"];
    const columns: ColumnInfo[] = [
      ...officialAttrs.map((n) => ({ name: n, pgType: "text" })),
      ...relColumns.map((n) => ({ name: n, pgType: n === "contact_people" ? "jsonb" : "text" })),
      ...envelope.map((n) => ({ name: n, pgType: "text" })),
    ];
    expect(computeGenuineExtras(officialAttrs, relColumns, envelope, columns)).toEqual([]);
  });
});
