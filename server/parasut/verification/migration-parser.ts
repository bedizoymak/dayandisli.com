// Phase 1 permanent verification tooling: mechanical, from-scratch parser
// for the authoritative migration SQL. Never treated as the official API
// source — this is comparison side A only.

export interface MigrationColumn {
  table: string;
  name: string;
  pgType: string;
  kind: "attribute" | "relationship";
}

const RELATIONSHIP_ARRAY_NAMES = new Set([
  "details", "payments", "tags", "sharings", "contact_people", "subcategories",
  "activities", "payer_tax_numbers", "e_document_accounts", "invoicing_preferences",
]);

export function parseMigrationColumns(migrationSql: string): MigrationColumn[] {
  const lines = migrationSql.split(/\r?\n/);
  const columns: MigrationColumn[] = [];

  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^create table parasut\.(\w+) \(/);
    if (m) {
      const table = m[1];
      let kind: "attribute" | "relationship" = "attribute";
      let j = i + 1;
      while (j < lines.length && !/^\);/.test(lines[j])) {
        const l = lines[j];
        if (/^\s*-- attributes/.test(l)) { kind = "attribute"; j++; continue; }
        if (/^\s*-- relationships/.test(l)) { kind = "relationship"; j++; continue; }
        if (/^\s*-- sync bookkeeping/.test(l)) { j++; break; }
        const colMatch = l.match(/^\s*"([a-zA-Z0-9_]+)"\s+([a-zA-Z]+)/);
        if (colMatch) columns.push({ table, name: colMatch[1], pgType: colMatch[2], kind });
        j++;
      }
      i = j;
      continue;
    }
    i++;
  }

  for (const l of lines) {
    const m = l.match(/^alter table parasut\.(\w+) add column if not exists "([a-zA-Z0-9_]+)"\s+([a-zA-Z]+)/);
    if (m) {
      const [, table, col, pgType] = m;
      const kind: "attribute" | "relationship" =
        col.endsWith("_parasut_id") || RELATIONSHIP_ARRAY_NAMES.has(col) ? "relationship" : "attribute";
      columns.push({ table, name: col, pgType, kind });
    }
  }

  return columns;
}

export function columnsByTable(columns: readonly MigrationColumn[]): Map<string, MigrationColumn[]> {
  const map = new Map<string, MigrationColumn[]>();
  for (const c of columns) {
    const list = map.get(c.table) ?? [];
    list.push(c);
    map.set(c.table, list);
  }
  return map;
}
