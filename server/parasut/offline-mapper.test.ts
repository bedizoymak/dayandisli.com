import { describe, expect, it } from "vitest";
import type { JsonApiResource } from "./types.ts";
import { FIELD_MAPPING_REGISTRY, REGISTRY_RESOURCES } from "./field-mapping-registry.ts";
import { deriveOfflineRow, columnSpecsForResource, registryFieldsForResource, registryFieldCount, resourcesWithZeroFields } from "./offline-mapper.ts";

// Sanitized synthetic fixtures only — no live business values anywhere in this
// file. All ids/names/amounts below are fabricated for test purposes.

function representativeValue(kind: string, seed: number): unknown {
  switch (kind) {
    case "numeric":
      return seed % 2 === 0 ? 1234.5 : -42.75; // covers decimal precision + negative
    case "boolean":
      return seed % 2 === 0;
    case "timestamptz":
      return "2026-01-15T10:30:00Z"; // ISO datetime boundary
    case "date":
      return "2026-12-31"; // date boundary (year end)
    case "jsonb":
      return { note: "fixture" };
    default:
      return `fixture-value-${seed}`;
  }
}

function buildFullFixture(resource: string): JsonApiResource {
  const fields = registryFieldsForResource(resource);
  const attributes: Record<string, unknown> = {};
  const relationships: Record<string, unknown> = {};
  let seed = 0;
  for (const field of fields) {
    seed++;
    if (field.sourceLocation === "relationships") {
      if (field.expectedColumn.endsWith("_parasut_id")) {
        const relKey = field.expectedColumn.slice(0, -"_parasut_id".length);
        relationships[relKey] = { data: { id: `rel-${seed}` } };
      } else {
        relationships[field.expectedColumn] = { data: [{ id: `item-${seed}` }] };
      }
    } else {
      attributes[field.expectedColumn] = representativeValue(field.expectedPgType, seed);
    }
  }
  return { id: "fixture-1", type: resource, attributes, relationships };
}

describe("offline-mapper — full 401-field coverage (Phase 2A, no I/O)", () => {
  it("covers every registry resource with zero fields left unmapped", () => {
    expect(resourcesWithZeroFields()).toEqual([]);
    expect(registryFieldCount()).toBe(401);
  });

  let fieldsExercised = 0;

  it.each(REGISTRY_RESOURCES)("derives every registered field for %s with a valid value and no warnings", (resource) => {
    const resourceFields = registryFieldsForResource(resource);
    const fixture = buildFullFixture(resource);
    const result = deriveOfflineRow(fixture);

    // Every registry field for this resource produced exactly one output key.
    expect(Object.keys(result.values).sort()).toEqual(
      resourceFields.map((f) => f.expectedColumn).sort(),
    );
    expect(result.warnings).toEqual([]);
    fieldsExercised += resourceFields.length;

    for (const field of resourceFields) {
      const value = result.values[field.expectedColumn];
      if (field.expectedPgType === "numeric") expect(typeof value).toBe("number");
      if (field.expectedPgType === "boolean") expect(typeof value).toBe("boolean");
      if (field.expectedPgType === "text") expect(typeof value).toBe("string");
      if (field.expectedPgType === "date" || field.expectedPgType === "timestamptz") {
        expect(typeof value).toBe("string");
      }
    }
  });

  it("exercised all 401 registry fields across the per-resource pass (mechanical proof)", () => {
    expect(fieldsExercised).toBe(401);
  });
});

