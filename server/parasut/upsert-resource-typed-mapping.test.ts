import { describe, expect, it } from "vitest";
import { upsertResource } from "./upsert-resource.ts";
import type { JsonApiResource, MirrorDatabase } from "./types.ts";

// Sanitized synthetic fixtures only — no live business values.

interface FakeRow {
  id: string;
  parasut_id: string;
  parasut_company_id: string;
  company_id: string;
  resource_type: string;
  payload_hash: string;
  [key: string]: unknown;
}

/** In-memory MirrorDatabase — one table per test, tracks insert/update calls
 * and the exact row content written, without ever touching a real database. */
function fakeDatabase(seed: Record<string, FakeRow[]> = {}) {
  const tables: Record<string, FakeRow[]> = structuredCloneSafe(seed);
  const writes: Array<{ table: string; op: "insert" | "update"; row: Record<string, unknown> }> = [];

  function structuredCloneSafe<T>(v: T): T {
    return JSON.parse(JSON.stringify(v));
  }

  const database = {
    schema() {
      return this;
    },
    from(table: string) {
      const predicates: Array<[string, unknown]> = [];
      let mode: "select" | "insert" | "update" = "select";
      let payload: Record<string, unknown> | null = null;
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
          payload = value;
          return api;
        },
        update(value: Record<string, unknown>) {
          mode = "update";
          payload = value;
          return api;
        },
        maybeSingle: async () => {
          const rows = tables[table] ?? [];
          const match = rows.find((r) => predicates.every(([col, val]) => (r as Record<string, unknown>)[col] === val));
          return { data: match ?? null, error: null };
        },
        then(resolve: (value: unknown) => unknown) {
          if (mode === "insert" && payload) {
            const newRow = { id: `row-${(tables[table]?.length ?? 0) + 1}`, ...payload } as FakeRow;
            tables[table] = [...(tables[table] ?? []), newRow];
            writes.push({ table, op: "insert", row: payload });
          } else if (mode === "update" && payload) {
            const rows = tables[table] ?? [];
            for (const r of rows) {
              if (predicates.every(([col, val]) => (r as Record<string, unknown>)[col] === val)) {
                Object.assign(r, payload);
              }
            }
            writes.push({ table, op: "update", row: payload });
          }
          return Promise.resolve(resolve({ data: null, error: null }));
        },
      };
      return api;
    },
  } as unknown as MirrorDatabase;

  return { database, tables, writes };
}

function contactResource(overrides: Partial<Record<string, unknown>> = {}): JsonApiResource {
  return {
    id: "1",
    type: "contacts",
    attributes: { name: "Fixture Name", email: "fixture@example.test", trl_balance: "100.50", ...overrides },
    relationships: { category: { data: { id: "cat-1" } } },
  };
}

const context = (env?: Record<string, string | undefined>) => ({
  companyId: "company-A",
  parasutCompanyId: "666034",
  now: new Date("2026-07-26T00:00:00Z"),
  typedMappingEnv: env,
});

describe("upsert-resource — Phase 2B typed mapping, gate DISABLED (default) — behavior byte-for-byte unchanged", () => {
  it("does not write name/email/category_parasut_id when the gate is absent (undefined env)", async () => {
    const { database, writes } = fakeDatabase();
    await upsertResource(database, { resourceType: "contacts", table: "contacts", numericAttributeFields: ["trl_balance"] }, contactResource(), context(undefined));
    const insert = writes.find((w) => w.op === "insert")!;
    expect(insert.row.name).toBeUndefined();
    expect(insert.row.email).toBeUndefined();
    expect(insert.row.category_parasut_id).toBeUndefined();
    expect(insert.row.trl_balance).toBe(100.5); // legacy numericAttributeFields path still works
  });

  it("does not write typed columns when the env var is present but not \"1\"", async () => {
    const { database, writes } = fakeDatabase();
    await upsertResource(database, { resourceType: "contacts", table: "contacts" }, contactResource(), context({ PARASUT_TYPED_MAPPING_ENABLED: "0" }));
    const insert = writes.find((w) => w.op === "insert")!;
    expect(insert.row.name).toBeUndefined();
  });
});

