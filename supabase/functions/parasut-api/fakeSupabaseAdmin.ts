// In-memory fake of the minimal Supabase/PostgREST client shape used by
// handlers.ts (SupabaseAdminLike / ScopedQuery). Test-only — lets
// handlers.test.ts exercise the ACTUAL handler functions (not a
// reimplementation) against a seeded, multi-company dataset without a real
// database connection.
import type { QueryResult, ScopedQuery, SelectableTable, SingleResult, SupabaseAdminLike } from "./handlers.ts";

export type FakeRow = Record<string, unknown>;

function getPath(row: FakeRow, column: string): unknown {
  if (column.includes("->>")) {
    const [field, key] = column.split("->>");
    const value = row[field];
    return value && typeof value === "object" ? (value as FakeRow)[key] : undefined;
  }
  if (column.includes("->")) {
    const parts = column.split("->");
    let value: unknown = row;
    for (const part of parts) {
      if (value === null || value === undefined || typeof value !== "object") return undefined;
      value = (value as FakeRow)[part];
    }
    return value;
  }
  return row[column];
}

function compare(a: unknown, b: unknown): number {
  const numA = Number(a);
  const numB = Number(b);
  if (Number.isFinite(numA) && Number.isFinite(numB)) return numA - numB;
  return String(a ?? "").localeCompare(String(b ?? ""));
}

/** Structural containment check for the `cs` (jsonb @>) operator used on `relationships`. */
function contains(haystack: unknown, needle: unknown): boolean {
  if (needle === null || typeof needle !== "object") return haystack === needle;
  if (haystack === null || typeof haystack !== "object") return false;
  if (Array.isArray(needle)) {
    if (!Array.isArray(haystack)) return false;
    return needle.every((needleItem) => haystack.some((hayItem) => contains(hayItem, needleItem)));
  }
  return Object.entries(needle as FakeRow).every(([key, value]) => contains((haystack as FakeRow)[key], value));
}

class FakeQuery<T extends FakeRow> implements ScopedQuery<T> {
  private predicates: Array<(row: T) => boolean> = [];
  private orGroups: Array<(row: T) => boolean> = [];
  private orderSpec: { column: string; ascending: boolean } | null = null;
  private rangeSpec: { from: number; to: number } | null = null;
  private limitSpec: number | null = null;

  constructor(
    private readonly rows: T[],
    private readonly wantCount: boolean,
  ) {}

  eq(column: string, value: unknown): ScopedQuery<T> {
    this.predicates.push((row) => getPath(row, column) === value);
    return this;
  }

  is(column: string, value: null | boolean): ScopedQuery<T> {
    this.predicates.push((row) => getPath(row, column) === value);
    return this;
  }

  in(column: string, values: unknown[]): ScopedQuery<T> {
    this.predicates.push((row) => values.includes(getPath(row, column)));
    return this;
  }

  gt(column: string, value: unknown): ScopedQuery<T> {
    this.predicates.push((row) => compare(getPath(row, column), value) > 0);
    return this;
  }

  gte(column: string, value: unknown): ScopedQuery<T> {
    this.predicates.push((row) => compare(getPath(row, column), value) >= 0);
    return this;
  }

  lte(column: string, value: unknown): ScopedQuery<T> {
    this.predicates.push((row) => compare(getPath(row, column), value) <= 0);
    return this;
  }

  not(column: string, _operator: string, value: unknown): ScopedQuery<T> {
    this.predicates.push((row) => JSON.stringify(getPath(row, column) ?? []) !== value);
    return this;
  }

  or(expression: string): ScopedQuery<T> {
    const conditions = expression.split(",").map((part) => {
      const [column, op, pattern] = part.split(".");
      return { column, op, pattern };
    });
    this.orGroups.push((row) =>
      conditions.some(({ column, op, pattern }) => {
        const value = String(getPath(row, column) ?? "").toLowerCase();
        if (op === "ilike") return value.includes(pattern.replace(/%/g, "").toLowerCase());
        return false;
      }),
    );
    return this;
  }

  ilike(column: string, pattern: string): ScopedQuery<T> {
    const needle = pattern.replace(/%/g, "").toLowerCase();
    this.predicates.push((row) => String(getPath(row, column) ?? "").toLowerCase().includes(needle));
    return this;
  }

  filter(column: string, operator: string, value: unknown): ScopedQuery<T> {
    if (operator === "cs") {
      const needle = typeof value === "string" ? JSON.parse(value) : value;
      this.predicates.push((row) => contains(getPath(row, column), needle));
    }
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): ScopedQuery<T> {
    this.orderSpec = { column, ascending: options?.ascending ?? true };
    return this;
  }

  range(from: number, to: number): ScopedQuery<T> {
    this.rangeSpec = { from, to };
    return this;
  }

  limit(count: number): ScopedQuery<T> {
    this.limitSpec = count;
    return this;
  }

  private resolve(): QueryResult<T> {
    let filtered = this.rows.filter((row) => this.predicates.every((predicate) => predicate(row)));
    if (this.orGroups.length > 0) filtered = filtered.filter((row) => this.orGroups.every((group) => group(row)));

    const count = this.wantCount ? filtered.length : null;

    if (this.orderSpec) {
      const { column, ascending } = this.orderSpec;
      filtered = [...filtered].sort((a, b) => (ascending ? compare(getPath(a, column), getPath(b, column)) : compare(getPath(b, column), getPath(a, column))));
    }
    if (this.rangeSpec) filtered = filtered.slice(this.rangeSpec.from, this.rangeSpec.to + 1);
    if (this.limitSpec !== null) filtered = filtered.slice(0, this.limitSpec);

    return { data: filtered, error: null, count };
  }

  async maybeSingle(): Promise<SingleResult<T>> {
    const { data, error } = this.resolve();
    return { data: data && data.length > 0 ? data[0] : null, error };
  }

  then<TResult1 = QueryResult<T>>(
    onfulfilled?: ((value: QueryResult<T>) => TResult1 | PromiseLike<TResult1>) | null,
  ): Promise<TResult1> {
    return Promise.resolve(this.resolve()).then(onfulfilled ?? undefined);
  }
}

/** Mirrors the real `.from(table)` result: only `.select()` is available until columns are chosen, matching PostgREST's real API. */
class FakeSelectableTable implements SelectableTable {
  constructor(private readonly rows: FakeRow[]) {}

  select<T = FakeRow>(_columns?: string, options?: { count?: "exact" }): ScopedQuery<T> {
    return new FakeQuery<T & FakeRow>(this.rows as (T & FakeRow)[], options?.count === "exact");
  }
}

/** Seed data keyed by `"schema.table"`, e.g. `"parasut.contacts"`, `"public.erp_users"`. */
export function createFakeSupabaseAdmin(seed: Record<string, FakeRow[]>): SupabaseAdminLike {
  const tableFor = (key: string) => seed[key] ?? [];
  return {
    schema(name: string) {
      return {
        from(table: string) {
          return new FakeSelectableTable(tableFor(`${name}.${table}`));
        },
      };
    },
    from(table: string) {
      return new FakeSelectableTable(tableFor(`public.${table}`));
    },
  };
}
