// Resource-specific regression coverage for purchase_bills deletion
// reconciliation. The reconciliation MECHANISM itself (evaluateReconciliationEligibility,
// computeIdsToArchive, syncCollection's completed/partial gating) is already
// exhaustively covered generically by sync-reconciliation.test.ts (using a
// "contacts"-shaped fixture) — that coverage applies unchanged here because
// syncCollection has no resource-specific branching. This file exists only to
// prove two things sync-reconciliation.test.ts does not: (1) syncPurchaseBills
// itself actually wires `reconcile: true` through to syncCollection, and (2) a
// genuine pagination-boundary partial crawl (maxPagesPerInvocation, not just a
// per-resource error) never reconciles either.
import { describe, expect, it } from "vitest";
import { syncPurchaseBills } from "./sync-purchase-bills.ts";
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

/** Same minimal in-memory MirrorDatabase shape as sync-reconciliation.test.ts, keyed for purchase_bills. */
function createFakeDatabase(seedRows: FakeRow[] = []) {
  const tables: Record<string, Record<string, unknown>[]> = {
    purchase_bills: [...seedRows],
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
      gt() {
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

function purchaseBillRow(overrides: Partial<FakeRow>): FakeRow {
  return {
    id: overrides.parasut_id ?? "row",
    parasut_id: "1",
    company_id: "company-A",
    parasut_company_id: "666034",
    resource_type: "purchase_bills",
    attributes: { invoice_no: "PB-1" },
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

function page(pageNumber: number, ids: string[]): PaginatedPage {
  const document: JsonApiDocument = {
    data: ids.map((id) => ({ id, type: "purchase_bills", attributes: { invoice_no: `PB-${id}`, archived: false } })),
  };
  return { pageNumber, document };
}

function buildContext(database: MirrorDatabase, client: ReturnType<typeof fakeClient>): SyncContext {
  return {
    companyId: "company-A",
    parasutCompanyId: "666034",
    database,
    client: client as SyncContext["client"],
    now: () => new Date("2026-08-10T12:00:00Z"),
  };
}

describe("syncPurchaseBills — deletion reconciliation wiring", () => {
  it("archives a previously-active purchase bill absent from a complete snapshot (the real wrapper, not just syncCollection)", async () => {
    const { database, tables } = createFakeDatabase([
      purchaseBillRow({ id: "row-1", parasut_id: "1" }),
      purchaseBillRow({ id: "row-2", parasut_id: "2" }),
    ]);
    const client = fakeClient([page(1, ["1"])]); // "2" is gone — deleted in Paraşüt
    const result = await syncPurchaseBills(buildContext(database, client));

    expect(result.status).toBe("completed");
    expect(result.reconciliation).toEqual({ archivedCount: 1, skippedReason: null });
    expect(tables.purchase_bills.find((r) => r.parasut_id === "2")?.source_archived).toBe(true);
    expect(tables.purchase_bills.find((r) => r.parasut_id === "1")?.source_archived).toBe(false);
  });

  it("existing purchase bill observed again in a complete snapshot remains active", async () => {
    const { database, tables } = createFakeDatabase([purchaseBillRow({ id: "row-1", parasut_id: "1" })]);
    const client = fakeClient([page(1, ["1"])]);
    await syncPurchaseBills(buildContext(database, client));

    expect(tables.purchase_bills.find((r) => r.parasut_id === "1")?.source_archived).toBe(false);
  });

  it("never reconciles absence on a genuine pagination-boundary partial crawl (maxPagesPerInvocation reached, not just an error)", async () => {
    const { database, tables } = createFakeDatabase([
      purchaseBillRow({ id: "row-1", parasut_id: "1" }),
      purchaseBillRow({ id: "row-2", parasut_id: "2" }),
    ]);
    // syncPurchaseBills caps at 2 pages per invocation; supply 3 pages so the
    // invocation is forced to stop with hasMore = true — a genuine bounded,
    // incomplete traversal, distinct from an error-driven partial.
    const client = fakeClient([page(1, ["1"]), page(2, []), page(3, [])]);
    const result = await syncPurchaseBills(buildContext(database, client));

    expect(result.status).toBe("partial");
    expect(result.hasMore).toBe(true);
    expect(result.reconciliation).toBeUndefined();
    expect(tables.purchase_bills.find((r) => r.parasut_id === "2")?.source_archived).toBe(false);
  });

  it("never archives another company's purchase bill, even if absent from this company's observed set", async () => {
    const { database, tables } = createFakeDatabase([
      purchaseBillRow({ id: "row-1", parasut_id: "1", company_id: "company-A" }),
      purchaseBillRow({ id: "row-2", parasut_id: "2", company_id: "company-B" }),
    ]);
    const client = fakeClient([page(1, ["1"])]);
    await syncPurchaseBills(buildContext(database, client));

    expect(tables.purchase_bills.find((r) => r.company_id === "company-B")?.source_archived).toBe(false);
  });

  it("is idempotent: re-running an already-converged snapshot archives nothing further", async () => {
    const { database, tables } = createFakeDatabase([
      purchaseBillRow({ id: "row-1", parasut_id: "1" }),
      purchaseBillRow({ id: "row-2", parasut_id: "2", source_archived: true }),
    ]);
    const client = fakeClient([page(1, ["1"])]); // "2" already archived, still absent — nothing new to do
    const result = await syncPurchaseBills(buildContext(database, client));

    expect(result.reconciliation).toEqual({ archivedCount: 0, skippedReason: null });
    expect(tables.purchase_bills.find((r) => r.parasut_id === "2")?.source_archived).toBe(true);
  });
});