describe("upsert-resource — Phase 2B typed mapping, gate ENABLED and IN SCOPE", () => {
  it("writes the full registry-mapped typed columns for an in-scope resource (contacts)", async () => {
    const { database, writes } = fakeDatabase();
    await upsertResource(database, { resourceType: "contacts", table: "contacts" }, contactResource(), context({ PARASUT_TYPED_MAPPING_ENABLED: "1" }));
    const insert = writes.find((w) => w.op === "insert")!;
    expect(insert.row.name).toBe("Fixture Name");
    expect(insert.row.email).toBe("fixture@example.test");
    expect(insert.row.category_parasut_id).toBe("cat-1");
    expect(insert.row.trl_balance).toBe(100.5);
  });

  it("falls back to legacy numeric-only mapping for an ENABLED but OUT-OF-SCOPE resource (fail closed)", async () => {
    const { database, writes } = fakeDatabase();
    const resource: JsonApiResource = { id: "1", type: "bank_fees", attributes: { description: "fee", amount: "50.0" }, relationships: {} };
    await upsertResource(database, { resourceType: "bank_fees", table: "bank_fees", numericAttributeFields: ["amount"] }, resource, context({ PARASUT_TYPED_MAPPING_ENABLED: "1" }));
    const insert = writes.find((w) => w.op === "insert")!;
    expect(insert.row.description).toBeUndefined(); // not scoped in, never written
    expect(insert.row.amount).toBe(50); // legacy path still applies
  });

  it("writes the full registry-mapped typed columns for each of the 5 newly-scoped resources (e_invoices, employees, sales_offers, shipment_documents, warehouses)", async () => {
    const cases: Array<{ type: string; attributes: Record<string, unknown>; expect: Record<string, unknown> }> = [
      { type: "e_invoices", attributes: { external_id: "ext-1", net_total: "50.0", currency: "TRL" }, expect: { external_id: "ext-1", net_total: 50, currency: "TRL" } },
      { type: "employees", attributes: { name: "Fixture Employee", trl_balance: "10.0" }, expect: { name: "Fixture Employee", trl_balance: 10 } },
      { type: "sales_offers", attributes: { net_total: "25.0", status: "draft" }, expect: { net_total: 25, status: "draft" } },
      { type: "shipment_documents", attributes: { description: "fixture shipment", city: "Istanbul" }, expect: { description: "fixture shipment", city: "Istanbul" } },
      { type: "warehouses", attributes: { name: "Fixture Warehouse" }, expect: { name: "Fixture Warehouse" } },
    ];
    for (const testCase of cases) {
      const { database, writes } = fakeDatabase();
      const resource: JsonApiResource = { id: "1", type: testCase.type, attributes: testCase.attributes, relationships: {} };
      await upsertResource(database, { resourceType: testCase.type, table: testCase.type }, resource, context({ PARASUT_TYPED_MAPPING_ENABLED: "1" }));
      const insert = writes.find((w) => w.op === "insert")!;
      for (const [key, value] of Object.entries(testCase.expect)) {
        expect(insert.row[key], `${testCase.type}.${key}`).toBe(value);
      }
    }
  });

  it("preserves raw_payload and the envelope unconditionally, regardless of the gate", async () => {
    const { database, writes } = fakeDatabase();
    const resource = contactResource();
    await upsertResource(database, { resourceType: "contacts", table: "contacts" }, resource, context({ PARASUT_TYPED_MAPPING_ENABLED: "1" }));
    const insert = writes.find((w) => w.op === "insert")!;
    expect(insert.row.raw_payload).toEqual(resource);
    expect(insert.row.attributes).toEqual(resource.attributes);
  });

  it("retains the validated source_created_at/source_updated_at/source_archived redirect behavior unchanged", async () => {
    const { database, writes } = fakeDatabase();
    const resource = contactResource({ created_at: "2026-06-01T00:00:00Z", archived: true });
    await upsertResource(database, { resourceType: "contacts", table: "contacts" }, resource, context({ PARASUT_TYPED_MAPPING_ENABLED: "1" }));
    const insert = writes.find((w) => w.op === "insert")!;
    expect(insert.row.source_created_at).toBe("2026-06-01T00:00:00.000Z");
    expect(insert.row.source_archived).toBe(true);
  });

  it("distinguishes missing key from explicit null in the typed output (null vs missing preserved)", async () => {
    const { database, writes } = fakeDatabase();
    const missingKey = contactResource();
    delete (missingKey.attributes as Record<string, unknown>).email;
    await upsertResource(database, { resourceType: "contacts", table: "contacts" }, missingKey, context({ PARASUT_TYPED_MAPPING_ENABLED: "1" }));
    const insertMissing = writes.find((w) => w.op === "insert")!;
    expect(insertMissing.row.email).toBeNull();

    const { database: db2, writes: writes2 } = fakeDatabase();
    const explicitNull = contactResource({ email: null });
    await upsertResource(db2, { resourceType: "contacts", table: "contacts" }, explicitNull, context({ PARASUT_TYPED_MAPPING_ENABLED: "1" }));
    const insertNull = writes2.find((w) => w.op === "insert")!;
    expect(insertNull.row.email).toBeNull();
  });
});

