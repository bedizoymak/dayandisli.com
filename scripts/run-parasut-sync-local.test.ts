import { describe, expect, it, vi } from "vitest";
import type {
  ErrorSummary,
  SyncSummary,
} from "../server/parasut/sync-observability.ts";
import {
  composeLocalSyncContext,
  createCliOutputChannels,
  formatAggregateReport,
  formatCliFailure,
  orchestrateLocalExecution,
  writeAggregateReport,
} from "./run-parasut-sync-local.mjs";

const summary: SyncSummary = {
  run_id: "run-1",
  resource_type: "contacts",
  status: "completed",
  pages: 1,
  observed: 2,
  inserted: 1,
  updated: 0,
  unchanged: 1,
  errors: 0,
  last_completed_page: 1,
  duration_ms: 25,
};

const errorSummary: ErrorSummary = {
  code: "HTTP_429",
  message: "Rate limit reached",
  retryable: true,
};

function baseContext() {
  return {
    companyId: "company-1",
    parasutCompanyId: "666034",
    database: { source: "mock-database" },
    client: { source: "mock-client" },
  };
}

describe("local CLI observability composition", () => {
  it("writes no observability lines when disabled", async () => {
    const writeLine = vi.fn();
    const context = composeLocalSyncContext(baseContext(), {
      env: {},
      writeLine,
    });

    await context.observability.emitSyncSummary?.(summary);
    await context.observability.emitErrorSummary?.(errorSummary);

    expect(writeLine).not.toHaveBeenCalled();
  });

  it("writes separate valid JSONL summary and error objects when enabled", async () => {
    const lines: string[] = [];
    const context = composeLocalSyncContext(baseContext(), {
      env: { PARASUT_SYNC_OBSERVABILITY: "1" },
      writeLine: (line: string) => {
        lines.push(line);
      },
    });

    await context.observability.emitSyncSummary?.(summary);
    await context.observability.emitErrorSummary?.(errorSummary);

    expect(lines).toHaveLength(2);
    expect(lines.every((line) => line.endsWith("\n"))).toBe(true);
    expect(lines.map((line) => JSON.parse(line))).toEqual([
      summary,
      errorSummary,
    ]);
    expect(Object.keys(JSON.parse(lines[0] ?? ""))).toEqual([
      "run_id",
      "resource_type",
      "status",
      "pages",
      "observed",
      "inserted",
      "updated",
      "unchanged",
      "errors",
      "last_completed_page",
      "duration_ms",
    ]);
    expect(Object.keys(JSON.parse(lines[1] ?? ""))).toEqual([
      "code",
      "message",
      "retryable",
    ]);
  });

  it("does not alter a mocked sync result when the writer fails", async () => {
    const result = { runId: "run-1", status: "completed" };
    const sync = vi.fn(async (context) => {
      await context.observability.emitSyncSummary?.(summary);
      return result;
    });
    const context = composeLocalSyncContext(baseContext(), {
      env: { PARASUT_SYNC_OBSERVABILITY: "1" },
      writeLine: () => {
        throw new Error("writer failed");
      },
    });

    await expect(sync(context)).resolves.toBe(result);
  });

  it("does not mutate the supplied environment", () => {
    const env = Object.freeze({ PARASUT_SYNC_OBSERVABILITY: "1" });

    composeLocalSyncContext(baseContext(), {
      env,
      writeLine: vi.fn(),
    });

    expect(env).toEqual({ PARASUT_SYNC_OBSERVABILITY: "1" });
  });

  it("routes observability only through the diagnostic writer", async () => {
    const diagnosticWriter = vi.fn();
    const reportWriter = vi.fn();
    const channels = createCliOutputChannels({
      diagnosticWriter,
      reportWriter,
    });
    const context = composeLocalSyncContext(baseContext(), {
      env: { PARASUT_SYNC_OBSERVABILITY: "1" },
      diagnosticWriter: channels.diagnosticWriter,
    });

    await context.observability.emitSyncSummary?.(summary);

    expect(diagnosticWriter).toHaveBeenCalledOnce();
    expect(reportWriter).not.toHaveBeenCalled();
  });

  it("emits diagnostics before the final aggregate report", async () => {
    const events: string[] = [];
    const channels = createCliOutputChannels({
      diagnosticWriter: (line: string) => {
        events.push(`diagnostic:${line}`);
      },
      reportWriter: (output: string) => {
        events.push(`report:${output}`);
      },
    });
    const context = composeLocalSyncContext(baseContext(), {
      env: { PARASUT_SYNC_OBSERVABILITY: "1" },
      diagnosticWriter: channels.diagnosticWriter,
    });
    const report = [{ resource: "contacts", idempotent: true }];

    await context.observability.emitSyncSummary?.(summary);
    await writeAggregateReport(report, channels.reportWriter);

    expect(events).toHaveLength(2);
    expect(events[0]).toMatch(/^diagnostic:\{.*\}\n$/);
    expect(events[1]).toBe(`report:${formatAggregateReport(report)}`);
  });
});

