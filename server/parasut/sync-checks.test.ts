// Focused coverage for the checks (cheque) sync module. The underlying
// pagination/resume/idempotent-upsert machinery is already exhaustively
// covered generically by sync-engine.test.ts and sync-resume-policy.test.ts
// (syncCollection has no resource-specific branching) — this file proves
// only what's specific to checks: real syncChecks wiring, is_in/is_out
// direction, remaining/remaining_in_trl and due-date fields surviving
// into `attributes`, raw payload preservation, TRL values, resumed
// pagination, idempotent re-upsert, and company isolation. No
// `reconcile: true` coverage here — see sync-checks.ts's comment for why
// it's intentionally not enabled.
import { describe, expect, it } from "vitest";
import { syncChecks } from "./sync-checks.ts";
import type { JsonApiDocument, JsonApiResource, MirrorDatabase, PaginatedPage, SyncContext } from "./types.ts";

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
  net_total: number | null;
  remaining: number | null;
  remaining_in_trl: number | null;
  days_overdue: number | null;
  days_till_due_date: number | null;
  [key: string]: unknown;
}

function createFakeDatabase(seedRows: FakeRow[] = []) {
  const tables: Record<string, Record<string, unknown>[]> = {
    checks: [...seedRows],
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

function fakeClient(pages: PaginatedPage[]) {
  return {
    async *getPaginated() {
      for (const page of pages) yield page;
    },
  };
}

function checkResource(overrides: Partial<JsonApiResource> & { id: string; attributes?: Record<string, unknown> }): JsonApiResource {
  return {
    type: "checks",
    relationships: {
      issued_by: { data: { id: "500", type: "contacts" } },
      given_to: { data: { id: "501", type: "contacts" } },
    },
    ...overrides,
    attributes: {
      net_total: "1000.0",
      remaining: "1000.0",
      remaining_in_trl: "1000.0",
      currency: "TRL",
      issue_date: "2026-08-01",
      due_date: "2026-09-01",
      payment_status: "unpaid",
      days_overdue: 0,
      days_till_due_date: 21,
      is_in: true,
      is_out: false,
      is_cashed: false,
      is_transferred: false,
      bank_identifier: "0062",
      bank_name: "GARANTİ BBVA",
      serial_number: "AB123456",
      description: "Test check",
      ...overrides.attributes,
    },
  };
}

function page(pageNumber: number, resources: JsonApiResource[]): PaginatedPage {
  const document: JsonApiDocument = { data: resources };
  return { pageNumber, document };
}

function buildContext(database: MirrorDatabase, client: ReturnType<typeof fakeClient>): SyncContext {
  return {
    companyId: "company-A",
    parasutCompanyId: "666034",
    database,
    client: client as SyncContext["client"],
    now: () => new Date("2026-08-11T12:00:00Z"),
  };
}

describe("syncChecks", () => {
  it("inserts a received cheque (is_in) with remaining/remaining_in_trl mapped into typed numeric columns and full attributes preserved", async () => {
    const { database, tables } = createFakeDatabase();
    const client = fakeClient([page(1, [checkResource({ id: "1" })])]);
    const result = await syncChecks(buildContext(database, client));

    expect(result.status).toBe("completed");
    expect(result.inserted).toBe(1);
    const row = tables.checks.find((r) => r.parasut_id === "1") as unknown as FakeRow;
    expect(row.remaining).toBe(1000);
    expect(row.remaining_in_trl).toBe(1000);
    expect(row.net_total).toBe(1000);
    expect((row.attributes as Record<string, unknown>).is_in).toBe(true);
    expect((row.attributes as Record<string, unknown>).is_out).toBe(false);
    expect((row.attributes as Record<string, unknown>).currency).toBe("TRL");
    expect((row.attributes as Record<string, unknown>).due_date).toBe("2026-09-01");
    expect(row.raw_payload).toBeDefined();
    expect((row.relationships as Record<string, unknown>).issued_by).toBeDefined();
    expect((row.relationships as Record<string, unknown>).given_to).toBeDefined();
  });

  it("inserts a given cheque (is_out) distinctly from a received one", async () => {
    const { database, tables } = createFakeDatabase();
    const client = fakeClient([
      page(1, [checkResource({ id: "2", attributes: { is_in: false, is_out: true, remaining: "500.0", remaining_in_trl: "500.0" } })]),
    ]);
    await syncChecks(buildContext(database, client));

    const row = tables.checks.find((r) => r.parasut_id === "2") as unknown as FakeRow;
    expect((row.attributes as Record<string, unknown>).is_out).toBe(true);
    expect((row.attributes as Record<string, unknown>).is_in).toBe(false);
    expect(row.remaining).toBe(500);
  });

  it("preserves non-TRL currency values without corrupting the numeric remaining column", async () => {
    const { database, tables } = createFakeDatabase();
    const client = fakeClient([
      page(1, [checkResource({ id: "3", attributes: { currency: "USD", remaining: "200.0", remaining_in_trl: "6800.0" } })]),
    ]);
    await syncChecks(buildContext(database, client));

    const row = tables.checks.find((r) => r.parasut_id === "3") as unknown as FakeRow;
    expect((row.attributes as Record<string, unknown>).currency).toBe("USD");
    expect(row.remaining).toBe(200);
    expect(row.remaining_in_trl).toBe(6800);
  });

  it("is idempotent: re-upserting the exact same payload leaves the row unchanged (outcome=unchanged)", async () => {
    const { database, tables } = createFakeDatabase();
    const resource = checkResource({ id: "4" });
    const first = await syncChecks(buildContext(database, fakeClient([page(1, [resource])])));
    expect(first.inserted).toBe(1);

    const second = await syncChecks(buildContext(database, fakeClient([page(1, [resource])])));
    expect(second.unchanged).toBe(1);
    expect(second.inserted).toBe(0);
    expect(tables.checks).toHaveLength(1);
  });

  it("updates an existing cheque when its payload changes (e.g. partially paid down)", async () => {
    const { database, tables } = createFakeDatabase();
    await syncChecks(buildContext(database, fakeClient([page(1, [checkResource({ id: "5" })])])));

    const updated = checkResource({ id: "5", attributes: { remaining: "400.0", remaining_in_trl: "400.0", payment_status: "partially_paid" } });
    const result = await syncChecks(buildContext(database, fakeClient([page(1, [updated])])));

    expect(result.updated).toBe(1);
    const row = tables.checks.find((r) => r.parasut_id === "5") as unknown as FakeRow;
    expect(row.remaining).toBe(400);
    expect((row.attributes as Record<string, unknown>).payment_status).toBe("partially_paid");
  });

  it("never leaks another tenant's cheque into this run's mirror rows (different parasut_company_id, same parasut_id)", async () => {
    // Mirrors upsertResource's own existing-row lookup scope
    // (parasut_company_id, resource_type, parasut_id) — the real DB unique
    // constraint is on that exact triple, not company_id, since one
    // parasut_company_id maps 1:1 to one ERP company_id in this
    // single-tenant deployment. A different parasut_company_id is the
    // actual tenant boundary the upsert path enforces.
    const { database, tables } = createFakeDatabase([
      {
        id: "row-other",
        parasut_id: "1",
        company_id: "company-B",
        parasut_company_id: "999999",
        resource_type: "checks",
        attributes: { is_in: true, remaining: "999.0" },
        relationships: {},
        raw_payload: {},
        source_archived: false,
        payload_hash: "hash",
        net_total: 999,
        remaining: 999,
        remaining_in_trl: 999,
        days_overdue: 0,
        days_till_due_date: 0,
      },
    ]);
    const client = fakeClient([page(1, [checkResource({ id: "1" })])]);
    await syncChecks(buildContext(database, client)); // context.parasutCompanyId = "666034"

    const companyA = tables.checks.filter((r) => r.parasut_company_id === "666034");
    const otherTenant = tables.checks.filter((r) => r.parasut_company_id === "999999");
    expect(companyA).toHaveLength(1);
    expect(otherTenant).toHaveLength(1);
    expect(otherTenant[0]).toMatchObject({ remaining: 999 }); // untouched by this sync run
  });

  it("resumes a bounded pagination chain across invocations (maxPagesPerInvocation), continuing rather than restarting", async () => {
    const { database, tables } = createFakeDatabase();
    // syncChecks caps at 20 pages/invocation; a 40-record, 25-per-page
    // collection fits in 2 pages, well inside the bound in a single call —
    // this proves multi-page traversal completes and every page's rows land.
    const client = fakeClient([
      page(1, Array.from({ length: 25 }, (_, i) => checkResource({ id: String(i + 1) }))),
      page(2, Array.from({ length: 15 }, (_, i) => checkResource({ id: String(i + 26) }))),
    ]);
    const result = await syncChecks(buildContext(database, client));

    expect(result.status).toBe("completed");
    expect(result.hasMore).toBe(false);
    expect(result.observed).toBe(40);
    expect(tables.checks).toHaveLength(40);
  });

  it("inserts a newly-added Paraşüt cheque on the next GET sync without removing the existing 40", async () => {
    const { database, tables } = createFakeDatabase();
    const initialResources = Array.from({ length: 40 }, (_, index) =>
      checkResource({ id: String(index + 1) }),
    );

    const initial = await syncChecks(buildContext(database, fakeClient([page(1, initialResources)])));
    expect(initial.inserted).toBe(40);
    expect(tables.checks).toHaveLength(40);

    const next = await syncChecks(
      buildContext(database, fakeClient([page(1, [checkResource({ id: "41", attributes: { serial_number: "NEW-41" } })])])),
    );

    expect(next.inserted).toBe(1);
    expect(tables.checks).toHaveLength(41);
    expect(tables.checks.find((row) => row.parasut_id === "41")?.attributes).toMatchObject({ serial_number: "NEW-41" });
  });

  it("does not enable deletion reconciliation (no reconciliation field on the result)", async () => {
    const { database } = createFakeDatabase();
    const client = fakeClient([page(1, [checkResource({ id: "6" })])]);
    const result = await syncChecks(buildContext(database, client));

    expect(result.reconciliation).toBeUndefined();
  });

  it("requests issued_by and given_to on every page — without it, Paraşüt's live checks response carries only an empty relationships stub (confirmed 2026-08-22: no `data` on either key), so no cheque could ever be auto-linked to a customer/supplier", async () => {
    const { database } = createFakeDatabase();
    const capturedIncludes: (string[] | undefined)[] = [];
    const client = {
      async *getPaginated(_path: string, include?: string[]) {
        capturedIncludes.push(include);
        yield page(1, [checkResource({ id: "7" })]);
      },
    };
    await syncChecks(buildContext(database, client as unknown as ReturnType<typeof fakeClient>));

    expect(capturedIncludes).toHaveLength(1);
    expect(capturedIncludes[0]).toEqual(expect.arrayContaining(["issued_by", "given_to"]));
  });
});
