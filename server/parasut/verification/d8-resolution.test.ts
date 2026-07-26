import { describe, expect, it } from "vitest";
import { D8_FIELD_KEYS, classifyD8Field, resolveAllD8Fields, summarizeD8Resolution } from "./d8-resolution.ts";
import { FIELD_MAPPING_REGISTRY } from "../field-mapping-registry.ts";

describe("D8 resolution — 151-field classification against accepted evidence", () => {
  it("carries forward exactly 151 field keys from the accepted Phase 1 audit", () => {
    expect(D8_FIELD_KEYS.length).toBe(151);
    expect(new Set(D8_FIELD_KEYS).size).toBe(151); // no duplicates
  });

  it("every D8 field key exists in the accepted field-mapping registry", () => {
    const missing = D8_FIELD_KEYS.filter((key) => {
      const [resource, attribute] = key.split(".");
      return !FIELD_MAPPING_REGISTRY.some((f) => f.resource === resource && f.attribute === attribute);
    });
    expect(missing).toEqual([]);
  });

  it("classifies a field with a sync wrapper as REQUIRES_TYPED_COLUMN_MAPPING with wrapper-aware reasoning", () => {
    const result = classifyD8Field("accounts.balance");
    expect(result.category).toBe("REQUIRES_TYPED_COLUMN_MAPPING");
    expect(result.reasoning).toContain("sync wrapper exists for 'accounts'");
  });

  it("classifies a field with no sync wrapper at all with different, accurate reasoning", () => {
    const result = classifyD8Field("e_invoices.external_id");
    expect(result.category).toBe("REQUIRES_TYPED_COLUMN_MAPPING");
    expect(result.reasoning).toContain("No sync wrapper currently exists for resource 'e_invoices'");
  });

  it("resolves all 151 fields without throwing and without any GENUINELY_UNRESOLVED_MISSING_DOCS result (registry coverage is complete)", () => {
    const resolutions = resolveAllD8Fields();
    expect(resolutions.length).toBe(151);
    const summary = summarizeD8Resolution(resolutions);
    expect(summary.GENUINELY_UNRESOLVED_MISSING_DOCS).toBe(0);
    expect(summary.REQUIRES_TYPED_COLUMN_MAPPING).toBe(151);
  });

  it("does not classify any D8 field as ALREADY_IMPLEMENTED_CORRECTLY_MAPPED (by construction, since these are exactly the unmapped fields)", () => {
    const resolutions = resolveAllD8Fields();
    expect(resolutions.every((r) => r.category !== "ALREADY_IMPLEMENTED_CORRECTLY_MAPPED")).toBe(true);
  });

  it("summary counts sum to 151", () => {
    const summary = summarizeD8Resolution(resolveAllD8Fields());
    const total = Object.values(summary).reduce((a, b) => a + b, 0);
    expect(total).toBe(151);
  });
});
