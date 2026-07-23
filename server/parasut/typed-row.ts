import type { JsonApiResource, JsonObject } from "./types.ts";

// Pure, dependency-free derivation of typed mirror-table columns from a raw
// Paraşüt JSON:API resource. Deliberately has no knowledge of SQL, Postgres,
// or any particular database client — callers pass the exact, fixed column
// list for the destination table and get back a plain value object with
// exactly those keys, every time, regardless of which attributes any given
// resource happens to include.
//
// That fixed-column-list contract is what prevents the "insert column set
// grows while rows are being built" bug: the column list is decided once, up
// front, by the caller — never inferred incrementally from the data being
// inserted.

export type ColumnKind = "text" | "boolean" | "numeric" | "timestamptz" | "date" | "jsonb";

export interface ColumnSpec {
  name: string;
  kind: ColumnKind;
}

export interface ConversionWarning {
  resourceType: string;
  parasutId: string;
  field: string;
  receivedType: string;
  expectedType: ColumnKind;
}

export interface TypedRowResult {
  /** Exactly one key per entry in the `columns` argument — always, for every call. */
  values: Record<string, unknown>;
  /** Never contains the offending value itself, only its JS typeof — see requirement to avoid logging PII. */
  warnings: ConversionWarning[];
}

const SOURCE_TIMESTAMP_FIELDS = new Set(["created_at", "updated_at", "archived"]);

// `Date.parse`/`new Date(...)` silently roll invalid calendar dates over to a
// nearby valid one instead of rejecting them (e.g. "2026-02-30" becomes
// 2026-03-02, "2026-04-31" becomes 2026-05-01) — so checking
// `!Number.isNaN(Date.parse(raw))` alone is not enough to prove `raw` is a
// real calendar date; it only proves the string was parseable *somehow*.
// Postgres itself has no such leniency and rejects '2026-02-30'::date
// outright, so a value that slips past a parse-only check here would only
// fail later, at the database, on a raw SQL error instead of a clear
// conversion warning. Reformat what was parsed and compare it back against
// the input's own date component to catch the rollover.
function isValidCalendarDateString(raw: string): boolean {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!dateMatch) return false;
  const [, yearStr, monthStr, dayStr] = dateMatch;
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return false;

  // Use the UTC getters since the inputs we deal with (Paraşüt's API, and our
  // own `date`/`timestamptz` column values) are always UTC/ISO, never local time.
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() + 1 === month &&
    parsed.getUTCDate() === day
  );
}

function jsTypeOf(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function convert(
  raw: unknown,
  kind: ColumnKind,
  ctx: { resourceType: string; parasutId: string; field: string },
  warnings: ConversionWarning[],
): unknown {
  if (raw === null || raw === undefined) return null;

  switch (kind) {
    case "boolean": {
      if (typeof raw === "boolean") return raw;
      warnings.push({ ...ctx, receivedType: jsTypeOf(raw), expectedType: kind });
      return null;
    }
    case "numeric": {
      if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
      if (typeof raw === "string") {
        if (raw.trim() === "") return null; // empty string: treated as "no value", not an error
        const n = Number(raw);
        if (Number.isFinite(n)) return n;
        warnings.push({ ...ctx, receivedType: jsTypeOf(raw), expectedType: kind });
        return null;
      }
      warnings.push({ ...ctx, receivedType: jsTypeOf(raw), expectedType: kind });
      return null;
    }
    case "timestamptz":
    case "date": {
      if (typeof raw === "string") {
        if (raw.trim() === "") return null;
        if (!isValidCalendarDateString(raw)) {
          warnings.push({ ...ctx, receivedType: jsTypeOf(raw), expectedType: kind });
          return null;
        }
        return raw;
      }
      warnings.push({ ...ctx, receivedType: jsTypeOf(raw), expectedType: kind });
      return null;
    }
    case "jsonb": {
      // Objects/arrays/primitives are all valid JSON — pass through as-is.
      return raw;
    }
    case "text":
    default: {
      if (typeof raw === "string") return raw;
      if (typeof raw === "number" || typeof raw === "boolean") return String(raw);
      warnings.push({ ...ctx, receivedType: jsTypeOf(raw), expectedType: kind });
      return null;
    }
  }
}

function relationshipId(relationships: JsonObject, key: string): unknown {
  const rel = relationships[key] as { data?: unknown } | undefined;
  const data = rel?.data;
  if (!data || Array.isArray(data)) return null;
  return (data as { id?: unknown }).id ?? null;
}

function relationshipArray(relationships: JsonObject, key: string): unknown {
  const rel = relationships[key] as { data?: unknown } | undefined;
  const data = rel?.data;
  return Array.isArray(data) ? data : null;
}

/**
 * Derives every column in `columns` for one resource, in one pass, against a
 * fixed column set. Two resources with different attribute sets (e.g. one
 * has `iban`, another omits it) still produce value objects with identical
 * keys — the difference is `null` for the missing one, never a missing key.
 */
export function deriveTypedRow(
  resource: JsonApiResource,
  columns: ColumnSpec[],
): TypedRowResult {
  const attributes: JsonObject = resource.attributes ?? {};
  const relationships: JsonObject = resource.relationships ?? {};
  const warnings: ConversionWarning[] = [];
  const values: Record<string, unknown> = {};

  const ctxFor = (field: string) => ({
    resourceType: resource.type,
    parasutId: resource.id,
    field,
  });

  for (const column of columns) {
    if (column.name === "source_created_at") {
      values[column.name] = convert(attributes.created_at, "timestamptz", ctxFor("created_at"), warnings);
      continue;
    }
    if (column.name === "source_updated_at") {
      values[column.name] = convert(attributes.updated_at, "timestamptz", ctxFor("updated_at"), warnings);
      continue;
    }
    if (column.name === "source_archived") {
      values[column.name] = convert(attributes.archived, "boolean", ctxFor("archived"), warnings);
      continue;
    }

    if (column.name.endsWith("_parasut_id")) {
      const relKey = column.name.slice(0, -"_parasut_id".length);
      values[column.name] = relationshipId(relationships, relKey) ?? null;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(relationships, column.name)) {
      const arr = relationshipArray(relationships, column.name);
      values[column.name] = arr ?? [];
      continue;
    }

    if (SOURCE_TIMESTAMP_FIELDS.has(column.name)) {
      // These belong on source_created_at/source_updated_at/source_archived
      // instead — never duplicate them under their raw attribute name too.
      values[column.name] = null;
      continue;
    }

    if (Object.prototype.hasOwnProperty.call(attributes, column.name)) {
      values[column.name] = convert(attributes[column.name], column.kind, ctxFor(column.name), warnings);
      continue;
    }

    values[column.name] = null;
  }

  return { values, warnings };
}
