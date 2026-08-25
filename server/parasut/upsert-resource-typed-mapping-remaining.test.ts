import { describe, expect, it } from "vitest";
import { upsertResource } from "./upsert-resource.ts";
import { FIELD_MAPPING_REGISTRY } from "./field-mapping-registry.ts";
import { D8_FIELD_KEYS } from "./verification/d8-resolution.ts";
import type { JsonApiResource, MirrorDatabase, MirrorTable } from "./types.ts";

// Exhaustive, field-by-field proof for every D8 key newly wired by
// d84b4b5 "feat(parasut): add remaining Phase 2B sync entry points"
// (e_invoices, employees, sales_offers, shipment_documents, warehouses).
//
// This supersedes the sample-based claims in sync-remaining-resources.test.ts
// and the earlier partial upsert-resource-typed-mapping.test.ts coverage
// (which only exercised one representative field per resource). Every field
// below is driven through the REAL upsertResource() write path — the same
// function production calls — never deriveTypedRow() or deriveOfflineRow()
// directly, and never registry-presence-only assertions.
//
// COUNT RECONCILIATION (see docs/parasut/PARASUT_PROFESSIONAL_INTEGRATION_MASTER_PLAN.md
// Phase 2B section for the full writeup): the resource-by-resource arithmetic
// previously documented for d84b4b5 was 23 + 6 + 21 + 9 + 1 = 60, which does
// not even sum to the claimed total of 63. Both the per-resource numbers
// (e_invoices, sales_offers in particular) and the arithmetic were wrong.
// The authoritative count, derived programmatically below directly from
// D8_FIELD_KEYS and FIELD_MAPPING_REGISTRY (not retyped by hand), is:
//   e_invoices=19, employees=6, sales_offers=28, shipment_documents=9,
//   warehouses=1  => 63 total.
// The total of 63 was in fact correct; only the published per-resource
// breakdown was wrong. No nested/included resource (e.g. sales_offers_details)
// contributes any D8 field — D8_FIELD_KEYS contains zero
// "sales_offers_details.*" keys, confirmed by the derivation below.
// 88 (previously proven, accounts/products/purchase_bills/sales_invoices)
// + 63 (this file) = 151, the full D8 set.

const PREVIOUSLY_WIRED_RESOURCES = new Set(["accounts", "products", "purchase_bills", "sales_invoices"]);

/** Every D8 key belonging to one of the 5 newly-wired resources — derived, not hand-typed. */
const DERIVED_NEW_KEYS: readonly string[] = D8_FIELD_KEYS.filter(
  (key) => !PREVIOUSLY_WIRED_RESOURCES.has(key.split(".")[0]),
);

type PgType = "text" | "numeric" | "boolean" | "date" | "timestamptz" | "jsonb";

interface FieldCase {
  key: string;
  resource: string;
  attribute: string;
  expectedColumn: string;
  expectedPgType: PgType;
  raw: unknown;
  expect: unknown;
}

