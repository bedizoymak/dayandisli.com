import { describe, expect, it } from "vitest";
import { isResourceInTypedMappingScope, isTypedMappingEnabled, shouldUseTypedMapping, TYPED_MAPPING_SCOPED_RESOURCES } from "./typed-mapping-gate.ts";

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
  it("scopes exactly the 5 resources with an existing production sync wrapper", () => {
    expect([...TYPED_MAPPING_SCOPED_RESOURCES].sort()).toEqual(
      ["accounts", "contacts", "products", "purchase_bills", "sales_invoices"].sort(),
    );
  });

  it("excludes every resource without an existing sync wrapper, including all D8 resources that lack one", () => {
    for (const outOfScope of ["e_invoices", "employees", "sales_offers", "shipment_documents", "warehouses", "bank_fees", "tags"]) {
      expect(isResourceInTypedMappingScope(outOfScope), outOfScope).toBe(false);
    }
  });

  it("shouldUseTypedMapping requires BOTH enabled AND in-scope — neither alone is sufficient", () => {
    expect(shouldUseTypedMapping("contacts", { PARASUT_TYPED_MAPPING_ENABLED: "0" })).toBe(false); // in scope, disabled
    expect(shouldUseTypedMapping("e_invoices", { PARASUT_TYPED_MAPPING_ENABLED: "1" })).toBe(false); // enabled, out of scope
    expect(shouldUseTypedMapping("contacts", { PARASUT_TYPED_MAPPING_ENABLED: "1" })).toBe(true); // both
  });

  it("fails closed for an unregistered/unknown resource name even when enabled", () => {
    expect(shouldUseTypedMapping("totally_made_up_resource", { PARASUT_TYPED_MAPPING_ENABLED: "1" })).toBe(false);
  });
});
