import { describe, expect, it, vi } from "vitest";
import {
  createCompletedExecutionEnvelope,
  createFailedExecutionEnvelope,
} from "./execution-result-envelope.ts";
import { createExecutionPlan } from "./sync-execution-plan.ts";

describe("execution result envelope", () => {
  it("creates a completed default-plan envelope", () => {
    const plan = createExecutionPlan();
    const envelope = createCompletedExecutionEnvelope(plan);

    expect(envelope).toEqual({
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
  });

  it("creates a completed custom-plan envelope in requested order", () => {
    const envelope = createCompletedExecutionEnvelope(
      createExecutionPlan(["accounts", "contacts"]),
    );

    expect(envelope.completed_resources).toEqual(["accounts", "contacts"]);
    expect(envelope.mode).toBe("custom");
  });

  it("delegates failed envelopes to the Phase 9C contract", () => {
    const envelope = createFailedExecutionEnvelope({
      plan: createExecutionPlan(["contacts", "products", "accounts"]),
      completedResources: ["contacts"],
      failedResource: "products",
      error: {
        code: "HTTP_503",
        message: "Service unavailable",
        retryable: true,
      },
    });

    expect(envelope).toEqual({
      status: "failed",
      mode: "custom",
      planned_count: 3,
      completed_count: 1,
      completed_resources: ["contacts"],
      failed_resource: "products",
      remaining_resources: ["accounts"],
      error: {
        code: "HTTP_503",
        message: "Service unavailable",
        retryable: true,
      },
    });
  });

  it("uses exact allowlisted fields for both outcomes", () => {
    const completed = createCompletedExecutionEnvelope(
      createExecutionPlan(["contacts"]),
    );
    const failed = createFailedExecutionEnvelope({
      plan: createExecutionPlan(["contacts"]),
      completedResources: [],
      failedResource: "contacts",
      error: new Error("failed"),
    });

    expect(Object.keys(completed)).toEqual([
      "status",
      "mode",
      "planned_count",
      "completed_count",
      "completed_resources",
    ]);
    expect(Object.keys(failed)).toEqual([
      "status",
      "mode",
      "planned_count",
      "completed_count",
      "completed_resources",
      "failed_resource",
      "remaining_resources",
      "error",
    ]);
  });

  it("returns detached arrays", () => {
    const plan = createExecutionPlan(["contacts", "products"]);
    const completed = createCompletedExecutionEnvelope(plan);

    plan.resources.reverse();

    expect(completed.completed_resources).toEqual(["contacts", "products"]);
  });

  it("does not leak setup, context, metadata, credentials, or payloads", () => {
    const failed = createFailedExecutionEnvelope({
      plan: createExecutionPlan(["contacts"]),
      completedResources: [],
      failedResource: "contacts",
      error: {
        code: "access_token=secret",
        message:
          "request_metadata=private raw_payload=hidden password=hunter2",
        retryable: false,
        setup: { service_role_key: "private-key" },
        context: { api_key: "secret-key" },
      },
    });
    const serialized = JSON.stringify(failed);

    expect(serialized).not.toMatch(
      /secret|private|hidden|hunter2|request_metadata|raw_payload|setup|context|service_role_key|api_key/i,
    );
  });

  it("does not write to stdout or stderr", () => {
    const stdout = vi.spyOn(process.stdout, "write");
    const stderr = vi.spyOn(process.stderr, "write");

    createCompletedExecutionEnvelope(createExecutionPlan(["contacts"]));
    createFailedExecutionEnvelope({
      plan: createExecutionPlan(["contacts"]),
      completedResources: [],
      failedResource: "contacts",
      error: new Error("failed"),
    });

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
    stdout.mockRestore();
    stderr.mockRestore();
  });
});
