import { describe, expect, it, vi } from "vitest";
import {
  createLocalObservabilitySink,
  isLocalObservabilityEnabled,
} from "./local-observability-sink.ts";
import type {
  ErrorSummary,
  SyncSummary,
} from "./sync-observability.ts";

const summary: SyncSummary = {
  run_id: "run-1",
  resource_type: "contacts",
  status: "completed",
  pages: 2,
  observed: 5,
  inserted: 2,
  updated: 1,
  unchanged: 2,
  errors: 0,
  last_completed_page: 2,
  duration_ms: 1250,
};

const errorSummary: ErrorSummary = {
  code: "HTTP_429",
  message: "Rate limit reached",
  retryable: true,
};

describe("isLocalObservabilityEnabled", () => {
  it("is disabled by default", () => {
    expect(isLocalObservabilityEnabled({})).toBe(false);
  });

  it("is enabled only by the explicit environment value", () => {
    expect(
      isLocalObservabilityEnabled({ PARASUT_SYNC_OBSERVABILITY: "1" }),
    ).toBe(true);
    expect(
      isLocalObservabilityEnabled({ PARASUT_SYNC_OBSERVABILITY: "true" }),
    ).toBe(false);
  });
});

describe("createLocalObservabilitySink", () => {
  it("does not write when observability is disabled", async () => {
    const writeLine = vi.fn();
    const sink = createLocalObservabilitySink({ env: {}, writeLine });

    await sink.emitSyncSummary?.(summary);
    await sink.emitErrorSummary?.(errorSummary);

    expect(writeLine).not.toHaveBeenCalled();
  });

  it("serializes a summary as one JSONL object with exact allowlisted fields", async () => {
    const lines: string[] = [];
    const sink = createLocalObservabilitySink({
      env: { PARASUT_SYNC_OBSERVABILITY: "1" },
      writeLine: (line) => {
        lines.push(line);
      },
    });
    const input = {
      ...summary,
      request_metadata: { access_token: "xyz123" },
      raw_payload: { email: "user@example.com" },
    } as SyncSummary;

    await sink.emitSyncSummary?.(input);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.endsWith("\n")).toBe(true);
    expect(JSON.parse(lines[0] ?? "")).toEqual(summary);
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
  });

  it("serializes an error as one sanitized JSONL object", async () => {
    const lines: string[] = [];
    const sink = createLocalObservabilitySink({
      env: { PARASUT_SYNC_OBSERVABILITY: "1" },
      writeLine: (line) => {
        lines.push(line);
      },
    });

    await sink.emitErrorSummary?.({
      code: "access_token=xyz123",
      message:
        "Bearer abc.def.ghi user@example.com +90 555 123 45 67 raw_payload=private",
      retryable: false,
      request_metadata: { refresh_token: "abc456" },
    } as ErrorSummary);

    const output = JSON.parse(lines[0] ?? "");
    expect(Object.keys(output)).toEqual(["code", "message", "retryable"]);
    expect(JSON.stringify(output)).not.toMatch(
      /xyz123|abc\.def\.ghi|user@example\.com|\+90 555|abc456|request_metadata|raw_payload|private/i,
    );
  });

  it("isolates writer failures", async () => {
    const sink = createLocalObservabilitySink({
      env: { PARASUT_SYNC_OBSERVABILITY: "1" },
      writeLine: () => {
        throw new Error("writer failed");
      },
    });

    await expect(sink.emitSyncSummary?.(summary)).resolves.toBeUndefined();
    await expect(
      sink.emitErrorSummary?.(errorSummary),
    ).resolves.toBeUndefined();
  });

  it("redacts sensitive summary identifiers", async () => {
    const lines: string[] = [];
    const sink = createLocalObservabilitySink({
      env: { PARASUT_SYNC_OBSERVABILITY: "1" },
      writeLine: (line) => {
        lines.push(line);
      },
    });

    await sink.emitSyncSummary?.({
      ...summary,
      run_id: "access_token=xyz123",
      resource_type: "user@example.com",
    });

    expect(lines[0]).not.toContain("xyz123");
    expect(lines[0]).not.toContain("user@example.com");
  });
});