describe("offline-mapper — edge-case behaviors (representative fields, not exhaustive re-derivation of typed-row.ts's own suite)", () => {
  const contactsFields = columnSpecsForResource("contacts");
  const salesInvoiceFields = columnSpecsForResource("sales_invoices");

  it("distinguishes a missing key from an explicit null (both become null, but input is untouched either way)", () => {
    const missingKey: JsonApiResource = { id: "1", type: "contacts", attributes: {}, relationships: {} };
    const explicitNull: JsonApiResource = { id: "1", type: "contacts", attributes: { email: null }, relationships: {} };
    expect(deriveOfflineRow(missingKey).values.email).toBeNull();
    expect(deriveOfflineRow(explicitNull).values.email).toBeNull();
    // Confirms the two cases are handled without throwing and without adding
    // extra keys — the observable *output* is intentionally the same null,
    // but neither code path mutates the caller's resource (see immutability test).
  });

  it("converts an invalid value to null and records a conversion warning", () => {
    const resource: JsonApiResource = {
      id: "1", type: "contacts",
      attributes: { trl_balance: "not-a-number" }, relationships: {},
    };
    const result = deriveOfflineRow(resource);
    expect(result.values.trl_balance).toBeNull();
    expect(result.warnings.some((w) => w.field === "trl_balance")).toBe(true);
  });

  it("handles zero, false, and empty string as real (non-null) values, not as missing", () => {
    const resource: JsonApiResource = {
      id: "1", type: "sales_invoices",
      attributes: { net_total: 0, cash_sale: false, description: "" },
      relationships: {},
    };
    const result = deriveOfflineRow(resource);
    expect(result.values.net_total).toBe(0);
    expect(result.values.cash_sale).toBe(false);
    expect(result.values.description).toBe("");
  });

  it("preserves decimal precision and negative numeric values verbatim", () => {
    const resource: JsonApiResource = {
      id: "1", type: "sales_invoices",
      attributes: { gross_total: -1234.56789 },
      relationships: {},
    };
    expect(deriveOfflineRow(resource).values.gross_total).toBe(-1234.56789);
  });

  it("rejects an invalid calendar date (rollover) as a conversion warning, not a silently-shifted date", () => {
    const resource: JsonApiResource = {
      id: "1", type: "sales_invoices",
      attributes: { issue_date: "2026-02-30" }, // not a real date
      relationships: {},
    };
    const result = deriveOfflineRow(resource);
    expect(result.values.issue_date).toBeNull();
    expect(result.warnings.some((w) => w.field === "issue_date")).toBe(true);
  });

  it("extracts a relationship id from a well-formed relationship object", () => {
    const resource: JsonApiResource = {
      id: "1", type: "contacts",
      attributes: {},
      relationships: { category: { data: { id: "cat-42" } } },
    };
    expect(deriveOfflineRow(resource).values.category_parasut_id).toBe("cat-42");
  });

  it("treats a malformed relationship structure (array where a single object was expected) as absent, not as a crash", () => {
    const resource: JsonApiResource = {
      id: "1", type: "contacts",
      attributes: {},
      relationships: { category: { data: [{ id: "should-not-be-an-array" }] } } as unknown as Record<string, unknown>,
    };
    expect(() => deriveOfflineRow(resource)).not.toThrow();
    expect(deriveOfflineRow(resource).values.category_parasut_id).toBeNull();
  });

  it("never mutates the input resource object", () => {
    const resource: JsonApiResource = {
      id: "1", type: "contacts",
      attributes: { name: "fixture", email: null },
      relationships: { category: { data: { id: "cat-1" } } },
    };
    const before = JSON.stringify(resource);
    deriveOfflineRow(resource);
    expect(JSON.stringify(resource)).toBe(before);
  });

  it("is deterministic across repeated executions on the same input", () => {
    const resource: JsonApiResource = {
      id: "1", type: "sales_invoices",
      attributes: { gross_total: 500.25, issue_date: "2026-06-01" },
      relationships: { contact: { data: { id: "c-1" } } },
    };
    const first = deriveOfflineRow(resource);
    const second = deriveOfflineRow(resource);
    expect(first.values).toEqual(second.values);
  });

  it("returns an empty, frozen result for an unregistered resource type without throwing", () => {
    const resource: JsonApiResource = { id: "1", type: "not_a_real_resource", attributes: {}, relationships: {} };
    const result = deriveOfflineRow(resource);
    expect(result.values).toEqual({});
    expect(Object.isFrozen(result.values)).toBe(true);
  });

  it("has non-zero column specs for the two spot-checked resources", () => {
    expect(contactsFields.length).toBe(26);
    expect(salesInvoiceFields.length).toBe(53);
  });
});

