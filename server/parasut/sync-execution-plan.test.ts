import { readFileSync } from "node:fs";
import { join } from "node:path";
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
      count: 6,
      resources: [
        "accounts",
        "contacts",
        "products",
        "sales_invoices",
        "purchase_bills",
        "checks",
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

describe("PHASE 10 divergence guard: one canonical resource order everywhere", () => {
  it("the production cron loop's RESOURCE_ORDER equals DEFAULT_RESOURCE_ORDER", () => {
    const fnSource = readFileSync(
      join(__dirname, "..", "..", "supabase", "functions", "parasut-sync-run", "index.ts"),
      "utf-8",
    );
    const match = fnSource.match(/const RESOURCE_ORDER[^=]*= \[([\s\S]*?)\];/);
    expect(match, "RESOURCE_ORDER block not found in parasut-sync-run/index.ts").toBeTruthy();
    const cronOrder = (match![1].match(/name: "(\w+)"/g) ?? []).map((entry) =>
      entry.replace(/name: "|"/g, ""),
    );
    expect(cronOrder).toEqual([...DEFAULT_RESOURCE_ORDER]);
  });
});

