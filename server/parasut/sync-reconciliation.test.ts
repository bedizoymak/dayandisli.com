import { describe, expect, it } from "vitest";
import { syncCollection } from "./sync-base.ts";
import type { JsonApiDocument, MirrorDatabase, PaginatedPage, SyncContext } from "./types.ts";

interface FakeRow {
  id: string;
  parasut_id: string;
  company_id: string;
  parasut_company_id: string;
  resource_type: string;
  attributes: Record<string, unknown>;
  relationships: Record<string, unknown>;
  raw_payload: unknown;
  source_archived: boolean | null;
  payload_hash: string;
  [key: string]: unknown;
}

/** Minimal in-memory MirrorDatabase covering exactly what upsertResource + reconcileMissingResources need. */
function createFakeDatabase(seedRows: FakeRow[] = []) {
  const tables: Record<string, Record<string, unknown>[]> = {
    contacts: [...seedRows],
    sync_runs: [],
    sync_errors: [],
  };

  function makeQuery(table: string) {
    const predicates: Array<[string, unknown]> = [];
    let mode: "select" | "insert" | "update" = "select";
    let payload: Record<string, unknown> | null = null;

    const matches = (row: Record<string, unknown>) => predicates.every(([col, val]) => row[col] === val);

    const api = {
      select() {
        mode = "select";
        return api;
      },
      eq(column: string, value: unknown) {
        predicates.push([column, value]);
        return api;
      },
      insert(value: Record<string, unknown>) {
        mode = "insert";
        payload = { id: (value.id as string) ?? `row-${tables[table].length + 1}`, ...value };
        tables[table].push(payload);
        return api;
      },
      update(value: Record<string, unknown>) {
        mode = "update";
        payload = value;
        return api;
      },
      maybeSingle: async () => {
        if (mode === "select") {
          const row = tables[table].find(matches);
          return { data: row ?? null, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => ({ data: payload, error: null }),
      then(resolve: (value: unknown) => unknown) {
        if (mode === "update") {
          const rows = tables[table].filter(matches);
          rows.forEach((row) => Object.assign(row, payload));
          return Promise.resolve(resolve({ data: null, error: null }));
        }
        if (mode === "insert") {
          return Promise.resolve(resolve({ data: null, error: null }));
        }
        const rows = tables[table].filter(matches);
        return Promise.resolve(resolve({ data: rows, error: null }));
      },
    };
    return api;
  }

  const database = {
    schema() {
      return this;
    },
    from(table: string) {
      return makeQuery(table);
    },
  } as unknown as MirrorDatabase;

  return { database, tables };
}

function contactRow(overrides: Partial<FakeRow>): FakeRow {
  return {
    id: overrides.parasut_id ?? "row",
    parasut_id: "1",
    company_id: "company-A",
    parasut_company_id: "666034",
    resource_type: "contacts",
    attributes: { name: "X" },
    relationships: {},
    raw_payload: {},
    source_archived: false,
    payload_hash: "hash",
    ...overrides,
  };
}

function fakeClient(pages: PaginatedPage[]) {
  return {
    async *getPaginated() {
      for (const page of pages) yield page;
    },
  };
}

function throwingClient(error: Error) {
  return {
    // eslint-disable-next-line require-yield
    async *getPaginated(): AsyncGenerator<PaginatedPage> {
      throw error;
    },
  };
}

function page(pageNumber: number, ids: string[]): PaginatedPage {
  const document: JsonApiDocument = {
    data: ids.map((id) => ({ id, type: "contacts", attributes: { name: `Contact ${id}`, archived: false } })),
  };
  return { pageNumber, document };
}

function buildContext(database: MirrorDatabase, client: ReturnType<typeof fakeClient> | ReturnType<typeof throwingClient>): SyncContext {
  return {
    companyId: "company-A",
    parasutCompanyId: "666034",
    database,
    client: client as SyncContext["client"],
    now: () => new Date("2026-07-23T12:00:00Z"),
  };
}

const options = {
  resourceType: "contacts",
  table: "contacts" as const,
  endpoint: "/v4/666034/contacts",
  reconcile: true,
};

describe("syncCollection — deletion reconciliation", () => {
  it("archives a previously-active contact missing from a complete snapshot", async () => {
    const { database, tables } = createFakeDatabase([
      contactRow({ id: "row-1", parasut_id: "1" }),
      contactRow({ id: "row-2", parasut_id: "2" }),
    ]);
    const client = fakeClient([page(1, ["1"])]); // "2" is gone — deleted in Paraşüt
    const result = await syncCollection(buildContext(database, client), options);

    expect(result.status).toBe("completed");
    expect(result.reconciliation).toEqual({ archivedCount: 1, skippedReason: null });
    const row2 = tables.contacts.find((r) => r.parasut_id === "2");
    expect(row2?.source_archived).toBe(true);
    const row1 = tables.contacts.find((r) => r.parasut_id === "1");
    expect(row1?.source_archived).toBe(false);
  });

  it("does not archive anything when the sync run fails outright", async () => {
    const { database, tables } = createFakeDatabase([contactRow({ id: "row-1", parasut_id: "1" }), contactRow({ id: "row-2", parasut_id: "2" })]);
    const client = throwingClient(new Error("network down"));
    await expect(syncCollection(buildContext(database, client), options)).rejects.toThrow("network down");
    expect(tables.contacts.find((r) => r.parasut_id === "2")?.source_archived).toBe(false);
  });

  it("does not archive anything when the run completes with per-resource errors (partial)", async () => {
    const { database, tables } = createFakeDatabase([
      contactRow({ id: "row-1", parasut_id: "1" }),
      contactRow({ id: "row-2", parasut_id: "2" }),
    ]);
    // A resource whose `type` doesn't match the sync's resourceType makes
    // upsertResource throw ("Resource type mismatch"), which syncCollection
    // catches per-resource and counts as a run error — the run still
    // completes its loop (status becomes "partial"), it just isn't clean.
    const client = fakeClient([
      {
        pageNumber: 1,
        document: { data: [{ id: "1", type: "not-contacts", attributes: {} }] },
      },
    ]);
    const result = await syncCollection(buildContext(database, client), options);

    expect(result.status).toBe("partial");
    expect(result.reconciliation).toEqual({ archivedCount: 0, skippedReason: "sync_run_had_errors" });
    expect(tables.contacts.find((r) => r.parasut_id === "2")?.source_archived).toBe(false);
  });

  it("skips reconciliation on a truncated-but-nonzero snapshot instead of mass-archiving the rest", async () => {
    const { database, tables } = createFakeDatabase([
      contactRow({ id: "row-1", parasut_id: "1" }),
      contactRow({ id: "row-2", parasut_id: "2" }),
      contactRow({ id: "row-3", parasut_id: "3" }),
      contactRow({ id: "row-4", parasut_id: "4" }),
    ]);
    // Only "1" observed out of 4 previously-active rows (25% retention) —
    // e.g. pagination stopped early for a non-deletion reason.
    const client = fakeClient([page(1, ["1"])]);
    const result = await syncCollection(buildContext(database, client), options);

    expect(result.status).toBe("completed");
    expect(result.reconciliation).toEqual({ archivedCount: 0, skippedReason: "suspiciously_truncated_snapshot" });
    expect(tables.contacts.every((r) => r.source_archived === false)).toBe(true);
  });

  it("skips reconciliation on a suspiciously empty snapshot instead of mass-archiving", async () => {
    const { database, tables } = createFakeDatabase([
      contactRow({ id: "row-1", parasut_id: "1" }),
      contactRow({ id: "row-2", parasut_id: "2" }),
    ]);
    const client = fakeClient([page(1, [])]); // empty page, but 2 rows previously existed
    const result = await syncCollection(buildContext(database, client), options);

    expect(result.status).toBe("completed");
    expect(result.reconciliation).toEqual({ archivedCount: 0, skippedReason: "suspiciously_empty_snapshot" });
    expect(tables.contacts.every((r) => r.source_archived === false)).toBe(true);
  });

  it("never archives another company's row, even if that row is also missing from the observed set", async () => {
    const { database, tables } = createFakeDatabase([
      contactRow({ id: "row-1", parasut_id: "1", company_id: "company-A" }),
      contactRow({ id: "row-2", parasut_id: "2", company_id: "company-B" }), // different tenant, same parasut_id space
    ]);
    const client = fakeClient([page(1, ["1"])]);
    await syncCollection(buildContext(database, client), options);

    expect(tables.contacts.find((r) => r.company_id === "company-B")?.source_archived).toBe(false);
  });

  it("never archives a row of a different resource_type sharing the same table", async () => {
    const { database, tables } = createFakeDatabase([
      contactRow({ id: "row-1", parasut_id: "1", resource_type: "contacts" }),
      contactRow({ id: "row-2", parasut_id: "2", resource_type: "other_resource" }),
    ]);
    const client = fakeClient([page(1, ["1"])]);
    await syncCollection(buildContext(database, client), options);

    expect(tables.contacts.find((r) => r.resource_type === "other_resource")?.source_archived).toBe(false);
  });

  it("restores a previously-archived contact that reappears in a complete snapshot", async () => {
    const { database, tables } = createFakeDatabase([
      contactRow({ id: "row-1", parasut_id: "1", source_archived: true, payload_hash: "stale" }),
    ]);
    const client = fakeClient([page(1, ["1"])]); // "1" is observed again, with archived: false
    const result = await syncCollection(buildContext(database, client), options);

    expect(result.reconciliation).toEqual({ archivedCount: 0, skippedReason: null });
    expect(tables.contacts.find((r) => r.parasut_id === "1")?.source_archived).toBe(false);
  });

  it("does not run reconciliation at all when options.reconcile is not set", async () => {
    const { database, tables } = createFakeDatabase([contactRow({ id: "row-1", parasut_id: "1" }), contactRow({ id: "row-2", parasut_id: "2" })]);
    const client = fakeClient([page(1, ["1"])]);
    const result = await syncCollection(buildContext(database, client), { ...options, reconcile: false });

    expect(result.reconciliation).toBeUndefined();
    expect(tables.contacts.find((r) => r.parasut_id === "2")?.source_archived).toBe(false);
  });

  it("never issues a physical delete — the fake database has no delete method for the sync engine to call", async () => {
    const { database } = createFakeDatabase([contactRow({ id: "row-1", parasut_id: "1" }), contactRow({ id: "row-2", parasut_id: "2" })]);
    expect((database.from("contacts") as unknown as { delete?: unknown }).delete).toBeUndefined();
    const client = fakeClient([page(1, ["1"])]);
    // If sync-base.ts or reconciliation.ts ever called `.delete()`, this
    // would throw "not a function" — completing without throwing is itself
    // proof no delete call was attempted.
    await expect(syncCollection(buildContext(database, client), options)).resolves.toBeDefined();
  });
});
