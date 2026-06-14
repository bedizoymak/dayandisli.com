import { describe, expect, it, vi } from "vitest";
import { createExecutionFailureReport } from "./execution-failure-report.ts";
import {
  createExecutionPlan,
  type SupportedSyncResource,
} from "./sync-execution-plan.ts";

describe("createExecutionFailureReport", () => {
  it("reports a first-resource failure", () => {
    const report = createExecutionFailureReport({
      plan: createExecutionPlan(["contacts", "products", "accounts"]),
      completedResources: [],
      failedResource: "contacts",
      error: new Error("Contact sync failed"),
    });

    expect(report).toEqual({
      status: "failed",
      mode: "custom",
      planned_count: 3,
      completed_count: 0,
      completed_resources: [],
      failed_resource: "contacts",
      remaining_resources: ["products", "accounts"],
      error: {
        code: "Error",
        message: "Contact sync failed",
        retryable: false,
      },
    });
  });

  it("preserves completed resources for a middle failure", () => {
    const report = createExecutionFailureReport({
      plan: createExecutionPlan(["contacts", "products", "accounts"]),
      completedResources: ["contacts"],
      failedResource: "products",
      error: { code: "HTTP_503", message: "Service unavailable", retryable: true },
    });

    expect(report.completed_resources).toEqual(["contacts"]);
    expect(report.failed_resource).toBe("products");
    expect(report.remaining_resources).toEqual(["accounts"]);
    expect(report.error.retryable).toBe(true);
  });

  it("reports no remaining resources after a final failure", () => {
    const report = createExecutionFailureReport({
      plan: createExecutionPlan(["contacts", "accounts"]),
      completedResources: ["contacts"],
      failedResource: "accounts",
      error: new Error("Account sync failed"),
    });

    expect(report.remaining_resources).toEqual([]);
    expect(report.completed_count).toBe(1);
  });

  it("sanitizes error fields through the observability contract", () => {
    const report = createExecutionFailureReport({
      plan: createExecutionPlan(["contacts"]),
      completedResources: [],
      failedResource: "contacts",
      error: {
        code: "access_token=xyz123",
        message:
          "Bearer abc.def.ghi api_key=secret user@example.com +90 555 123 45 67",
        retryable: false,
      },
    });
    const serialized = JSON.stringify(report);

    expect(serialized).not.toMatch(
      /xyz123|abc\.def\.ghi|secret|user@example\.com|\+90 555/i,
    );
  });

  it("contains only allowlisted fields", () => {
    const report = createExecutionFailureReport({
      plan: createExecutionPlan(["contacts"]),
      completedResources: [],
      failedResource: "contacts",
      error: new Error("failed"),
    });

    expect(Object.keys(report)).toEqual([
      "status",
      "mode",
      "planned_count",
      "completed_count",
      "completed_resources",
      "failed_resource",
      "remaining_resources",
      "error",
    ]);
    expect(Object.keys(report.error)).toEqual([
      "code",
      "message",
      "retryable",
    ]);
  });

  it("returns detached arrays", () => {
    const completed: SupportedSyncResource[] = ["contacts"];
    const plan = createExecutionPlan(["contacts", "products", "accounts"]);
    const report = createExecutionFailureReport({
      plan,
      completedResources: completed,
      failedResource: "products",
      error: new Error("failed"),
    });

    completed.push("accounts");
    plan.resources.reverse();

    expect(report.completed_resources).toEqual(["contacts"]);
    expect(report.remaining_resources).toEqual(["accounts"]);
  });

  it("does not leak setup, context, metadata, credentials, or payloads", () => {
    const report = createExecutionFailureReport({
      plan: createExecutionPlan(["contacts"]),
      completedResources: [],
      failedResource: "contacts",
      error: {
        code: null,
        message:
          "request_metadata=private raw_payload=hidden password=hunter2",
        retryable: false,
        setup: { service_role_key: "private-key" },
        context: { access_token: "xyz123" },
      },
    });
    const serialized = JSON.stringify(report);

    expect(serialized).not.toMatch(
      /request_metadata|raw_payload|private|hidden|hunter2|service_role_key|access_token|xyz123/i,
    );
  });

  it("does not write to stdout or stderr", () => {
    const stdout = vi.spyOn(process.stdout, "write");
    const stderr = vi.spyOn(process.stderr, "write");

    createExecutionFailureReport({
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
