import { describe, expect, it } from "vitest";
import { FIELD_MAPPING_REGISTRY, REGISTRY_RESOURCES } from "./field-mapping-registry.ts";

// Mechanical proofs required by Phase 2A (master plan §15.4/TASK 5):
// - 401 official fields exist in the registry
// - resource totals equal the Phase 1 field matrix totals exactly
// - no registry resource has zero mapped fields
const EXPECTED_RESOURCE_TOTALS: Record<string, number> = {
  accounts: 13, bank_fees: 11, contacts: 26, e_archives: 10, e_invoice_inboxes: 6,
  e_invoices: 24, e_smms: 7, employees: 11, inventory_levels: 5, item_categories: 8,
  payments: 6, products: 25, purchase_bill_details: 14, purchase_bills: 36, salaries: 12,
  sales_invoice_details: 16, sales_invoices: 53, sales_offers: 39, sales_offers_details: 23,
  shipment_documents: 15, stock_movements: 7, stock_update_details: 4, stock_updates: 1,
  tags: 1, taxes: 9, trackable_jobs: 2, transactions: 11, warehouses: 6,
};

describe("field-mapping registry — mechanical proofs (Phase 2A, offline only)", () => {
  it("contains exactly 401 fields, matching the Phase 1 audit matrix total", () => {
    expect(FIELD_MAPPING_REGISTRY.length).toBe(401);
  });

  it("covers exactly 28 resources", () => {
    expect(REGISTRY_RESOURCES.length).toBe(28);
    expect(new Set(FIELD_MAPPING_REGISTRY.map((f) => f.resource)).size).toBe(28);
  });

  it("has no resource with zero mapped fields", () => {
    for (const resource of REGISTRY_RESOURCES) {
      const count = FIELD_MAPPING_REGISTRY.filter((f) => f.resource === resource).length;
      expect(count, `${resource} should have at least one field`).toBeGreaterThan(0);
    }
  });

  it("matches the exact per-resource totals from the Phase 1 matrix", () => {
    for (const [resource, expected] of Object.entries(EXPECTED_RESOURCE_TOTALS)) {
      const actual = FIELD_MAPPING_REGISTRY.filter((f) => f.resource === resource).length;
      expect(actual, `${resource} count`).toBe(expected);
    }
    const sum = Object.values(EXPECTED_RESOURCE_TOTALS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(401);
  });

  it("has no duplicate (resource, attribute) entries", () => {
    const seen = new Set<string>();
    for (const field of FIELD_MAPPING_REGISTRY) {
      const key = `${field.resource}.${field.attribute}`;
      expect(seen.has(key), `duplicate ${key}`).toBe(false);
      seen.add(key);
    }
  });

  it("marks exactly 5 fields currentlyMappedByProduction (the live-mapped contacts balances + sales_invoices.gross_total)", () => {
    const mapped = FIELD_MAPPING_REGISTRY.filter((f) => f.currentlyMappedByProduction);
    expect(mapped.map((f) => `${f.resource}.${f.attribute}`).sort()).toEqual(
      [
        "contacts.eur_balance",
        "contacts.gbp_balance",
        "contacts.trl_balance",
        "contacts.usd_balance",
        "sales_invoices.gross_total",
      ].sort(),
    );
  });

  it("every field has a valid sourceLocation and expectedPgType", () => {
    const validLocations = new Set(["attributes", "relationships"]);
    const validKinds = new Set(["text", "boolean", "numeric", "timestamptz", "date", "jsonb"]);
    for (const field of FIELD_MAPPING_REGISTRY) {
      expect(validLocations.has(field.sourceLocation), `${field.resource}.${field.attribute} sourceLocation`).toBe(true);
      expect(validKinds.has(field.expectedPgType), `${field.resource}.${field.attribute} expectedPgType`).toBe(true);
    }
  });
});