describe("local CLI formatting", () => {
  it("preserves the existing aggregate report format", () => {
    const report = [{ resource: "contacts", idempotent: true }];

    expect(formatAggregateReport(report)).toBe(
      `${JSON.stringify({ target: "local", resources: report }, null, 2)}\n`,
    );
  });

  it("sanitizes CLI failures without stdout or stderr writes", () => {
    const stdout = vi.spyOn(process.stdout, "write");
    const stderr = vi.spyOn(process.stderr, "write");

    const formatted = formatCliFailure(
      new Error(
        "Bearer abc.def.ghi api_key=secret user@example.com +90 555 123 45 67 request_metadata=private raw_payload=hidden",
      ),
    );

    expect(formatted).toContain("Local Paraşüt sync refused or failed:");
    expect(formatted).not.toMatch(
      /abc\.def\.ghi|secret|user@example\.com|\+90 555|private|hidden|request_metadata|raw_payload/i,
    );
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();

    stdout.mockRestore();
    stderr.mockRestore();
  });

  it("routes the aggregate report only through the report writer", async () => {
    const diagnosticWriter = vi.fn();
    const reportWriter = vi.fn();
    const channels = createCliOutputChannels({
      diagnosticWriter,
      reportWriter,
    });
    const report = [{ resource: "contacts", idempotent: true }];

    await writeAggregateReport(report, channels.reportWriter);

    expect(reportWriter).toHaveBeenCalledWith(formatAggregateReport(report));
    expect(diagnosticWriter).not.toHaveBeenCalled();
  });

  it("surfaces report writer failures deterministically", async () => {
    const reportWriter = vi.fn(() => {
      throw new Error("report writer failed");
    });

    await expect(writeAggregateReport([], reportWriter)).rejects.toThrow(
      "report writer failed",
    );
  });

  it("defaults both output channels to stdout without writing during composition", () => {
    const stdout = vi.spyOn(process.stdout, "write");

    const channels = createCliOutputChannels();

    expect(channels.diagnosticWriter).toBe(channels.reportWriter);
    expect(stdout).not.toHaveBeenCalled();
    stdout.mockRestore();
  });
});