// One deterministic, non-ambiguous (raw, expect) pair per field, hand-built
// per expectedPgType so every assertion is traceable back to a specific D8 key.
const CASES: readonly FieldCase[] = [
  // e_invoices (19 fields)
  { key: "e_invoices.external_id", resource: "e_invoices", attribute: "external_id", expectedColumn: "external_id", expectedPgType: "text", raw: "val-external_id", expect: "val-external_id" },
  { key: "e_invoices.uuid", resource: "e_invoices", attribute: "uuid", expectedColumn: "uuid", expectedPgType: "text", raw: "val-uuid", expect: "val-uuid" },
  { key: "e_invoices.env_uuid", resource: "e_invoices", attribute: "env_uuid", expectedColumn: "env_uuid", expectedPgType: "text", raw: "val-env_uuid", expect: "val-env_uuid" },
  { key: "e_invoices.from_address", resource: "e_invoices", attribute: "from_address", expectedColumn: "from_address", expectedPgType: "text", raw: "val-from_address", expect: "val-from_address" },
  { key: "e_invoices.from_vkn", resource: "e_invoices", attribute: "from_vkn", expectedColumn: "from_vkn", expectedPgType: "text", raw: "val-from_vkn", expect: "val-from_vkn" },
  { key: "e_invoices.to_address", resource: "e_invoices", attribute: "to_address", expectedColumn: "to_address", expectedPgType: "text", raw: "val-to_address", expect: "val-to_address" },
  { key: "e_invoices.to_vkn", resource: "e_invoices", attribute: "to_vkn", expectedColumn: "to_vkn", expectedPgType: "text", raw: "val-to_vkn", expect: "val-to_vkn" },
  { key: "e_invoices.direction", resource: "e_invoices", attribute: "direction", expectedColumn: "direction", expectedPgType: "text", raw: "val-direction", expect: "val-direction" },
  { key: "e_invoices.note", resource: "e_invoices", attribute: "note", expectedColumn: "note", expectedPgType: "text", raw: "val-note", expect: "val-note" },
  { key: "e_invoices.response_type", resource: "e_invoices", attribute: "response_type", expectedColumn: "response_type", expectedPgType: "text", raw: "val-response_type", expect: "val-response_type" },
  { key: "e_invoices.contact_name", resource: "e_invoices", attribute: "contact_name", expectedColumn: "contact_name", expectedPgType: "text", raw: "val-contact_name", expect: "val-contact_name" },
  { key: "e_invoices.scenario", resource: "e_invoices", attribute: "scenario", expectedColumn: "scenario", expectedPgType: "text", raw: "val-scenario", expect: "val-scenario" },
  { key: "e_invoices.status", resource: "e_invoices", attribute: "status", expectedColumn: "status", expectedPgType: "text", raw: "val-status", expect: "val-status" },
  { key: "e_invoices.issue_date", resource: "e_invoices", attribute: "issue_date", expectedColumn: "issue_date", expectedPgType: "date", raw: "2026-03-14", expect: "2026-03-14" },
  { key: "e_invoices.is_expired", resource: "e_invoices", attribute: "is_expired", expectedColumn: "is_expired", expectedPgType: "boolean", raw: true, expect: true },
  { key: "e_invoices.is_answerable", resource: "e_invoices", attribute: "is_answerable", expectedColumn: "is_answerable", expectedPgType: "boolean", raw: false, expect: false },
  { key: "e_invoices.net_total", resource: "e_invoices", attribute: "net_total", expectedColumn: "net_total", expectedPgType: "numeric", raw: "25.5", expect: 25.5 },
  { key: "e_invoices.currency", resource: "e_invoices", attribute: "currency", expectedColumn: "currency", expectedPgType: "text", raw: "val-currency", expect: "val-currency" },
  { key: "e_invoices.item_type", resource: "e_invoices", attribute: "item_type", expectedColumn: "item_type", expectedPgType: "text", raw: "val-item_type", expect: "val-item_type" },
  // employees (6 fields)
  { key: "employees.balance", resource: "employees", attribute: "balance", expectedColumn: "balance", expectedPgType: "numeric", raw: "30", expect: 30 },
  { key: "employees.trl_balance", resource: "employees", attribute: "trl_balance", expectedColumn: "trl_balance", expectedPgType: "numeric", raw: "31.5", expect: 31.5 },
  { key: "employees.usd_balance", resource: "employees", attribute: "usd_balance", expectedColumn: "usd_balance", expectedPgType: "numeric", raw: "33", expect: 33 },
  { key: "employees.eur_balance", resource: "employees", attribute: "eur_balance", expectedColumn: "eur_balance", expectedPgType: "numeric", raw: "34.5", expect: 34.5 },
  { key: "employees.gbp_balance", resource: "employees", attribute: "gbp_balance", expectedColumn: "gbp_balance", expectedPgType: "numeric", raw: "36", expect: 36 },
  { key: "employees.name", resource: "employees", attribute: "name", expectedColumn: "name", expectedPgType: "text", raw: "val-name", expect: "val-name" },
  // sales_offers (28 fields)
  { key: "sales_offers.content", resource: "sales_offers", attribute: "content", expectedColumn: "content", expectedPgType: "text", raw: "val-content", expect: "val-content" },
  { key: "sales_offers.contact_type", resource: "sales_offers", attribute: "contact_type", expectedColumn: "contact_type", expectedPgType: "text", raw: "val-contact_type", expect: "val-contact_type" },
  { key: "sales_offers.sharings_count", resource: "sales_offers", attribute: "sharings_count", expectedColumn: "sharings_count", expectedPgType: "numeric", raw: "42", expect: 42 },
  { key: "sales_offers.status", resource: "sales_offers", attribute: "status", expectedColumn: "status", expectedPgType: "text", raw: "val-status", expect: "val-status" },
  { key: "sales_offers.display_exchange_rate_in_pdf", resource: "sales_offers", attribute: "display_exchange_rate_in_pdf", expectedColumn: "display_exchange_rate_in_pdf", expectedPgType: "boolean", raw: false, expect: false },
  { key: "sales_offers.net_total", resource: "sales_offers", attribute: "net_total", expectedColumn: "net_total", expectedPgType: "numeric", raw: "46.5", expect: 46.5 },
  { key: "sales_offers.gross_total", resource: "sales_offers", attribute: "gross_total", expectedColumn: "gross_total", expectedPgType: "numeric", raw: "48", expect: 48 },
  { key: "sales_offers.withholding", resource: "sales_offers", attribute: "withholding", expectedColumn: "withholding", expectedPgType: "numeric", raw: "49.5", expect: 49.5 },
  { key: "sales_offers.total_excise_duty", resource: "sales_offers", attribute: "total_excise_duty", expectedColumn: "total_excise_duty", expectedPgType: "numeric", raw: "51", expect: 51 },
  { key: "sales_offers.total_communications_tax", resource: "sales_offers", attribute: "total_communications_tax", expectedColumn: "total_communications_tax", expectedPgType: "numeric", raw: "52.5", expect: 52.5 },
  { key: "sales_offers.total_accommodation_tax", resource: "sales_offers", attribute: "total_accommodation_tax", expectedColumn: "total_accommodation_tax", expectedPgType: "numeric", raw: "54", expect: 54 },
  { key: "sales_offers.total_vat", resource: "sales_offers", attribute: "total_vat", expectedColumn: "total_vat", expectedPgType: "numeric", raw: "55.5", expect: 55.5 },
  { key: "sales_offers.total_vat_withholding", resource: "sales_offers", attribute: "total_vat_withholding", expectedColumn: "total_vat_withholding", expectedPgType: "numeric", raw: "57", expect: 57 },
  { key: "sales_offers.vat_withholding", resource: "sales_offers", attribute: "vat_withholding", expectedColumn: "vat_withholding", expectedPgType: "numeric", raw: "58.5", expect: 58.5 },
  { key: "sales_offers.total_discount", resource: "sales_offers", attribute: "total_discount", expectedColumn: "total_discount", expectedPgType: "numeric", raw: "60", expect: 60 },
  { key: "sales_offers.total_invoice_discount", resource: "sales_offers", attribute: "total_invoice_discount", expectedColumn: "total_invoice_discount", expectedPgType: "numeric", raw: "61.5", expect: 61.5 },
  { key: "sales_offers.description", resource: "sales_offers", attribute: "description", expectedColumn: "description", expectedPgType: "text", raw: "val-description", expect: "val-description" },
  { key: "sales_offers.issue_date", resource: "sales_offers", attribute: "issue_date", expectedColumn: "issue_date", expectedPgType: "date", raw: "2026-03-16", expect: "2026-03-16" },
  { key: "sales_offers.due_date", resource: "sales_offers", attribute: "due_date", expectedColumn: "due_date", expectedPgType: "date", raw: "2026-03-17", expect: "2026-03-17" },
  { key: "sales_offers.currency", resource: "sales_offers", attribute: "currency", expectedColumn: "currency", expectedPgType: "text", raw: "val-currency", expect: "val-currency" },
  { key: "sales_offers.exchange_rate", resource: "sales_offers", attribute: "exchange_rate", expectedColumn: "exchange_rate", expectedPgType: "numeric", raw: "69", expect: 69 },
  { key: "sales_offers.withholding_rate", resource: "sales_offers", attribute: "withholding_rate", expectedColumn: "withholding_rate", expectedPgType: "numeric", raw: "70.5", expect: 70.5 },
  { key: "sales_offers.invoice_discount_type", resource: "sales_offers", attribute: "invoice_discount_type", expectedColumn: "invoice_discount_type", expectedPgType: "text", raw: "val-invoice_discount_type", expect: "val-invoice_discount_type" },
  { key: "sales_offers.invoice_discount", resource: "sales_offers", attribute: "invoice_discount", expectedColumn: "invoice_discount", expectedPgType: "numeric", raw: "73.5", expect: 73.5 },
  { key: "sales_offers.billing_address", resource: "sales_offers", attribute: "billing_address", expectedColumn: "billing_address", expectedPgType: "text", raw: "val-billing_address", expect: "val-billing_address" },
  { key: "sales_offers.tax_office", resource: "sales_offers", attribute: "tax_office", expectedColumn: "tax_office", expectedPgType: "text", raw: "val-tax_office", expect: "val-tax_office" },
  { key: "sales_offers.tax_number", resource: "sales_offers", attribute: "tax_number", expectedColumn: "tax_number", expectedPgType: "text", raw: "val-tax_number", expect: "val-tax_number" },
  { key: "sales_offers.is_abroad", resource: "sales_offers", attribute: "is_abroad", expectedColumn: "is_abroad", expectedPgType: "boolean", raw: true, expect: true },
  // shipment_documents (9 fields)
  { key: "shipment_documents.print_note", resource: "shipment_documents", attribute: "print_note", expectedColumn: "print_note", expectedPgType: "text", raw: "val-print_note", expect: "val-print_note" },
  { key: "shipment_documents.inflow", resource: "shipment_documents", attribute: "inflow", expectedColumn: "inflow", expectedPgType: "boolean", raw: true, expect: true },
  { key: "shipment_documents.description", resource: "shipment_documents", attribute: "description", expectedColumn: "description", expectedPgType: "text", raw: "val-description", expect: "val-description" },
  { key: "shipment_documents.city", resource: "shipment_documents", attribute: "city", expectedColumn: "city", expectedPgType: "text", raw: "val-city", expect: "val-city" },
  { key: "shipment_documents.district", resource: "shipment_documents", attribute: "district", expectedColumn: "district", expectedPgType: "text", raw: "val-district", expect: "val-district" },
  { key: "shipment_documents.address", resource: "shipment_documents", attribute: "address", expectedColumn: "address", expectedPgType: "text", raw: "val-address", expect: "val-address" },
  { key: "shipment_documents.issue_date", resource: "shipment_documents", attribute: "issue_date", expectedColumn: "issue_date", expectedPgType: "date", raw: "2026-03-15", expect: "2026-03-15" },
  { key: "shipment_documents.shipment_date", resource: "shipment_documents", attribute: "shipment_date", expectedColumn: "shipment_date", expectedPgType: "timestamptz", raw: "2026-03-15T06:00:00Z", expect: "2026-03-15T06:00:00Z" },
  { key: "shipment_documents.procurement_number", resource: "shipment_documents", attribute: "procurement_number", expectedColumn: "procurement_number", expectedPgType: "text", raw: "val-procurement_number", expect: "val-procurement_number" },
  // warehouses (1 field)
  { key: "warehouses.name", resource: "warehouses", attribute: "name", expectedColumn: "name", expectedPgType: "text", raw: "val-name", expect: "val-name" },
];

