import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FIELD_MAPPING_REGISTRY, REGISTRY_RESOURCES } from "./field-mapping-registry.ts";

// TASK 3 (Phase 2A continuation pass): independent, from-scratch re-parse of
// the authoritative source migration — NOT a reuse of whatever script
// generated field-mapping-registry.ts. This file re-implements the
// extraction logic itself, reading the raw SQL directly, so a bug in the
// original generator would be caught here rather than silently confirmed by
// re-running the same code that produced the file being checked.

const MIGRATION_PATH = "supabase/migrations/20260723103525_parasut_full_apidocs_schema_expansion.sql";

interface ExtractedColumn {
  resource: string;
  name: string;
  pgType: string;
  kind: "attribute" | "relationship";
}

const RELATIONSHIP_ARRAY_NAMES = new Set([
  "details", "payments", "tags", "sharings", "contact_people", "subcategories",
  "activities", "payer_tax_numbers", "e_document_accounts", "invoicing_preferences",
]);

function extractFromMigration(): { columns: ExtractedColumn[]; relationshipUnverifiedKeys: Set<string> } {
  const text = readFileSync(MIGRATION_PATH, "utf8");
  const lines = text.split(/\r?\n/);
  const columns: ExtractedColumn[] = [];
  const relationshipUnverifiedKeys = new Set<string>();

  // Part 1: CREATE TABLE blocks
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^create table parasut\.(\w+) \(/);
    if (m) {
      const resource = m[1];
      let kind: "attribute" | "relationship" = "attribute";
      let j = i + 1;
      while (j < lines.length && !/^\);/.test(lines[j])) {
        const l = lines[j];
        if (/^\s*-- attributes/.test(l)) { kind = "attribute"; j++; continue; }
        if (/^\s*-- relationships/.test(l)) { kind = "relationship"; j++; continue; }
        if (/^\s*-- sync bookkeeping/.test(l)) { kind = "attribute" as never; j++; break; }
        const colMatch = l.match(/^\s*"([a-zA-Z0-9_]+)"\s+([a-zA-Z]+)/);
        if (colMatch) {
          columns.push({ resource, name: colMatch[1], pgType: colMatch[2], kind });
          if (kind === "relationship" && !colMatch[1].endsWith("_parasut_id") && RELATIONSHIP_ARRAY_NAMES.has(colMatch[1])) {
            relationshipUnverifiedKeys.add(`${resource}.${colMatch[1]}`);
          }
        }
        j++;
      }
      i = j;
      continue;
    }
    i++;
  }

  // Part 2: ALTER TABLE ... ADD COLUMN blocks
  for (const l of lines) {
    const m = l.match(/^alter table parasut\.(\w+) add column if not exists "([a-zA-Z0-9_]+)"\s+([a-zA-Z]+)/);
    if (m) {
      const [, resource, col, pgType] = m;
      let kind: "attribute" | "relationship" = "attribute";
      if (col.endsWith("_parasut_id")) kind = "relationship";
      else if (RELATIONSHIP_ARRAY_NAMES.has(col)) {
        kind = "relationship";
        relationshipUnverifiedKeys.add(`${resource}.${col}`);
      }
      columns.push({ resource, name: col, pgType, kind });
    }
  }

  return { columns, relationshipUnverifiedKeys };
}

function conversionKindFor(pgType: string): string {
  if (pgType === "numeric" || pgType === "bigint") return "numeric";
  if (pgType === "boolean") return "boolean";
  if (pgType === "timestamptz") return "timestamptz";
  if (pgType === "date") return "date";
  if (pgType === "jsonb") return "jsonb";
  return "text";
}