describe("local execution-plan orchestration", () => {
  it("rejects an unknown resource before setup", async () => {
    const setup = vi.fn();

    await expect(
      orchestrateLocalExecution(["payments"], { setup, executeResource: vi.fn() }),
    ).rejects.toThrow("Unsupported sync resource: payments");
    expect(setup).not.toHaveBeenCalled();
  });

  it("rejects a duplicate resource before setup", async () => {
    const setup = vi.fn();

    await expect(
      orchestrateLocalExecution(["contacts", "contacts"], {
        setup,
        executeResource: vi.fn(),
      }),
    ).rejects.toThrow("Duplicate sync resource: contacts");
    expect(setup).not.toHaveBeenCalled();
  });

  it("executes the default plan sequentially", async () => {
    const order: string[] = [];
    const result = await orchestrateLocalExecution([], {
      setup: async () => ({ marker: "setup" }),
      executeResource: async (resource) => {
        order.push(resource);
        return { resource };
      },
    });

    expect(order).toEqual([
      "contacts",
      "products",
      "sales_invoices",
      "purchase_bills",
      "accounts",
    ]);
    expect(result.reports.map((report) => report.resource)).toEqual(order);
  });

  it("executes only the custom plan in requested order", async () => {
    const executeResource = vi.fn(async (resource) => ({ resource }));

    const result = await orchestrateLocalExecution(
      ["accounts", "contacts"],
      {
        setup: async () => ({}),
        executeResource,
      },
    );

    expect(executeResource.mock.calls.map(([resource]) => resource)).toEqual([
      "accounts",
      "contacts",
    ]);
    expect(result.reports).toEqual([
      { resource: "accounts" },
      { resource: "contacts" },
    ]);
  });

  it("stops after a resource failure and excludes the failed attempt", async () => {
    const order: string[] = [];
    const reports: unknown[] = [];

    await expect(
      orchestrateLocalExecution(["contacts", "products", "accounts"], {
        setup: async () => ({}),
        executeResource: async (resource) => {
          order.push(resource);
          if (resource === "products") {
            throw new Error("products failed");
          }
          const report = { resource };
          reports.push(report);
          return report;
        },
      }),
    ).rejects.toThrow("products failed");

    expect(order).toEqual(["contacts", "products"]);
    expect(reports).toEqual([{ resource: "contacts" }]);
  });

  it("does not write output or mutate requested resources", async () => {
    const stdout = vi.spyOn(process.stdout, "write");
    const stderr = vi.spyOn(process.stderr, "write");
    const requested = Object.freeze(["products", "contacts"] as const);

    await orchestrateLocalExecution(requested, {
      setup: async () => ({}),
      executeResource: async (resource) => ({ resource }),
    });

    expect(requested).toEqual(["products", "contacts"]);
    expect(stdout).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
    stdout.mockRestore();
    stderr.mockRestore();
  });

  it("keeps execution envelope diagnostics disabled by default", async () => {
    const diagnosticWriter = vi.fn();
    const reportWriter = vi.fn();

    const result = await orchestrateLocalExecution(["contacts"], {
      env: {},
      setup: async () => ({
        output: createCliOutputChannels({
          diagnosticWriter,
          reportWriter,
        }),
      }),
      executeResource: async (resource) => ({ resource }),
    });

    await writeAggregateReport(result.reports, result.setup.output.reportWriter);

    expect(diagnosticWriter).not.toHaveBeenCalled();
    expect(reportWriter).toHaveBeenCalledWith(formatAggregateReport(result.reports));
  });

  it("writes a completed envelope before the byte-compatible aggregate report", async () => {
    const events: Array<{ channel: "diagnostic" | "report"; value: string }> = [];
    const reports = [{ resource: "contacts", status: "completed" }];

    const result = await orchestrateLocalExecution(["contacts"], {
      env: { PARASUT_EXECUTION_ENVELOPE_DIAGNOSTICS: "1" },
      setup: async () => ({
        output: createCliOutputChannels({
          diagnosticWriter: (value) =>
            events.push({ channel: "diagnostic", value }),
          reportWriter: (value) => events.push({ channel: "report", value }),
        }),
      }),
      executeResource: async () => reports[0],
    });

    await writeAggregateReport(result.reports, result.setup.output.reportWriter);

    expect(events).toEqual([
      {
        channel: "diagnostic",
        value:
          '{"status":"completed","mode":"custom","planned_count":1,"completed_count":1,"completed_resources":["contacts"]}\n',
      },
      {
        channel: "report",
        value: formatAggregateReport(reports),
      },
    ]);
  });

  it("writes a sanitized failed envelope before preserving the original failure", async () => {
    const events: string[] = [];
    const originalError = Object.assign(
      new Error(
        "access_token=secret user@example.com request_metadata=private raw_payload=hidden",
      ),
      { code: "api_key=secret" },
    );

    let caughtError: unknown;
    try {
      await orchestrateLocalExecution(["contacts", "products"], {
        env: { PARASUT_EXECUTION_ENVELOPE_DIAGNOSTICS: "1" },
        setup: async () => ({
          output: createCliOutputChannels({
            diagnosticWriter: (value) =>
              events.push(`diagnostic:${value}`),
            reportWriter: (value) => events.push(`report:${value}`),
          }),
        }),
        executeResource: async (resource) => {
          if (resource === "products") {
            throw originalError;
          }
          return { resource };
        },
      });
    } catch (error) {
      caughtError = error;
      events.push(`failure:${formatCliFailure(error)}`);
    }

    expect(caughtError).toBe(originalError);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatch(/^diagnostic:\{"status":"failed"/);
    expect(events[1]).toMatch(/^failure:/);

    const envelope = JSON.parse(events[0]!.slice("diagnostic:".length));
    expect(Object.keys(envelope)).toEqual([
      "status",
      "mode",
      "planned_count",
      "completed_count",
      "completed_resources",
      "failed_resource",
      "remaining_resources",
      "error",
    ]);
    expect(envelope.completed_resources).toEqual(["contacts"]);
    expect(envelope.failed_resource).toBe("products");
    expect(JSON.stringify(envelope)).not.toMatch(
      /secret|user@example\.com|request_metadata|raw_payload/i,
    );
  });

  it("isolates execution envelope diagnostic writer failures", async () => {
    const report = { resource: "contacts", status: "completed" };

    await expect(
      orchestrateLocalExecution(["contacts"], {
        env: { PARASUT_EXECUTION_ENVELOPE_DIAGNOSTICS: "1" },
        setup: async () => ({
          output: createCliOutputChannels({
            diagnosticWriter: () => {
              throw new Error("writer failed");
            },
            reportWriter: () => undefined,
          }),
        }),
        executeResource: async () => report,
      }),
    ).resolves.toMatchObject({ reports: [report] });
  });

  it("does not mutate the diagnostic environment input", async () => {
    const env = Object.freeze({
      PARASUT_EXECUTION_ENVELOPE_DIAGNOSTICS: "1",
    });

    await orchestrateLocalExecution(["contacts"], {
      env,
      setup: async () => ({
        output: createCliOutputChannels({
          diagnosticWriter: () => undefined,
          reportWriter: () => undefined,
        }),
      }),
      executeResource: async (resource) => ({ resource }),
    });

    expect(env).toEqual({
      PARASUT_EXECUTION_ENVELOPE_DIAGNOSTICS: "1",
    });
  });
});
