// PHASE 1A remediation tests: reproduce the 2026-08-24 production incident
// mechanism (a poisoned resume page re-failing identically on every
// invocation with zero backoff — see
// CLAUDE_CODE_PRODUCTION_SYNC_INCIDENT_REPORT.md) and prove the retry
// governance contains it while leaving healthy bounded-backlog behavior
// byte-for-byte intact.
import { describe, expect, it } from "vitest";
import { syncCollection } from "./sync-base.ts";
import {
  DEFAULT_RETRY_BASE_DELAY_MS,
  RETRY_GOVERNANCE_METADATA_KEY,
  type RetryGovernanceState,
} from "./sync-retry-governance.ts";
import type {
  JsonApiDocument,
  JsonApiResource,
  MirrorDatabase,
  PaginatedPage,
  SyncContext,
  SyncResourceOptions,
} from "./types.ts";

const T0 = new Date("2026-08-25T00:00:00.000Z");

function contactResource(id: string): JsonApiResource {
  return { id, type: "contacts", attributes: { name: `contact-${id}` }, relationships: {} };
}

interface FakeRow extends Record<string, unknown> {
  id?: string;
}

function createFakeDatabase(options: { poisonMirrorLookups?: boolean } = {}) {
  const tables: Record<string, FakeRow[]> = {
    contacts: [],
    sync_runs: [],
    sync_errors: [],
  };
  let sequence = 0;

  function makeQuery(table: string) {
    const eqPredicates: Array<[string, unknown]> = [];
    const gtPredicates: Array<[string, unknown]> = [];
    let mode: "select" | "insert" | "update" = "select";
    let payload: Record<string, unknown> | null = null;

    const matches = (row: Record<string, unknown>) =>
      eqPredicates.every(([col, val]) => row[col] === val) &&
      // ISO timestamps compare correctly as strings.
      gtPredicates.every(([col, val]) => String(row[col]) > String(val));

    const api = {
      select() {
        mode = "select";
        return api;
      },
      eq(column: string, value: unknown) {
        eqPredicates.push([column, value]);
        return api;
      },
      gt(column: string, value: unknown) {
        gtPredicates.push([column, value]);
        return api;
      },
      is() {
        // recoverStaleRuns uses .is(...) — unimplemented here on purpose:
        // syncCollection wraps recovery best-effort and must swallow this.
        return api;
      },
      lt() {
        return api;
      },
      insert(value: Record<string, unknown>) {
        mode = "insert";
        payload = {
          id: (value.id as string) ?? `row-${++sequence}`,
          created_at: T0.toISOString(),
          ...value,
        };
        tables[table].push(payload);
        return api;
      },
      update(value: Record<string, unknown>) {
        mode = "update";
        payload = value;
        return api;
      },
      maybeSingle: async () => {
        if (options.poisonMirrorLookups && table !== "sync_runs" && table !== "sync_errors") {
          return { data: null, error: { message: "poison: mirror lookup failed persistently" } };
        }
        if (mode === "select") {
          const row = tables[table].find(matches);
          return { data: row ?? null, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => ({ data: payload, error: null }),
      then(resolve: (value: unknown) => unknown) {
        if (mode === "update") {
          const rows = tables[table].filter(matches);
          rows.forEach((row) => Object.assign(row, payload));
          return Promise.resolve(resolve({ data: null, error: null }));
        }
        if (mode === "insert") {
          return Promise.resolve(resolve({ data: null, error: null }));
        }
        const rows = tables[table].filter(matches);
        return Promise.resolve(resolve({ data: rows, error: null }));
      },
    };
    return api;
  }

  const database = {
    schema() {
      return this;
    },
    from(table: string) {
      return makeQuery(table);
    },
  } as unknown as MirrorDatabase;

  return { database, tables };
}

/** Honours startPage like the real ParaşütClient.getPaginated does. */
function fakeClient(pages: PaginatedPage[], callCounter: number[] = []) {
  return {
    async *getPaginated(_path: string, _include: string[] | undefined, startPage = 1) {
      callCounter.push(startPage);
      for (const page of pages) {
        if (page.pageNumber >= startPage) yield page;
      }
    },
  };
}

function singlePage(pageNumber: number, resourceCount: number): PaginatedPage {
  const document: JsonApiDocument = {
    data: Array.from({ length: resourceCount }, (_, i) => contactResource(`${pageNumber}-${i + 1}`)),
  };
  return { pageNumber, document };
}

function buildContext(
  database: MirrorDatabase,
  client: ReturnType<typeof fakeClient>,
  now: Date = T0,
): SyncContext {
  return {
    companyId: "company-A",
    parasutCompanyId: "666034",
    database,
    client: client as SyncContext["client"],
    now: () => now,
  };
}

const baseOptions: SyncResourceOptions = {
  resourceType: "contacts",
  endpoint: "/v4/contacts",
  table: "contacts",
};

function governanceOf(runRow: FakeRow | undefined): RetryGovernanceState | null {
  const metadata = runRow?.request_metadata as Record<string, unknown> | undefined;
  return (metadata?.[RETRY_GOVERNANCE_METADATA_KEY] as RetryGovernanceState) ?? null;
}

describe("syncCollection retry governance (Phase 1A)", () => {
  it("REPRODUCES the incident mechanism: a poisoned page re-fails identically until backoff opens the circuit", async () => {
    const { database, tables } = createFakeDatabase({ poisonMirrorLookups: true });
    const calls: number[] = [];
    const client = fakeClient([singlePage(1, 3)], calls);

    // Attempt 1 (fresh chain): every record's mirror lookup fails.
    const first = await syncCollection(buildContext(database, client), baseOptions);
    expect(first.status).toBe("partial");
    expect(first.errors).toBe(3);
    expect(tables.sync_runs).toHaveLength(1);

    const firstGovernance = governanceOf(tables.sync_runs[0]);
    expect(firstGovernance).toMatchObject({
      attempts: 1,
      consecutive_no_progress: 1,
      open_until: new Date(T0.getTime() + DEFAULT_RETRY_BASE_DELAY_MS).toISOString(),
    });

    // Attempt 2 at the SAME instant (the old behavior would re-fetch the
    // identical page and fail identically — the ~288×/day incident loop).
    const second = await syncCollection(buildContext(database, client), baseOptions);
    expect(second.status).toBe("circuit_open");
    expect(second.runId).toBeNull();
    expect(second.errors).toBe(0);
    expect(second.circuitOpenUntil).toBe(firstGovernance?.open_until);
    // Zero side effects: no new run row, no Paraşüt request, no error rows.
    expect(tables.sync_runs).toHaveLength(1);
    expect(calls).toHaveLength(1);
    expect(tables.sync_errors).toHaveLength(3); // only attempt 1's rows
  });

  it("after the backoff window expires the retry happens and a second zero-progress failure doubles the delay", async () => {
    const { database, tables } = createFakeDatabase({ poisonMirrorLookups: true });
    const calls: number[] = [];
    const client = fakeClient([singlePage(1, 2)], calls);

    await syncCollection(buildContext(database, client), baseOptions);
    expect(governanceOf(tables.sync_runs.at(-1))?.open_until).toBe(
      new Date(T0.getTime() + DEFAULT_RETRY_BASE_DELAY_MS).toISOString(),
    );

    // Still inside window → refused with zero work.
    await syncCollection(buildContext(database, client, new Date(T0.getTime() + 5 * 60 * 1000)), baseOptions);
    expect(tables.sync_runs).toHaveLength(1);

    // Window expired → retry runs and fails again; delay doubles to 2×base.
    const retryAt = new Date(T0.getTime() + DEFAULT_RETRY_BASE_DELAY_MS + 60 * 1000);
    const third = await syncCollection(buildContext(database, client, retryAt), baseOptions);
    expect(third.status).toBe("partial");
    expect(governanceOf(tables.sync_runs.at(-1))).toMatchObject({
      attempts: 2,
      consecutive_no_progress: 2,
      open_until: new Date(retryAt.getTime() + 2 * DEFAULT_RETRY_BASE_DELAY_MS).toISOString(),
    });
    expect(calls).toEqual([1, 1]);
  });

  it("self-heals: once the fault clears after the window, the chain completes normally", async () => {
    const poisonState = createFakeDatabase({ poisonMirrorLookups: true });
    const calls: number[] = [];
    const client = fakeClient([singlePage(1, 4)], calls);
    await syncCollection(buildContext(poisonState.database, client), baseOptions);

    // Fault clears; clock advances past the first backoff window.
    const healthy = createFakeDatabase();
    // Carry over the persisted run history to simulate the same database.
    healthy.tables.sync_runs.push(...poisonState.tables.sync_runs);
    const healed = await syncCollection(
      buildContext(healthy.database, client, new Date(T0.getTime() + DEFAULT_RETRY_BASE_DELAY_MS + 60 * 1000)),
      baseOptions,
    );
    expect(healed.status).toBe("completed");
    expect(healed.inserted).toBe(4);
    // Completed chains are never resume candidates afterwards.
    expect(governanceOf(healthy.tables.sync_runs.at(-1))).toBeNull();
  });

  it("bypass restores the old always-retry behavior for explicit operator resyncs", async () => {
    const { database, tables } = createFakeDatabase({ poisonMirrorLookups: true });
    const calls: number[] = [];
    const client = fakeClient([singlePage(1, 2)], calls);

    await syncCollection(buildContext(database, client), baseOptions);
    const bypassed = await syncCollection(buildContext(database, client), {
      ...baseOptions,
      retryGovernance: { bypass: true },
    });

    expect(bypassed.status).toBe("partial");
    expect(bypassed.runId).not.toBeNull();
    expect(calls).toHaveLength(2);
    expect(tables.sync_runs).toHaveLength(2);
  });

  it("never throttles a healthy budget-bound backlog (progress resets the ladder)", async () => {
    const { database } = createFakeDatabase();
    const calls: number[] = [];
    // Two full pages; per-invocation budget of one page forces a resume chain.
    const client = fakeClient([singlePage(1, 25), singlePage(2, 10)], calls);

    const first = await syncCollection(buildContext(database, client), {
      ...baseOptions,
      maxPagesPerInvocation: 1,
    });
    expect(first.status).toBe("partial");
    expect(first.hasMore).toBe(true);

    // Next tick, immediately (unbounded budget this time): progress was
    // made, so NO circuit_open — the remaining page completes the chain.
    const second = await syncCollection(buildContext(database, client), baseOptions);
    expect(second.status).toBe("completed");
    expect(second.resumed).toBe(true);
    expect(second.totalPagesProcessed).toBe(2);
    expect(calls).toEqual([1, 2]);
  });

  it("governs at (company, resource) granularity: even a changed request shape stays refused until the window expires — bypass is the explicit override", async () => {
    const { database, tables } = createFakeDatabase({ poisonMirrorLookups: true });
    const calls: number[] = [];
    const client = fakeClient([singlePage(1, 2)], calls);
    await syncCollection(buildContext(database, client), baseOptions);

    // Different endpoint fingerprint → decideSyncResume would RESTART rather
    // than resume — but repeated zero-progress RESTARTS of the same resource
    // are precisely as dangerous as resume loops (the page-1-blocked variant
    // of the incident mechanism), so governance still applies. Operators who
    // genuinely need an immediate attempt pass retryGovernance.bypass.
    const reshaped = await syncCollection(buildContext(database, client), {
      ...baseOptions,
      endpoint: "/v4/suppliers",
    });
    expect(reshaped.status).toBe("circuit_open");
    expect(tables.sync_runs).toHaveLength(1);

    const forced = await syncCollection(buildContext(database, client), {
      ...baseOptions,
      endpoint: "/v4/suppliers",
      retryGovernance: { bypass: true },
    });
    expect(forced.status).toBe("partial");
    expect(forced.runId).not.toBeNull();
  });
});