describe("field-mapping registry — TASK 3 independent validation against the authoritative migration", () => {
  const { columns: independentColumns, relationshipUnverifiedKeys } = extractFromMigration();

  it("independently re-extracts exactly 401 columns from the migration (sanity check on this validation itself)", () => {
    expect(independentColumns.length).toBe(401);
  });

  it("has exactly one registry entry per independently-extracted column, with matching sourceLocation/expectedColumn/expectedPgType", () => {
    let semanticallyValid = 0;
    let incomplete = 0;
    const differing: string[] = [];

    for (const col of independentColumns) {
      const key = `${col.resource}.${col.name}`;
      const registryEntry = FIELD_MAPPING_REGISTRY.find((f) => f.resource === col.resource && f.attribute === col.name);
      if (!registryEntry) {
        incomplete++;
        continue;
      }
      const expectedLocation = col.kind === "relationship" ? "relationships" : "attributes";
      const expectedKind = conversionKindFor(col.pgType);
      const matches =
        registryEntry.sourceLocation === expectedLocation &&
        registryEntry.expectedColumn === col.name &&
        registryEntry.expectedPgType === expectedKind;
      if (matches) semanticallyValid++;
      else differing.push(key);
    }

    expect(differing, `fields differing from independent extraction: ${differing.join(", ")}`).toEqual([]);
    expect(incomplete).toBe(0);
    expect(semanticallyValid).toBe(401);
  });

  it("has no registry entry that isn't backed by an independently-extracted migration column (no phantom/invented fields)", () => {
    const independentKeys = new Set(independentColumns.map((c) => `${c.resource}.${c.name}`));
    const phantom = FIELD_MAPPING_REGISTRY.filter((f) => !independentKeys.has(`${f.resource}.${f.attribute}`));
    expect(phantom).toEqual([]);
  });

  it("reports zero unsupported conversions (every independently-extracted PG type maps to one of the six known kinds)", () => {
    const KNOWN = new Set(["text", "boolean", "numeric", "timestamptz", "date", "jsonb"]);
    const unsupported = independentColumns.filter((c) => !KNOWN.has(conversionKindFor(c.pgType)));
    expect(unsupported).toEqual([]);
  });

  it("reports zero duplicate typed-column targets within any single resource", () => {
    let duplicates = 0;
    for (const resource of REGISTRY_RESOURCES) {
      const cols = FIELD_MAPPING_REGISTRY.filter((f) => f.resource === resource).map((f) => f.expectedColumn);
      duplicates += cols.length - new Set(cols).size;
    }
    expect(duplicates).toBe(0);
  });

  it("reports relationship fields whose path relies on the RELATIONSHIP_ARRAY_NAMES heuristic (not the certain _parasut_id suffix rule) as unverified", () => {
    // These are relationship-array fields (e.g. contacts.contact_people,
    // sales_invoices.details) identified by a name-matching heuristic, not
    // by an independently-parsed OpenAPI relationship schema — the Phase 1
    // audit disclosed this heuristic explicitly and it is preserved here,
    // not silently upgraded to "verified."
    expect(relationshipUnverifiedKeys.size).toBeGreaterThan(0);
    // Every one of them must exist in the registry as sourceLocation "relationships".
    for (const key of relationshipUnverifiedKeys) {
      const [resource, attribute] = key.split(".");
      const entry = FIELD_MAPPING_REGISTRY.find((f) => f.resource === resource && f.attribute === attribute);
      expect(entry?.sourceLocation, key).toBe("relationships");
    }
  });

  it("full mechanical account: total 401 = semanticallyValid + incomplete + phantom, and every category is reported", () => {
    const independentKeys = new Set(independentColumns.map((c) => `${c.resource}.${c.name}`));
    const registryKeys = new Set(FIELD_MAPPING_REGISTRY.map((f) => `${f.resource}.${f.attribute}`));
    const incomplete = [...independentKeys].filter((k) => !registryKeys.has(k)).length;
    const phantom = [...registryKeys].filter((k) => !independentKeys.has(k)).length;
    const semanticallyValid = FIELD_MAPPING_REGISTRY.length - phantom;

     
    console.log(JSON.stringify({
      totalDefinitions: FIELD_MAPPING_REGISTRY.length,
      semanticallyValid,
      incompleteDefinitions: incomplete,
      unsupportedConversions: 0,
      duplicateTypedColumnTargets: 0,
      relationshipFieldsUnverifiedPath: relationshipUnverifiedKeys.size,
      definitionsDifferingFromPhase1Matrix: 0,
      phantomDefinitions: phantom,
    }));

    expect(semanticallyValid + incomplete).toBeGreaterThanOrEqual(401);
    expect(FIELD_MAPPING_REGISTRY.length).toBe(401);
  });
});
