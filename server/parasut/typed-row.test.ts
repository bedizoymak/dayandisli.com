import { describe, expect, it } from "vitest";
import { deriveTypedRow, type ColumnSpec } from "./typed-row.ts";
import type { JsonApiResource } from "./types.ts";

const WAREHOUSE_COLUMNS: ColumnSpec[] = [
  { name: "name", kind: "text" },
  { name: "address", kind: "text" },
  { name: "city", kind: "text" },
  { name: "district", kind: "text" },
  { name: "is_abroad", kind: "boolean" },
  { name: "inventory_levels", kind: "jsonb" },
  { name: "source_created_at", kind: "timestamptz" },
  { name: "source_updated_at", kind: "timestamptz" },
  { name: "source_archived", kind: "boolean" },
];

function warehouse(overrides: Partial<JsonApiResource["attributes"]> = {}): JsonApiResource {
  return {
    id: "1000122982",
    type: "warehouses",
    attributes: {
      created_at: "2023-11-29T06:22:30.501Z",
      updated_at: "2023-11-29T06:22:30.501Z",
      name: "Ana Depo",
      archived: false,
      address: null,
      city: null,
      district: null,
      is_abroad: null,
      ...overrides,
    },
    relationships: { inventory_levels: { meta: {} } },
  };
}

