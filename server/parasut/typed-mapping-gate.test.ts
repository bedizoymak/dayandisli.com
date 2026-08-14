import { describe, expect, it } from "vitest";
import {
  isResourceInTypedMappingScope,
  isTypedMappingEnabled,
  isTypedMappingEnabledForResource,
  shouldUseTypedMapping,
  TYPED_MAPPING_SCOPED_RESOURCES,
} from "./typed-mapping-gate.ts";

describe("typed-mapping-gate — default-disabled safety invariant", () => {
  it("is disabled when the env var is entirely absent", () => {
    expect(isTypedMappingEnabled({})).toBe(false);
  });

  it("is disabled when the env var is an empty string", () => {
    expect(isTypedMappingEnabled({ PARASUT_TYPED_MAPPING_ENABLED: "" })).toBe(false);
  });

  it("is disabled for any value other than the exact literal \"1\"", () => {
    expect(isTypedMappingEnabled({ PARASUT_TYPED_MAPPING_ENABLED: "true" })).toBe(false);
    expect(isTypedMappingEnabled({ PARASUT_TYPED_MAPPING_ENABLED: "yes" })).toBe(false);
    expect(isTypedMappingEnabled({ PARASUT_TYPED_MAPPING_ENABLED: "0" })).toBe(false);
    expect(isTypedMappingEnabled({ PARASUT_TYPED_MAPPING_ENABLED: "01" })).toBe(false);
  });

  it("is enabled only for the exact literal \"1\"", () => {
    expect(isTypedMappingEnabled({ PARASUT_TYPED_MAPPING_ENABLED: "1" })).toBe(true);
  });
});

describe("typed-mapping-gate — scope confinement", () => {
  it("scopes exactly the 10 resources with an existing production sync wrapper", () => {
    expect([...TYPED_MAPPING_SCOPED_RESOURCES].sort()).toEqual(
      [
        "accounts",
        "contacts",
        "products",
        "purchase_bills",
        "sales_invoices",
        "e_invoices",
        "employees",
        "sales_offers",
        "shipment_documents",
        "warehouses",
      ].sort(),
    );
  });

  it("excludes every resource without an existing sync wrapper", () => {
    for (const outOfScope of ["bank_fees", "tags", "salaries", "risky_customers"]) {
      expect(isResourceInTypedMappingScope(outOfScope), outOfScope).toBe(false);
    }
  });

  it("shouldUseTypedMapping requires BOTH enabled AND in-scope — neither alone is sufficient", () => {
    expect(shouldUseTypedMapping("contacts", { PARASUT_TYPED_MAPPING_ENABLED: "0" })).toBe(false); // in scope, disabled
    expect(shouldUseTypedMapping("bank_fees", { PARASUT_TYPED_MAPPING_ENABLED: "1" })).toBe(false); // enabled, out of scope
    expect(shouldUseTypedMapping("contacts", { PARASUT_TYPED_MAPPING_ENABLED: "1" })).toBe(true); // both
  });

  it("fails closed for an unregistered/unknown resource name even when enabled", () => {
    expect(shouldUseTypedMapping("totally_made_up_resource", { PARASUT_TYPED_MAPPING_ENABLED: "1" })).toBe(false);
  });
});

describe("typed-mapping-gate — resource-scoped opt-in (PARASUT_TYPED_MAPPING_ENABLED_RESOURCES)", () => {
  it("is disabled for every scoped resource when the resource-scoped var is absent", () => {
    for (const resource of TYPED_MAPPING_SCOPED_RESOURCES) {
      expect(isTypedMappingEnabledForResource(resource, {}), resource).toBe(false);
      expect(shouldUseTypedMapping(resource, {}), resource).toBe(false);
    }
  });

  it("is disabled when the resource-scoped var is an empty string", () => {
    expect(isTypedMappingEnabledForResource("e_invoices", { PARASUT_TYPED_MAPPING_ENABLED_RESOURCES: "" })).toBe(false);
  });

  it("does not alter the existing global PARASUT_TYPED_MAPPING_ENABLED behaviour", () => {
    expect(isTypedMappingEnabled({})).toBe(false);
    expect(isTypedMappingEnabled({ PARASUT_TYPED_MAPPING_ENABLED: "1" })).toBe(true);
    expect(isTypedMappingEnabled({ PARASUT_TYPED_MAPPING_ENABLED: "true" })).toBe(false);
    // Global flag still activates every in-scope resource exactly as before,
    // regardless of whether the new resource-scoped var is set or not.
    expect(shouldUseTypedMapping("contacts", { PARASUT_TYPED_MAPPING_ENABLED: "1" })).toBe(true);
    expect(shouldUseTypedMapping("purchase_bills", { PARASUT_TYPED_MAPPING_ENABLED: "1", PARASUT_TYPED_MAPPING_ENABLED_RESOURCES: "e_invoices" })).toBe(true);
  });

  it("enables e_invoices independently of the global flag when listed in the resource-scoped var", () => {
    const env = { PARASUT_TYPED_MAPPING_ENABLED_RESOURCES: "e_invoices" };
    expect(isTypedMappingEnabled(env)).toBe(false); // global flag itself is untouched/absent
    expect(shouldUseTypedMapping("e_invoices", env)).toBe(true);
  });

  it("enabling e_invoices does NOT enable sales_invoices, purchase_bills, contacts, products, or any other scoped resource", () => {
    const env = { PARASUT_TYPED_MAPPING_ENABLED_RESOURCES: "e_invoices" };
    for (const resource of TYPED_MAPPING_SCOPED_RESOURCES) {
      if (resource === "e_invoices") continue;
      expect(shouldUseTypedMapping(resource, env), resource).toBe(false);
    }
  });

  it("supports multiple comma-separated resources, matched by exact name only (no substring/prefix match)", () => {
    const env = { PARASUT_TYPED_MAPPING_ENABLED_RESOURCES: "e_invoices, contacts" };
    expect(shouldUseTypedMapping("e_invoices", env)).toBe(true);
    expect(shouldUseTypedMapping("contacts", env)).toBe(true);
    expect(shouldUseTypedMapping("products", env)).toBe(false);
    // "e_invoice" (singular, a plausible typo) must not fuzzy-match "e_invoices".
    expect(isTypedMappingEnabledForResource("e_invoice", { PARASUT_TYPED_MAPPING_ENABLED_RESOURCES: "e_invoice" })).toBe(true);
    expect(shouldUseTypedMapping("e_invoices", { PARASUT_TYPED_MAPPING_ENABLED_RESOURCES: "e_invoice" })).toBe(false);
  });

  it("fails closed for an out-of-scope resource even when explicitly listed in the resource-scoped var", () => {
    const env = { PARASUT_TYPED_MAPPING_ENABLED_RESOURCES: "bank_fees" };
    expect(shouldUseTypedMapping("bank_fees", env)).toBe(false);
  });
});