// ---------------------------------------------------------------------------
// Meta-assertions: prove the CASES table itself is exhaustive and correct
// BEFORE trusting any individual per-field assertion below.
// ---------------------------------------------------------------------------
describe("exhaustive D8 field-mapping proof — meta-assertions on the case table itself", () => {
  it("the authoritative newly-wired D8 field count is exactly 63", () => {
    expect(DERIVED_NEW_KEYS.length).toBe(63);
  });

  it("resource-by-resource breakdown matches the corrected documentation (e_invoices=19, employees=6, sales_offers=28, shipment_documents=9, warehouses=1)", () => {
    const counts: Record<string, number> = {};
    for (const key of DERIVED_NEW_KEYS) {
      const resource = key.split(".")[0];
      counts[resource] = (counts[resource] ?? 0) + 1;
    }
    expect(counts).toEqual({
      e_invoices: 19,
      employees: 6,
      sales_offers: 28,
      shipment_documents: 9,
      warehouses: 1,
    });
  });

  it("88 previously-proven fields + 63 newly-wired fields reconcile to the full 151 D8 set", () => {
    const previouslyProvenCount = D8_FIELD_KEYS.filter((k) => PREVIOUSLY_WIRED_RESOURCES.has(k.split(".")[0])).length;
    expect(previouslyProvenCount).toBe(88);
    expect(previouslyProvenCount + DERIVED_NEW_KEYS.length).toBe(D8_FIELD_KEYS.length);
    expect(D8_FIELD_KEYS.length).toBe(151);
  });

  it("no D8 key belongs to a nested/included resource type (e.g. sales_offers_details) — all 63 are flat top-level resource attributes", () => {
    const nestedKeys = D8_FIELD_KEYS.filter((k) => k.startsWith("sales_offers_details.") || k.startsWith("purchase_bill_details.") || k.startsWith("sales_invoice_details."));
    expect(nestedKeys).toEqual([]);
  });

  it("CASES contains exactly one entry per derived newly-wired D8 key — no omission, no extra, no duplicate", () => {
    const caseKeys = CASES.map((c) => c.key);
    expect(caseKeys.length).toBe(DERIVED_NEW_KEYS.length);
    expect(new Set(caseKeys).size).toBe(caseKeys.length); // uniqueness
    expect([...caseKeys].sort()).toEqual([...DERIVED_NEW_KEYS].sort());
  });

  it("every CASES key exists verbatim in D8_FIELD_KEYS", () => {
    const d8Set = new Set(D8_FIELD_KEYS);
    for (const c of CASES) {
      expect(d8Set.has(c.key), `expected D8_FIELD_KEYS to contain ${c.key}`).toBe(true);
    }
  });

  it("every CASES key has exactly one accepted FIELD_MAPPING_REGISTRY entry, and CASES's expectedColumn/expectedPgType match it exactly", () => {
    for (const c of CASES) {
      const matches = FIELD_MAPPING_REGISTRY.filter((f) => f.resource === c.resource && f.attribute === c.attribute);
      expect(matches.length, `expected exactly one registry mapping for ${c.key}, found ${matches.length}`).toBe(1);
      expect(matches[0].expectedColumn, `${c.key} expectedColumn mismatch`).toBe(c.expectedColumn);
      expect(matches[0].expectedPgType, `${c.key} expectedPgType mismatch`).toBe(c.expectedPgType);
      expect(matches[0].sourceLocation, `${c.key} sourceLocation mismatch`).toBe("attributes");
    }
  });

  it("covers all 5 newly-wired wrapper families with at least one field each, and no other resource", () => {
    const resourcesCovered = new Set(CASES.map((c) => c.resource));
    expect(resourcesCovered).toEqual(new Set(["e_invoices", "employees", "sales_offers", "shipment_documents", "warehouses"]));
  });
});