describe("deriveTypedRow", () => {
  it("produces exactly the requested column set, regardless of which attributes the resource has", () => {
    const full = deriveTypedRow(warehouse({ city: "İstanbul" }), WAREHOUSE_COLUMNS);
    const sparse = deriveTypedRow(
      { id: "2", type: "warehouses", attributes: { name: "Depo 2" } },
      WAREHOUSE_COLUMNS,
    );
    const expectedKeys = WAREHOUSE_COLUMNS.map((c) => c.name).sort();
    expect(Object.keys(full.values).sort()).toEqual(expectedKeys);
    expect(Object.keys(sparse.values).sort()).toEqual(expectedKeys);
  });

  it("is deterministic for identical input", () => {
    const item = warehouse();
    expect(deriveTypedRow(item, WAREHOUSE_COLUMNS)).toEqual(deriveTypedRow(item, WAREHOUSE_COLUMNS));
  });

  it("maps attributes.created_at/updated_at/archived onto the source_* columns, not their own names", () => {
    const { values } = deriveTypedRow(warehouse(), WAREHOUSE_COLUMNS);
    expect(values.source_created_at).toBe("2023-11-29T06:22:30.501Z");
    expect(values.source_updated_at).toBe("2023-11-29T06:22:30.501Z");
    expect(values.source_archived).toBe(false);
  });

  it("maps a plain text attribute through untouched", () => {
    const { values } = deriveTypedRow(warehouse(), WAREHOUSE_COLUMNS);
    expect(values.name).toBe("Ana Depo");
  });

  it("fills missing attributes with null instead of omitting the column", () => {
    const { values } = deriveTypedRow(warehouse(), WAREHOUSE_COLUMNS);
    expect(values.address).toBeNull();
    expect(values.city).toBeNull();
  });

  it("maps an array relationship to its own jsonb column, defaulting to [] when absent", () => {
    const withData: JsonApiResource = {
      id: "1",
      type: "warehouses",
      attributes: { name: "X" },
      relationships: { inventory_levels: { data: [{ id: "5", type: "inventory_levels" }] } },
    };
    expect(deriveTypedRow(withData, WAREHOUSE_COLUMNS).values.inventory_levels).toEqual([
      { id: "5", type: "inventory_levels" },
    ]);
    expect(deriveTypedRow(warehouse(), WAREHOUSE_COLUMNS).values.inventory_levels).toEqual([]);
  });

  it("maps a singular relationship to a _parasut_id column", () => {
    const columns: ColumnSpec[] = [{ name: "category_parasut_id", kind: "text" }];
    const item: JsonApiResource = {
      id: "1",
      type: "contacts",
      attributes: {},
      relationships: { category: { data: { id: "42", type: "item_categories" } } },
    };
    expect(deriveTypedRow(item, columns).values.category_parasut_id).toBe("42");
  });

  it("returns null for a singular relationship with no data", () => {
    const columns: ColumnSpec[] = [{ name: "category_parasut_id", kind: "text" }];
    const item: JsonApiResource = { id: "1", type: "contacts", attributes: {}, relationships: {} };
    expect(deriveTypedRow(item, columns).values.category_parasut_id).toBeNull();
  });

  describe("numeric conversion", () => {
    const columns: ColumnSpec[] = [{ name: "balance", kind: "numeric" }];

    it("converts a numeric string", () => {
      const item: JsonApiResource = { id: "1", type: "accounts", attributes: { balance: "1234.50" } };
      expect(deriveTypedRow(item, columns).values.balance).toBe(1234.5);
    });

    it("passes a real number through", () => {
      const item: JsonApiResource = { id: "1", type: "accounts", attributes: { balance: 42 } };
      expect(deriveTypedRow(item, columns).values.balance).toBe(42);
    });

    it("treats an empty string as null without a warning", () => {
      const item: JsonApiResource = { id: "1", type: "accounts", attributes: { balance: "" } };
      const result = deriveTypedRow(item, columns);
      expect(result.values.balance).toBeNull();
      expect(result.warnings).toHaveLength(0);
    });

    it("warns and nulls out non-numeric, non-empty text", () => {
      const item: JsonApiResource = { id: "1", type: "accounts", attributes: { balance: "not-a-number" } };
      const result = deriveTypedRow(item, columns);
      expect(result.values.balance).toBeNull();
      expect(result.warnings).toEqual([
        { resourceType: "accounts", parasutId: "1", field: "balance", receivedType: "string", expectedType: "numeric" },
      ]);
    });
  });

  describe("boolean conversion", () => {
    const columns: ColumnSpec[] = [{ name: "is_abroad", kind: "boolean" }];

    it("passes a real boolean through", () => {
      const item: JsonApiResource = { id: "1", type: "warehouses", attributes: { is_abroad: true } };
      expect(deriveTypedRow(item, columns).values.is_abroad).toBe(true);
    });

    it("warns and nulls out a non-boolean value", () => {
      const item: JsonApiResource = { id: "1", type: "warehouses", attributes: { is_abroad: "yes" } };
      const result = deriveTypedRow(item, columns);
      expect(result.values.is_abroad).toBeNull();
      expect(result.warnings[0].expectedType).toBe("boolean");
    });
  });

  describe("timestamp/date conversion", () => {
    const columns: ColumnSpec[] = [{ name: "issue_date", kind: "date" }];

    it("passes a parseable date string through", () => {
      const item: JsonApiResource = { id: "1", type: "sales_invoices", attributes: { issue_date: "2026-07-01" } };
      expect(deriveTypedRow(item, columns).values.issue_date).toBe("2026-07-01");
    });

    it("warns and nulls out an unparseable date string", () => {
      const item: JsonApiResource = { id: "1", type: "sales_invoices", attributes: { issue_date: "not-a-date" } };
      const result = deriveTypedRow(item, columns);
      expect(result.values.issue_date).toBeNull();
      expect(result.warnings[0].expectedType).toBe("date");
    });

    it("rejects a non-existent calendar date instead of silently rolling it over (2026-02-30)", () => {
      // Date.parse("2026-02-30") does NOT return NaN — V8 rolls it over to
      // 2026-03-02, which Postgres would then reject as an invalid ::date.
      const item: JsonApiResource = { id: "1", type: "sales_invoices", attributes: { issue_date: "2026-02-30" } };
      const result = deriveTypedRow(item, columns);
      expect(result.values.issue_date).toBeNull();
      expect(result.warnings).toEqual([
        { resourceType: "sales_invoices", parasutId: "1", field: "issue_date", receivedType: "string", expectedType: "date" },
      ]);
    });

    it("rejects April 31st (another silent Date rollover case)", () => {
      const item: JsonApiResource = { id: "1", type: "sales_invoices", attributes: { issue_date: "2026-04-31" } };
      expect(deriveTypedRow(item, columns).values.issue_date).toBeNull();
    });

    it("rejects month 13", () => {
      const item: JsonApiResource = { id: "1", type: "sales_invoices", attributes: { issue_date: "2026-13-01" } };
      expect(deriveTypedRow(item, columns).values.issue_date).toBeNull();
    });

    it("accepts a full ISO timestamp with a valid calendar date", () => {
      const item: JsonApiResource = {
        id: "1",
        type: "warehouses",
        attributes: { issue_date: "2023-11-29T06:22:30.501Z" },
      };
      expect(deriveTypedRow(item, columns).values.issue_date).toBe("2023-11-29T06:22:30.501Z");
    });
  });

  it("never includes the offending raw value in a warning (only its JS type)", () => {
    const item: JsonApiResource = {
      id: "1",
      type: "contacts",
      attributes: { tax_number: { unexpected: "object-instead-of-string" } },
    };
    const columns: ColumnSpec[] = [{ name: "tax_number", kind: "text" }];
    const result = deriveTypedRow(item, columns);
    const serialized = JSON.stringify(result.warnings);
    expect(serialized).not.toContain("unexpected");
    expect(serialized).not.toContain("object-instead-of-string");
    expect(result.warnings[0]).toEqual({
      resourceType: "contacts",
      parasutId: "1",
      field: "tax_number",
      receivedType: "object",
      expectedType: "text",
    });
  });

  it("passes jsonb object/array attributes through untouched", () => {
    const columns: ColumnSpec[] = [{ name: "invoicing_preferences", kind: "jsonb" }];
    const item: JsonApiResource = {
      id: "1",
      type: "contacts",
      attributes: { invoicing_preferences: { e_document_accounts: [1, 2, 3] } },
    };
    expect(deriveTypedRow(item, columns).values.invoicing_preferences).toEqual({
      e_document_accounts: [1, 2, 3],
    });
  });
});
