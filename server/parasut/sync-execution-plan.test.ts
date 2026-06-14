import { describe, expect, it } from "vitest";
import {
  DEFAULT_RESOURCE_ORDER,
  createExecutionPlan,
  isSupportedResource,
  validateResourceSelection,
} from "./sync-execution-plan.ts";

describe("isSupportedResource", () => {
  it.each(DEFAULT_RESOURCE_ORDER)("accepts %s", (resource) => {
    expect(isSupportedResource(resource)).toBe(true);
  });

  it("rejects unknown names", () => {
    expect(isSupportedResource("payments")).toBe(false);
  });
});

describe("validateResourceSelection", () => {
  it("preserves requested order", () => {
    expect(
      validateResourceSelection(["accounts", "contacts", "products"]),
    ).toEqual(["accounts", "contacts", "products"]);
  });

  it("rejects duplicates deterministically", () => {
    expect(() =>
      validateResourceSelection(["contacts", "contacts"]),
    ).toThrow("Duplicate sync resource: contacts");
  });

  it("rejects unknown resources deterministically", () => {
    expect(() => validateResourceSelection(["contacts", "payments"])).toThrow(
      "Unsupported sync resource: payments",
    );
  });

  it("does not mutate immutable input", () => {
    const requested = Object.freeze(["products", "contacts"] as const);

    expect(validateResourceSelection(requested)).toEqual([
      "products",
      "contacts",
    ]);
    expect(requested).toEqual(["products", "contacts"]);
  });
});

describe("createExecutionPlan", () => {
  it("creates the explicit default plan for empty arguments", () => {
    expect(createExecutionPlan([])).toEqual({
      mode: "default",
      count: 5,
      resources: [
        "contacts",
        "products",
        "sales_invoices",
        "purchase_bills",
        "accounts",
      ],
    });
  });

  it("creates a custom subset preserving requested order", () => {
    expect(createExecutionPlan(["accounts", "sales_invoices"])).toEqual({
      mode: "custom",
      count: 2,
      resources: ["accounts", "sales_invoices"],
    });
  });

  it("returns a detached resources array", () => {
    const requested = ["products", "accounts"];
    const plan = createExecutionPlan(requested);

    requested.reverse();

    expect(plan.resources).toEqual(["products", "accounts"]);
  });

  it("contains only allowlisted fields and no credentials or payloads", () => {
    const plan = createExecutionPlan(["contacts"]);

    expect(Object.keys(plan)).toEqual(["mode", "count", "resources"]);
    expect(JSON.stringify(plan)).not.toMatch(
      /token|secret|password|credential|payload|request_metadata|raw_payload/i,
    );
  });
});
