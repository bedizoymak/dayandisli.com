import { describe, expect, it, vi } from "vitest";
import { composeExecutionResults } from "./execution-result-composition.ts";
import { createExecutionPlan } from "./sync-execution-plan.ts";

describe("composeExecutionResults", () => {
  it("composes a completed default execution", async () => {
    const plan = createExecutionPlan();
    const result = await composeExecutionResults(plan, async (resource) => ({
      resource,
    }));

    expect(result.outcome).toBe("completed");
    expect(result.envelope).toEqual({
      status: "completed",
      mode: "default",
      planned_count: 5,
      completed_count: 5,
      completed_resources: [
        "contacts",
        "products",
        "sales_invoices",
        "purchase_bills",
        "accounts",
      ],
    });
    expect(result.reports.map((report) => report.resource)).toEqual(
      plan.resources,
    );
  });

  it("composes a completed custom execution in plan order", async () => {
    const result = await composeExecutionResults(
      createExecutionPlan(["accounts", "contacts"]),
      async (resource) => ({ resource }),
    );

    expect(result.reports).toEqual([
      { resource: "accounts" },
      { resource: "contacts" },
    ]);
    expect(result.envelope.completed_resources).toEqual([
      "accounts",
      "contacts",
    ]);
  });

  it("composes a first-resource failure", async () => {
    const error = new Error("contacts failed");
    const result = await composeExecutionResults(
      createExecutionPlan(["contacts", "products"]),
      async () => {
        throw error;
      },
    );

    expect(result).toMatchObject({
      outcome: "failed",
      reports: [],
      envelope: {
        status: "failed",
        completed_resources: [],
        failed_resource: "contacts",
        remaining_resources: ["products"],
      },
    });
  });

  it("preserves completed reports after a middle-resource failure", async () => {
    const result = await composeExecutionResults(
      createExecutionPlan(["contacts", "products", "accounts"]),
      async (resource) => {
        if (resource === "products") {
          throw new Error("products failed");
        }
        return { resource, marker: "unchanged-report" };
      },
    );

    expect(result.outcome).toBe("failed");
    expect(result.reports).toEqual([
      { resource: "contacts", marker: "unchanged-report" },
    ]);
    expect(result.envelope.completed_resources).toEqual(["contacts"]);
  });

  it("retains original error identity outside the serializable envelope", async () => {
    const error = new Error("products failed");
    const result = await composeExecutionResults(
      createExecutionPlan(["contacts", "products"]),
      async (resource) => {
        if (resource === "products") {
          throw error;
        }
        return { resource };
      },
    );

    expect(result.outcome).toBe("failed");
    if (result.outcome !== "failed") {
      throw new Error("Expected a failed result");
    }
    expect(result.originalError).toBe(error);
    expect(JSON.stringify(result.envelope)).not.toContain("originalError");
  });

  it("stops execution after the first failure", async () => {
    const execute = vi.fn(async (resource: string) => {
      if (resource === "products") {
        throw new Error("products failed");
      }
      return { resource };
    });

    await composeExecutionResults(
      createExecutionPlan(["contacts", "products", "accounts"]),
      execute,
    );

    expect(execute.mock.calls.map(([resource]) => resource)).toEqual([
      "contacts",
      "products",
    ]);
  });

  it("returns detached report and envelope arrays", async () => {
    const plan = createExecutionPlan(["contacts", "products"]);
    const result = await composeExecutionResults(plan, async (resource) => ({
      resource,
    }));
    const reports = result.reports;

    plan.resources.reverse();
    reports.reverse();

    expect(result.envelope.completed_resources).toEqual([
      "contacts",
      "products",
    ]);
  });

  it("does not leak setup, context, metadata, credentials, or payloads", async () => {
    const result = await composeExecutionResults(
      createExecutionPlan(["contacts"]),
      async () => {
        throw {
          code: "access_token=secret",
          message:
            "request_metadata=private raw_payload=hidden password=hunter2",
          setup: { service_role_key: "private-key" },
          context: { api_key: "secret-key" },
        };
      },
    );
    const serializedEnvelope = JSON.stringify(result.envelope);

    expect(serializedEnvelope).not.toMatch(
      /secret|private|hidden|hunter2|request_metadata|raw_payload|setup|context|service_role_key|api_key/i,
    );
  });

  it("does not write to stdout or stderr", async () => {
    const stdout = vi.spyOn(process.stdout, "write");
    const stderr = vi.spyOn(process.stderr, "write");

    await composeExecutionResults(
      createExecutionPlan(["contacts"]),
      async (resource) => ({ resource }),
    );

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
    stdout.mockRestore();
    stderr.mockRestore();
  });
});