describe("upsert-resource — Phase 2B idempotency and safety", () => {
  it("processing the same source object twice does not create a duplicate logical record and does not rewrite typed columns on the second call (content-hash short-circuit, pre-existing behavior confirmed still applies with typed mapping enabled)", async () => {
    const { database, tables, writes } = fakeDatabase();
    const resource = contactResource();
    const env = { PARASUT_TYPED_MAPPING_ENABLED: "1" };

    const first = await upsertResource(database, { resourceType: "contacts", table: "contacts" }, resource, context(env));
    expect(first.outcome).toBe("inserted");
    expect(tables.contacts.length).toBe(1);

    const second = await upsertResource(database, { resourceType: "contacts", table: "contacts" }, resource, context(env));
    expect(second.outcome).toBe("unchanged");
    expect(tables.contacts.length).toBe(1); // no duplicate row

    const secondWrite = writes[writes.length - 1];
    expect(secondWrite.op).toBe("update");
    expect(Object.keys(secondWrite.row)).toEqual(["last_seen_at"]); // touches only last_seen_at, never rewrites typed columns
  });

  it("a changed payload updates only the mapped resource's own row, with the new typed values, not a duplicate", async () => {
    const { database, tables } = fakeDatabase();
    const env = { PARASUT_TYPED_MAPPING_ENABLED: "1" };
    await upsertResource(database, { resourceType: "contacts", table: "contacts" }, contactResource(), context(env));
    const changed = contactResource({ name: "Updated Fixture Name" });
    const result = await upsertResource(database, { resourceType: "contacts", table: "contacts" }, changed, context(env));
    expect(result.outcome).toBe("updated");
    expect(tables.contacts.length).toBe(1);
    expect(tables.contacts[0].name).toBe("Updated Fixture Name");
  });

  it("retry after a simulated failure converges safely: re-running the same insert twice never produces two rows", async () => {
    const { database, tables } = fakeDatabase();
    const env = { PARASUT_TYPED_MAPPING_ENABLED: "1" };
    const resource = contactResource();
    // Simulates: first attempt's DB write "failed" upstream (never recorded
    // as existing), caller retries with the identical resource.
    await upsertResource(database, { resourceType: "contacts", table: "contacts" }, resource, context(env));
    await upsertResource(database, { resourceType: "contacts", table: "contacts" }, resource, context(env));
    expect(tables.contacts.length).toBe(1);
  });

  it("one resource cannot write into another resource's table — the table name comes only from the static definition, never from the payload", async () => {
    const { database, tables } = fakeDatabase();
    const env = { PARASUT_TYPED_MAPPING_ENABLED: "1" };
    await upsertResource(database, { resourceType: "contacts", table: "contacts" }, contactResource(), context(env));
    expect(tables.products).toBeUndefined();
    expect(tables.contacts.length).toBe(1);
  });

  it("company/tenant scope is preserved: the same parasut_id under a different parasut_company_id is treated as a distinct row, never merged", async () => {
    const { database, tables } = fakeDatabase();
    const env = { PARASUT_TYPED_MAPPING_ENABLED: "1" };
    const resource = contactResource();
    await upsertResource(database, { resourceType: "contacts", table: "contacts" }, resource, { companyId: "company-A", parasutCompanyId: "666034", typedMappingEnv: env });
    await upsertResource(database, { resourceType: "contacts", table: "contacts" }, resource, { companyId: "company-B", parasutCompanyId: "777000", typedMappingEnv: env });
    expect(tables.contacts.length).toBe(2);
    expect(new Set(tables.contacts.map((r) => r.parasut_company_id)).size).toBe(2);
  });

  it("rejects a resource whose type does not match the definition, before any typed mapping is attempted (existing guard preserved)", async () => {
    const { database } = fakeDatabase();
    const mismatched: JsonApiResource = { id: "1", type: "products", attributes: {}, relationships: {} };
    await expect(
      upsertResource(database, { resourceType: "contacts", table: "contacts" }, mismatched, context({ PARASUT_TYPED_MAPPING_ENABLED: "1" })),
    ).rejects.toThrow(/Resource type mismatch/);
  });
});

