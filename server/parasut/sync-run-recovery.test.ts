import { describe, expect, it } from "vitest";
import {
  DEFAULT_STALE_THRESHOLD_MINUTES,
  recoverStaleRuns,
  type RecoveryDatabase,
} from "./sync-run-recovery.ts";

interface TestRun {
  id: string;
  company_id: string;
  parasut_company_id: string;
  resource_type: string;
  status: string;
  completed_at: string | null;
  page_count: number;
  request_metadata: Record<string, unknown>;
  created_at: string;
}

type Filter =
  | { operation: "eq"; column: string; value: unknown }
  | { operation: "is"; column: string; value: null }
  | { operation: "lt"; column: string; value: string };

function testRun(id: string, createdAt: string): TestRun {
  return {
    id,
    company_id: "company-1",
    parasut_company_id: "666034",
    resource_type: "contacts",
    status: "running",
    completed_at: null,
    page_count: 4,
    request_metadata: { endpoint: "/v4/666034/contacts" },
    created_at: createdAt,
  };
}

function matches(run: TestRun, filter: Filter): boolean {
  const value = run[filter.column as keyof TestRun];
  if (filter.operation === "eq" || filter.operation === "is") {
    return value === filter.value;
  }
  return typeof value === "string" && value < filter.value;
}

function memoryDatabase(runs: TestRun[]): RecoveryDatabase {
  return {
    from() {
      const filters: Filter[] = [];
      let updateValues: Partial<TestRun> | null = null;
      const builder = {
        select() {
          return this;
        },
        update(values: unknown) {
          updateValues = values as Partial<TestRun>;
          return this;
        },
        eq(column: string, value: unknown) {
          filters.push({ operation: "eq", column, value });
          return this;
        },
        is(column: string, value: null) {
          filters.push({ operation: "is", column, value });
          return this;
        },
        lt(column: string, value: string) {
          filters.push({ operation: "lt", column, value });
          return this;
        },
        then(resolve: (value: unknown) => unknown) {
          const selected = runs.filter((run) =>
            filters.every((filter) => matches(run, filter)),
          );
          if (updateValues) {
            selected.forEach((run) => Object.assign(run, updateValues));
          }
          return Promise.resolve(resolve({ data: selected, error: null }));
        },
      };
      return builder;
    },
  } as RecoveryDatabase;
}

const NOW = new Date("2026-06-13T12:00:00.000Z");

describe("recoverStaleRuns", () => {
  it("detects and recovers a stale running run", async () => {
    const runs = [testRun("stale", "2026-06-13T11:00:00.000Z")];

    const result = await recoverStaleRuns(memoryDatabase(runs), { now: NOW });

    expect(result.detectedRunIds).toEqual(["stale"]);
    expect(result.recoveredRunIds).toEqual(["stale"]);
    expect(runs[0]).toMatchObject({
      status: "failed",
      completed_at: NOW.toISOString(),
      request_metadata: {
        recovery: {
          reason: "stale_running_timeout",
          threshold_minutes: DEFAULT_STALE_THRESHOLD_MINUTES,
        },
        resume: {
          eligible: true,
          source_run_id: "stale",
          last_completed_page: 4,
        },
      },
    });
  });

  it("ignores a fresh running run", async () => {
    const runs = [testRun("fresh", "2026-06-13T11:45:00.000Z")];

    const result = await recoverStaleRuns(memoryDatabase(runs), { now: NOW });

    expect(result.detectedRunIds).toEqual([]);
    expect(runs[0].status).toBe("running");
  });

  it("recovers an interrupted run with existing metadata preserved", async () => {
    const run = testRun("interrupted", "2026-06-13T10:00:00.000Z");
    run.request_metadata = { endpoint: "/contacts", include: ["details"] };

    await recoverStaleRuns(memoryDatabase([run]), { now: NOW });

    expect(run.request_metadata).toMatchObject({
      endpoint: "/contacts",
      include: ["details"],
      recovery: { previous_status: "running" },
      resume: { resource_type: "contacts" },
    });
  });

  it("recovers multiple stale runs", async () => {
    const runs = [
      testRun("one", "2026-06-13T10:00:00.000Z"),
      testRun("two", "2026-06-13T10:30:00.000Z"),
      testRun("fresh", "2026-06-13T11:45:00.000Z"),
    ];

    const result = await recoverStaleRuns(memoryDatabase(runs), { now: NOW });

    expect(result.recoveredRunIds).toEqual(["one", "two"]);
    expect(runs.map((run) => run.status)).toEqual(["failed", "failed", "running"]);
  });

  it("is idempotent when recovery runs more than once", async () => {
    const runs = [testRun("stale", "2026-06-13T10:00:00.000Z")];
    const database = memoryDatabase(runs);

    const first = await recoverStaleRuns(database, { now: NOW });
    const second = await recoverStaleRuns(database, {
      now: new Date("2026-06-13T12:01:00.000Z"),
    });

    expect(first.recoveredRunIds).toEqual(["stale"]);
    expect(second.detectedRunIds).toEqual([]);
    expect(second.recoveredRunIds).toEqual([]);
  });
});