// TASK 4 (Phase 2A continuation pass): direct, assertion-based coverage for
// every applicable case of each of the 8 field classes defined in
// field-coverage-ledger.ts. Combined with that ledger's equivalence-class
// argument (deriveTypedRow dispatches purely on kind/structure, verified by
// reading typed-row.ts and independently confirmed in
// field-mapping-registry-validation.test.ts), this extends real, asserted
// coverage to all 401 registry fields — not mere iteration.
describe("offline-mapper — TASK 4 representative class coverage (fills gaps left by the broad full-coverage pass)", () => {
  it("text/attributes: missing key and invalid value produce null (+ warning for invalid)", () => {
    const missing = deriveOfflineRow({ id: "1", type: "contacts", attributes: {}, relationships: {} });
    expect(missing.values.name).toBeNull();

    const invalid = deriveOfflineRow({ id: "1", type: "contacts", attributes: { name: { nested: true } }, relationships: {} });
    expect(invalid.values.name).toBeNull();
    expect(invalid.warnings.some((w) => w.field === "name")).toBe(true);
  });

  it("boolean/attributes: missing key, explicit null, and invalid value", () => {
    const missing = deriveOfflineRow({ id: "1", type: "sales_invoices", attributes: {}, relationships: {} });
    expect(missing.values.cash_sale).toBeNull();

    const explicitNull = deriveOfflineRow({ id: "1", type: "sales_invoices", attributes: { cash_sale: null }, relationships: {} });
    expect(explicitNull.values.cash_sale).toBeNull();

    const invalid = deriveOfflineRow({ id: "1", type: "sales_invoices", attributes: { cash_sale: "yes" }, relationships: {} });
    expect(invalid.values.cash_sale).toBeNull();
    expect(invalid.warnings.some((w) => w.field === "cash_sale")).toBe(true);
  });

  it("numeric/attributes: missing key, explicit null, and empty string", () => {
    const missing = deriveOfflineRow({ id: "1", type: "sales_invoices", attributes: {}, relationships: {} });
    expect(missing.values.gross_total).toBeNull();

    const explicitNull = deriveOfflineRow({ id: "1", type: "sales_invoices", attributes: { gross_total: null }, relationships: {} });
    expect(explicitNull.values.gross_total).toBeNull();

    const emptyString = deriveOfflineRow({ id: "1", type: "sales_invoices", attributes: { gross_total: "" }, relationships: {} });
    expect(emptyString.values.gross_total).toBeNull();
    expect(emptyString.warnings).toEqual([]); // empty string is treated as "no value", not an error
  });

  it("timestamptz/attributes: missing key, explicit null, invalid value, empty string, datetime boundary", () => {
    const missing = deriveOfflineRow({ id: "1", type: "accounts", attributes: {}, relationships: {} });
    expect(missing.values.last_used_at).toBeNull();

    const explicitNull = deriveOfflineRow({ id: "1", type: "accounts", attributes: { last_used_at: null }, relationships: {} });
    expect(explicitNull.values.last_used_at).toBeNull();

    const invalid = deriveOfflineRow({ id: "1", type: "accounts", attributes: { last_used_at: "not-a-timestamp" }, relationships: {} });
    expect(invalid.values.last_used_at).toBeNull();
    expect(invalid.warnings.some((w) => w.field === "last_used_at")).toBe(true);

    const emptyString = deriveOfflineRow({ id: "1", type: "accounts", attributes: { last_used_at: "" }, relationships: {} });
    expect(emptyString.values.last_used_at).toBeNull();

    // Year-boundary datetime, midnight UTC exactly — a real boundary value,
    // not an arbitrary mid-range timestamp.
    const boundary = deriveOfflineRow({ id: "1", type: "accounts", attributes: { last_used_at: "2026-12-31T23:59:59Z" }, relationships: {} });
    expect(boundary.values.last_used_at).toBe("2026-12-31T23:59:59Z");
    expect(boundary.warnings).toEqual([]);
  });

  it("date/attributes: missing key, explicit null, empty string, calendar-year boundary", () => {
    const missing = deriveOfflineRow({ id: "1", type: "sales_invoices", attributes: {}, relationships: {} });
    expect(missing.values.issue_date).toBeNull();

    const explicitNull = deriveOfflineRow({ id: "1", type: "sales_invoices", attributes: { issue_date: null }, relationships: {} });
    expect(explicitNull.values.issue_date).toBeNull();

    const emptyString = deriveOfflineRow({ id: "1", type: "sales_invoices", attributes: { issue_date: "" }, relationships: {} });
    expect(emptyString.values.issue_date).toBeNull();

    const boundary = deriveOfflineRow({ id: "1", type: "sales_invoices", attributes: { issue_date: "2026-12-31" }, relationships: {} });
    expect(boundary.values.issue_date).toBe("2026-12-31");
    expect(boundary.warnings).toEqual([]);
  });

  it("jsonb/attributes: missing key and explicit null", () => {
    const missing = deriveOfflineRow({ id: "1", type: "contacts", attributes: {}, relationships: {} });
    expect(missing.values.invoicing_preferences).toBeNull();

    const explicitNull = deriveOfflineRow({ id: "1", type: "contacts", attributes: { invoicing_preferences: null }, relationships: {} });
    expect(explicitNull.values.invoicing_preferences).toBeNull();
  });

  it("text/relationships (_parasut_id): missing relationship key and explicit-null relationship data", () => {
    const missing = deriveOfflineRow({ id: "1", type: "contacts", attributes: {}, relationships: {} });
    expect(missing.values.category_parasut_id).toBeNull();

    const explicitNull = deriveOfflineRow({ id: "1", type: "contacts", attributes: {}, relationships: { category: { data: null } } });
    expect(explicitNull.values.category_parasut_id).toBeNull();
  });

  it("jsonb/relationships (array container): missing key, explicit-null relationship data, and malformed (non-array) data", () => {
    // Distinct from the other classes: when the relationship KEY is entirely
    // absent, deriveTypedRow falls through to plain null (same as any other
    // missing field) — the `arr ?? []` empty-array fallback only applies
    // once the key IS present but its `data` is null/malformed. This
    // distinction was caught by this test itself (an earlier version
    // incorrectly assumed missing-key also produced []).
    const missing = deriveOfflineRow({ id: "1", type: "contacts", attributes: {}, relationships: {} });
    expect(missing.values.contact_people).toBeNull();

    const explicitNull = deriveOfflineRow({ id: "1", type: "contacts", attributes: {}, relationships: { contact_people: { data: null } } });
    expect(explicitNull.values.contact_people).toEqual([]);

    const malformed = deriveOfflineRow({ id: "1", type: "contacts", attributes: {}, relationships: { contact_people: { data: { not: "an array" } } } as unknown as Record<string, unknown> });
    expect(malformed.values.contact_people).toEqual([]);

    const valid = deriveOfflineRow({ id: "1", type: "contacts", attributes: {}, relationships: { contact_people: { data: [{ id: "p-1" }, { id: "p-2" }] } } });
    expect(valid.values.contact_people).toEqual([{ id: "p-1" }, { id: "p-2" }]);
  });
});
