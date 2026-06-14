import { describe, expect, it, vi } from "vitest";
import { consumeExecutionResult } from "./execution-result-consumer.ts";
import { composeExecutionResults } from "./execution-result-composition.ts";
import { createExecutionPlan } from "./sync-execution-plan.ts";

describe("consumeExecutionResult", () => {
  it("delivers a completed envelope and returns unchanged reports", async () => {
    const report = { resource: "contacts", marker: "same-object" };
    const composition = await composeExecutionResults(
      createExecutionPlan(["contacts"]),
      async () => report,
    );
    const consumer = vi.fn();

    const reports = await consumeExecutionResult(composition, consumer);

    expect(consumer).toHaveBeenCalledOnce();
    expect(consumer).toHaveBeenCalledWith(composition.envelope);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toBe(report);
  });

  it("delivers a failed envelope before rethrowing the original error", async () => {
    const events: string[] = [];
    const error = new Error("contacts failed");
    const composition = await composeExecutionResults(
      createExecutionPlan(["contacts"]),
      async () => {
        throw error;
      },
    );

    await expect(
      consumeExecutionResult(composition, async (envelope) => {
        events.push(`delivered:${envelope.status}`);
      }),
    ).rejects.toBe(error);

    expect(events).toEqual(["delivered:failed"]);
  });

  it("keeps completed consumer failures non-blocking", async () => {
    const composition = await composeExecutionResults(
      createExecutionPlan(["contacts"]),
      async (resource) => ({ resource }),
    );

    await expect(
      consumeExecutionResult(composition, () => {
        throw new Error("consumer failed");
      }),
    ).resolves.toEqual([{ resource: "contacts" }]);
  });

  it("does not replace the original execution error with a consumer failure", async () => {
    const originalError = new Error("execution failed");
    const composition = await composeExecutionResults(
      createExecutionPlan(["contacts"]),
      async () => {
        throw originalError;
      },
    );

    await expect(
      consumeExecutionResult(composition, () => {
        throw new Error("consumer failed");
      }),
    ).rejects.toBe(originalError);
  });

  it("uses a no-op consumer by default", async () => {
    const composition = await composeExecutionResults(
      createExecutionPlan(["contacts"]),
      async (resource) => ({ resource }),
    );

    await expect(consumeExecutionResult(composition)).resolves.toEqual([
      { resource: "contacts" },
    ]);
  });

  it("delivers only the sanitized envelope", async () => {
    const originalError = {
      code: "access_token=secret",
      message: "request_metadata=private raw_payload=hidden password=hunter2",
      setup: { service_role_key: "private-key" },
      context: { api_key: "secret-key" },
    };
    const composition = await composeExecutionResults(
      createExecutionPlan(["contacts"]),
      async () => {
        throw originalError;
      },
    );
    const consumer = vi.fn();

    await expect(
      consumeExecutionResult(composition, consumer),
    ).rejects.toBe(originalError);

    const delivered = consumer.mock.calls[0]?.[0];
    expect(Object.keys(delivered)).toEqual([
      "status",
      "mode",
      "planned_count",
      "completed_count",
      "completed_resources",
      "failed_resource",
      "remaining_resources",
      "error",
    ]);
    expect(JSON.stringify(delivered)).not.toMatch(
      /secret|private|hidden|hunter2|request_metadata|raw_payload|setup|context|service_role_key|api_key|originalError/i,
    );
  });

  it("does not write to stdout or stderr", async () => {
    const stdout = vi.spyOn(process.stdout, "write");
    const stderr = vi.spyOn(process.stderr, "write");
    const composition = await composeExecutionResults(
      createExecutionPlan(["contacts"]),
      async (resource) => ({ resource }),
    );

    await consumeExecutionResult(composition);

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
    stdout.mockRestore();
    stderr.mockRestore();
  });
});