// ---------------------------------------------------------------------------
// The real proof: for each of the 63 fields, build a JSON:API fixture,
// run it through upsertResource() with the gate enabled (test-local env
// only), and inspect the ACTUAL row the fake database captured.
// ---------------------------------------------------------------------------

interface FakeRow {
  id: string;
  [key: string]: unknown;
}

function fakeDatabase() {
  const tables: Record<string, FakeRow[]> = {};
  const writes: Array<{ table: string; op: "insert" | "update"; row: Record<string, unknown> }> = [];

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

const context = {
  companyId: "company-A",
  parasutCompanyId: "666034",
  now: new Date("2026-07-26T00:00:00Z"),
  // Test-local only — never set in real config. See typed-mapping-gate.ts.
  typedMappingEnv: { PARASUT_TYPED_MAPPING_ENABLED: "1" },
};

describe("upsert-resource — exhaustive per-field proof for all 63 newly-wired D8 fields (real upsertResource path)", () => {
  // Group cases by resource so each resource is exercised via one realistic
  // fixture containing ALL of its own D8 fields at once (closer to a real
  // Paraşüt payload than one fixture per field, while still asserting each
  // field individually and by its own D8 key in the failure message).
  const byResource = new Map<string, FieldCase[]>();
  for (const c of CASES) {
    const list = byResource.get(c.resource) ?? [];
    list.push(c);
    byResource.set(c.resource, list);
  }

  const assertedColumns: string[] = [];

  // The Phase-2B resource set this file proves — compile-time-checked
  // against the engine's MirrorTable union so the upsertResource call below
  // stays honestly typed instead of casting an arbitrary string.
  const PHASE_2B_RESOURCES = [
    "e_invoices",
    "employees",
    "sales_offers",
    "shipment_documents",
    "warehouses",
  ] as const satisfies readonly MirrorTable[];

  for (const [resourceName, cases] of byResource) {
    const resource = PHASE_2B_RESOURCES.find((candidate) => candidate === resourceName);
    if (!resource) throw new Error(`Unexpected Phase-2B resource in CASES: ${resourceName}`);
    it(`${resource}: every one of its ${cases.length} D8-newly-wired fields is written to the correct column with the correctly converted value`, async () => {
      const attributes: Record<string, unknown> = {};
      for (const c of cases) attributes[c.attribute] = c.raw;

      const resourceFixture: JsonApiResource = {
        id: "1",
        type: resource,
        attributes,
        relationships: {},
      };

      const { database, writes } = fakeDatabase();
      await upsertResource(database, { resourceType: resource, table: resource }, resourceFixture, context);
      const insert = writes.find((w) => w.op === "insert");
      expect(insert, `expected an insert write for resource ${resource}`).toBeDefined();

      for (const c of cases) {
        expect(insert!.row[c.expectedColumn], `${c.key} (column "${c.expectedColumn}") did not persist the expected typed value through upsertResource`).toEqual(c.expect);
        assertedColumns.push(c.key);
      }
    });
  }

  it("meta: every one of the 63 fields was actually asserted above — nothing silently skipped", () => {
    // Populated by the per-resource `it` blocks above; vitest runs them in
    // declaration order within a describe block, so by the time this final
    // test runs, assertedColumns is fully populated.
    expect(new Set(assertedColumns).size).toBe(63);
    expect([...assertedColumns].sort()).toEqual([...CASES.map((c) => c.key)].sort());
  });

  it("mutation-sensitivity: the exhaustive proof fails if a single registry mapping is removed (regression tripwire, not a live mutation of the registry)", () => {
    // Simulates "field mapping removed/renamed" without actually mutating the
    // shared FIELD_MAPPING_REGISTRY module (which other tests/files import):
    // re-run the same exhaustiveness check the meta-assertions above perform,
    // against a registry snapshot with one D8-mapped entry deleted, and
    // confirm it would indeed be caught.
    const withoutOneMapping = FIELD_MAPPING_REGISTRY.filter(
      (f) => !(f.resource === "sales_offers" && f.attribute === "net_total"),
    );
    const stillMapped = withoutOneMapping.filter((f) => f.resource === "sales_offers" && f.attribute === "net_total");
    expect(stillMapped.length).toBe(0); // confirms the simulated removal actually removed it
    // The exhaustiveness assertion this file relies on ("every CASES key has
    // exactly one registry mapping") would fail against this snapshot:
    const wouldStillPass = CASES.every((c) => {
      const matches = withoutOneMapping.filter((f) => f.resource === c.resource && f.attribute === c.attribute);
      return matches.length === 1;
    });
    expect(wouldStillPass).toBe(false);
  });
});
