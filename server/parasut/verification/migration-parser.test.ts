import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { columnsByTable, parseMigrationColumns } from "./migration-parser.ts";

describe("migration-parser — mechanical extraction", () => {
  it("parses columns from a synthetic CREATE TABLE block", () => {
    const sql = `create table parasut.widgets (
  id uuid primary key,

  -- attributes
  "name" text not null,
  "count" numeric,

  -- relationships
  "category_parasut_id" text,

  -- sync bookkeeping
  raw_payload jsonb not null
);`;
    const cols = parseMigrationColumns(sql);
    expect(cols).toEqual([
      { table: "widgets", name: "name", pgType: "text", kind: "attribute" },
      { table: "widgets", name: "count", pgType: "numeric", kind: "attribute" },
      { table: "widgets", name: "category_parasut_id", pgType: "text", kind: "relationship" },
    ]);
  });

  it("parses columns from a synthetic ALTER TABLE ADD COLUMN statement, classifying by naming convention", () => {
    const sql = `alter table parasut.widgets add column if not exists "name" text;
alter table parasut.widgets add column if not exists "owner_parasut_id" text;`;
    const cols = parseMigrationColumns(sql);
    expect(cols).toEqual([
      { table: "widgets", name: "name", pgType: "text", kind: "attribute" },
      { table: "widgets", name: "owner_parasut_id", pgType: "text", kind: "relationship" },
    ]);
  });

  it("groups columns by table", () => {
    const sql = `alter table parasut.a add column if not exists "x" text;
alter table parasut.b add column if not exists "y" numeric;`;
    const byTable = columnsByTable(parseMigrationColumns(sql));
    expect([...byTable.keys()].sort()).toEqual(["a", "b"]);
  });

  it("mechanically extracts exactly 401 columns from the real authoritative migration (sanity/regression check against the known-good Phase 1 figure, kept as comparison data only — never the OpenAPI source)", () => {
    const sql = readFileSync("supabase/migrations/20260723103525_parasut_full_apidocs_schema_expansion.sql", "utf8");
    const cols = parseMigrationColumns(sql);
    expect(cols.length).toBe(401);
  });
});
