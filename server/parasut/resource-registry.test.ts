import { describe, expect, it } from "vitest";
import {
  PARASUT_RESOURCE_REGISTRY,
  buildDirectListEndpoint,
  directListResources,
  getResourceConfig,
} from "./resource-registry.ts";

describe("Paraşüt resource registry", () => {
  it("has no duplicate resourceType entries", () => {
    const seen = new Set<string>();
    for (const entry of PARASUT_RESOURCE_REGISTRY) {
      expect(seen.has(entry.resourceType)).toBe(false);
      seen.add(entry.resourceType);
    }
  });

  it("gives every direct-list entry a non-empty endpoint and every other entry none", () => {
    for (const entry of PARASUT_RESOURCE_REGISTRY) {
      if (entry.support === "direct-list") {
        expect(entry.endpoint).toBeTruthy();
      } else {
        expect(entry.endpoint).toBeUndefined();
      }
    }
  });

  it("requires a non-empty explanatory note on every entry", () => {
    for (const entry of PARASUT_RESOURCE_REGISTRY) {
      expect(entry.notes.length).toBeGreaterThan(20);
    }
  });

  it("classifies the five endpoints that returned HTTP 404 live as unsupported, not direct-list", () => {
    for (const resourceType of ["bank_fees", "e_archives", "e_smms", "stock_updates", "transactions"]) {
      expect(getResourceConfig(resourceType)?.support).toBe("unsupported");
    }
  });

  it("classifies the endpoint that returned HTTP 500 live as unsupported, not direct-list", () => {
    expect(getResourceConfig("stock_movements")?.support).toBe("unsupported");
  });

  it("keeps sub-resources (payments, *_details) as nested rather than direct-list", () => {
    for (const resourceType of [
      "payments",
      "sales_invoice_details",
      "purchase_bill_details",
      "sales_offers_details",
      "stock_update_details",
      "inventory_levels",
      "trackable_jobs",
    ]) {
      expect(getResourceConfig(resourceType)?.support).toBe("nested");
    }
  });

  it("directListResources() returns only entries with support === direct-list", () => {
    const list = directListResources();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((entry) => entry.support === "direct-list")).toBe(true);
  });

  it("buildDirectListEndpoint builds the exact verified path for a known resource", () => {
    const config = getResourceConfig("warehouses")!;
    expect(buildDirectListEndpoint("666034", config)).toBe("/v4/666034/warehouses");
  });

  it("buildDirectListEndpoint percent-encodes the company id", () => {
    const config = getResourceConfig("warehouses")!;
    expect(buildDirectListEndpoint("abc def", config)).toBe("/v4/abc%20def/warehouses");
  });

  it("buildDirectListEndpoint throws for a nested resource instead of guessing a path", () => {
    const config = getResourceConfig("payments")!;
    expect(() => buildDirectListEndpoint("666034", config)).toThrow(/not a direct-list resource/);
  });

  it("buildDirectListEndpoint throws for an unsupported resource instead of guessing a path", () => {
    const config = getResourceConfig("bank_fees")!;
    expect(() => buildDirectListEndpoint("666034", config)).toThrow(/not a direct-list resource/);
  });
});