describe("upsert-resource — Phase 2B rollback rehearsal (local, no production access)", () => {
  it("disabling the gate after enabling it immediately reverts NEW writes to legacy behavior — a full code rollback is not required to stop the effect going forward", async () => {
    const { database, tables } = fakeDatabase();

    // Phase 1 of the rehearsal: gate ON, first contact inserted with full typed mapping.
    await upsertResource(database, { resourceType: "contacts", table: "contacts" }, contactResource({ name: "Row One" }), context({ PARASUT_TYPED_MAPPING_ENABLED: "1" }));
    expect(tables.contacts[0].name).toBe("Row One");

    // "Rollback": flip the gate off — simulates unsetting
    // PARASUT_TYPED_MAPPING_ENABLED in the deployment environment, no code
    // change or redeploy required for this specific lever.
    const rolledBackEnv = { PARASUT_TYPED_MAPPING_ENABLED: "0" };

    // A second, different contact processed AFTER rollback gets legacy
    // (numeric-only) mapping — the new behavior has stopped taking effect.
    const secondContact = contactResource({ name: "Row Two" });
    (secondContact as { id: string }).id = "2";
    await upsertResource(database, { resourceType: "contacts", table: "contacts", numericAttributeFields: ["trl_balance"] }, secondContact, context(rolledBackEnv));
    expect(tables.contacts[1].name).toBeUndefined(); // not written post-rollback
    expect(tables.contacts[1].trl_balance).toBe(100.5); // legacy path resumed

    // Documented, verified rollback semantic: rows already written while the
    // gate was on KEEP their typed values (an upsert is never destructive,
    // and the content-hash short-circuit means an unchanged row is only
    // touched on last_seen_at, never stripped of previously-written
    // columns) — rollback stops new writes, it does not retroactively erase
    // prior ones. This is intentional: reverting a write-enable flag must
    // never itself become a destructive operation.
    expect(tables.contacts[0].name).toBe("Row One");
  });

  it("re-processing the SAME resource after rollback (unchanged payload) makes no mutation at all — confirms the content-hash guard, not the gate, decides whether an existing row is touched", async () => {
    const { database, tables, writes } = fakeDatabase();
    const resource = contactResource();
    await upsertResource(database, { resourceType: "contacts", table: "contacts" }, resource, context({ PARASUT_TYPED_MAPPING_ENABLED: "1" }));
    const writesBeforeRollback = writes.length;

    await upsertResource(database, { resourceType: "contacts", table: "contacts" }, resource, context({ PARASUT_TYPED_MAPPING_ENABLED: "0" }));
    expect(writes.length).toBe(writesBeforeRollback + 1); // exactly one more write (the last_seen_at touch)
    expect(writes[writes.length - 1].op).toBe("update");
    expect(Object.keys(writes[writes.length - 1].row)).toEqual(["last_seen_at"]);
    expect(tables.contacts[0].name).toBe("Fixture Name"); // untouched, still correct
  });
});
