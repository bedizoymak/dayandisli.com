import { describe, expect, it, vi } from "vitest";
import {
  createExecutionEnvelopeDiagnostic,
  isExecutionEnvelopeDiagnosticEnabled,
} from "./execution-envelope-diagnostic.ts";
import { createCompletedExecutionEnvelope } from "./execution-result-envelope.ts";
import { composeExecutionResults } from "./execution-result-composition.ts";
import { consumeExecutionResult } from "./execution-result-consumer.ts";
import { createExecutionPlan } from "./sync-execution-plan.ts";

describe("isExecutionEnvelopeDiagnosticEnabled", () => {
  it("is disabled by default and enabled only by explicit opt-in", () => {
    expect(isExecutionEnvelopeDiagnosticEnabled({})).toBe(false);
    expect(
      isExecutionEnvelopeDiagnosticEnabled({
        PARASUT_EXECUTION_ENVELOPE_DIAGNOSTICS: "1",
      }),
    ).toBe(true);
    expect(
      isExecutionEnvelopeDiagnosticEnabled({
        PARASUT_EXECUTION_ENVELOPE_DIAGNOSTICS: "true",
      }),
    ).toBe(false);
  });
});

describe("createExecutionEnvelopeDiagnostic", () => {
  it("writes nothing when disabled", async () => {
    const writer = vi.fn();
    const diagnostic = createExecutionEnvelopeDiagnostic({
      env: {},
      diagnosticWriter: writer,
    });

    await diagnostic(
      createCompletedExecutionEnvelope(createExecutionPlan(["contacts"])),
    );

    expect(writer).not.toHaveBeenCalled();
  });

  it("writes a completed envelope as one compact JSONL object", async () => {
    const lines: string[] = [];
    const envelope = createCompletedExecutionEnvelope(
      createExecutionPlan(["accounts", "contacts"]),
    );
    const diagnostic = createExecutionEnvelopeDiagnostic({
      env: { PARASUT_EXECUTION_ENVELOPE_DIAGNOSTICS: "1" },
      diagnosticWriter: (line) => {
        lines.push(line);
      },
    });

    await diagnostic(envelope);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe(`${JSON.stringify(envelope)}\n`);
    expect(Object.keys(JSON.parse(lines[0] ?? ""))).toEqual([
      "status",
      "mode",
      "planned_count",
      "completed_count",
      "completed_resources",
    ]);
  });

  it("writes a failed envelope with its exact allowlist", async () => {
    const lines: string[] = [];
    const composition = await composeExecutionResults(
      createExecutionPlan(["contacts", "products"]),
      async () => {
        throw new Error("contacts failed");
      },
    );
    const diagnostic = createExecutionEnvelopeDiagnostic({
      env: { PARASUT_EXECUTION_ENVELOPE_DIAGNOSTICS: "1" },
      diagnosticWriter: (line) => {
        lines.push(line);
      },
    });

    await expect(
      consumeExecutionResult(composition, diagnostic),
    ).rejects.toThrow("contacts failed");

    const output = JSON.parse(lines[0] ?? "");
    expect(Object.keys(output)).toEqual([
      "status",
      "mode",
      "planned_count",
      "completed_count",
      "completed_resources",
      "failed_resource",
      "remaining_resources",
      "error",
    ]);
    expect(Object.keys(output.error)).toEqual([
      "code",
      "message",
      "retryable",
    ]);
  });

  it("isolates writer failures through the Phase 10C consumer", async () => {
    const report = { resource: "contacts" };
    const composition = await composeExecutionResults(
      createExecutionPlan(["contacts"]),
      async () => report,
    );
    const diagnostic = createExecutionEnvelopeDiagnostic({
      env: { PARASUT_EXECUTION_ENVELOPE_DIAGNOSTICS: "1" },
      diagnosticWriter: () => {
        throw new Error("writer failed");
      },
    });

    const reports = await consumeExecutionResult(composition, diagnostic);

    expect(reports[0]).toBe(report);
  });

  it("does not leak reports, original errors, or forbidden state", async () => {
    const lines: string[] = [];
    const originalError = {
      code: "access_token=secret",
      message: "request_metadata=private raw_payload=hidden password=hunter2",
      setup: { service_role_key: "private-key" },
      context: { api_key: "secret-key" },
      reports: [{ personal_data: "private" }],
    };
    const composition = await composeExecutionResults(
      createExecutionPlan(["contacts"]),
      async () => {
        throw originalError;
      },
    );
    const diagnostic = createExecutionEnvelopeDiagnostic({
      env: { PARASUT_EXECUTION_ENVELOPE_DIAGNOSTICS: "1" },
      diagnosticWriter: (line) => {
        lines.push(line);
      },
    });

    await expect(
      consumeExecutionResult(composition, diagnostic),
    ).rejects.toBe(originalError);

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toMatch(
      /secret|private|hidden|hunter2|request_metadata|raw_payload|setup|context|service_role_key|api_key|reports|originalError|personal_data/i,
    );
  });

  it("does not mutate the supplied environment", () => {
    const env = Object.freeze({
      PARASUT_EXECUTION_ENVELOPE_DIAGNOSTICS: "1",
    });

    createExecutionEnvelopeDiagnostic({ env, diagnosticWriter: vi.fn() });

    expect(env).toEqual({
      PARASUT_EXECUTION_ENVELOPE_DIAGNOSTICS: "1",
    });
  });

  it("does not write to stdout or stderr", async () => {
    const stdout = vi.spyOn(process.stdout, "write");
    const stderr = vi.spyOn(process.stderr, "write");
    const diagnostic = createExecutionEnvelopeDiagnostic();

    await diagnostic(
      createCompletedExecutionEnvelope(createExecutionPlan(["contacts"])),
    );

    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
    stdout.mockRestore();
    stderr.mockRestore();
  });
});
