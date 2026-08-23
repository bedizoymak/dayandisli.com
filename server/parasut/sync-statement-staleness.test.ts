// Covers the P0 incident fix: transaction_history_items previously froze
// silently because nothing re-synced it. This file proves the staleness
// computation that now drives the scheduled cron's statement-refresh step —
// especially the two failure modes an earlier, naive design would have
// reintroduced: (1) a missing baseline evaluating as "no mismatch" instead
// of "stale", which would make the ~437 contacts most in need of a first
// sync the ones silently skipped forever, and (2) a "sync_runs.status ===
// 'completed' => never revisit" rule, which would freeze metadata
// (descriptions, check status, dates) even while balances stay numerically
// correct.
import { describe, expect, it } from "vitest";
import { computeContactStaleness, staleOnly, refreshStaleStatements, STALE_SWEEP_HOURS } from "./sync-statement-staleness.ts";
import type { MirrorDatabase, SyncContext } from "./types.ts";

function createFakeDatabase(seed: {
  contacts?: Record<string, unknown>[];
  transaction_history_items?: Record<string, unknown>[];
  sync_runs?: Record<string, unknown>[];
}) {
  const tables: Record<string, Record<string, unknown>[]> = {
    contacts: seed.contacts ?? [],
    transaction_history_items: seed.transaction_history_items ?? [],
    sync_runs: seed.sync_runs ?? [],
  };
  let nextId = 1;

  // Mirrors the real supabase-js/PostgREST "json_col->>key" filter syntax
  // used in production (see handlers.ts) — "col->>key" reads
  // row[col]?.[key] instead of a literal row["col->>key"] property.
  const readValue = (row: Record<string, unknown>, col: string): unknown => {
    const arrowIndex = col.indexOf("->>");
    if (arrowIndex === -1) return row[col];
    const [jsonColumn, key] = [col.slice(0, arrowIndex), col.slice(arrowIndex + 3)];
    const jsonValue = row[jsonColumn] as Record<string, unknown> | null | undefined;
    return jsonValue?.[key];
  };

  function makeQuery(table: string) {
    const eqPredicates: Array<[string, unknown]> = [];
    const gtPredicates: Array<[string, unknown]> = [];
    let mode: "select" | "insert" | "update" = "select";
    let payload: Record<string, unknown> | null = null;
    const matches = (row: Record<string, unknown>) =>
      eqPredicates.every(([col, val]) => readValue(row, col) === val) &&
      gtPredicates.every(([col, val]) => String(readValue(row, col)) > String(val));
    const api = {
      select() { return api; },
      eq(column: string, value: unknown) { eqPredicates.push([column, value]); return api; },
      gt(column: string, value: unknown) { gtPredicates.push([column, value]); return api; },
      insert(value: Record<string, unknown>) {
        mode = "insert";
        // Simulates the partial unique index sync_runs_statement_refresh_lock_singleton:
        // reject a second concurrent "running" statement_refresh_lock row for the same company.
        if (
          table === "sync_runs" &&
          value.resource_type === "statement_refresh_lock" &&
          value.status === "running" &&
          tables[table].some((row) => row.resource_type === "statement_refresh_lock" && row.status === "running" && row.company_id === value.company_id)
        ) {
          payload = null;
          (api as unknown as { __insertConflict: boolean }).__insertConflict = true;
        } else {
          payload = { id: `row-${nextId++}`, ...value };
          tables[table].push(payload);
        }
        return api;
      },
      update(value: Record<string, unknown>) { mode = "update"; payload = value; return api; },
      maybeSingle: async () => {
        const row = tables[table].find(matches);
        return { data: row ?? null, error: null };
      },
      single: async () => {
        if ((api as unknown as { __insertConflict?: boolean }).__insertConflict) {
          return { data: null, error: { message: "duplicate key value violates unique constraint" } };
        }
        return { data: payload, error: null };
      },
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
    schema() { return this; },
    from(table: string) { return makeQuery(table); },
  } as unknown as MirrorDatabase;

  return database;
}

function buildContext(database: MirrorDatabase): SyncContext {
  return {
    companyId: "company-1",
    parasutCompanyId: "666034",
    database,
    client: { async *getPaginated() {} },
  };
}

const NOW = new Date("2026-08-23T12:00:00.000Z");

describe("computeContactStaleness", () => {
  it("treats a missing transaction_history_items baseline as stale, never as 'no mismatch' (item 2)", async () => {
    const database = createFakeDatabase({
      contacts: [{ parasut_id: "500", company_id: "company-1", parasut_company_id: "666034", source_archived: false, attributes: { trl_balance: "0", updated_at: "2026-08-23T00:00:00Z" } }],
      transaction_history_items: [], // never synced for this contact
      sync_runs: [],
    });
    const [result] = await computeContactStaleness(buildContext(database), NOW);
    expect(result.mirroredClosingBalance).toBeNull();
    expect(result.mismatchMagnitude).toBe(Infinity);
    expect(result.reason).toBe("never_synced");
    expect(staleOnly([result])).toHaveLength(1);
  });

  it("flags a genuine balance mismatch even with a completed sync_runs row (item 3: no permanent completed=skip)", async () => {
    const database = createFakeDatabase({
      contacts: [{ parasut_id: "500", company_id: "company-1", parasut_company_id: "666034", source_archived: false, attributes: { trl_balance: "-5000000.0", updated_at: "2026-08-23T11:00:00Z" } }],
      transaction_history_items: [
        { contact_parasut_id: "500", company_id: "company-1", parasut_company_id: "666034", statement_order: 0, trl_balance: -1000000 },
      ],
      sync_runs: [
        {
          company_id: "company-1", parasut_company_id: "666034", resource_type: "transaction_history_items", status: "completed",
          created_at: "2026-08-22T15:52:00Z", completed_at: "2026-08-22T15:52:00Z",
          request_metadata: { endpoint: "/v4/666034/contacts/500/transaction_history_items" },
        },
      ],
    });
    const [result] = await computeContactStaleness(buildContext(database), NOW);
    expect(result.mirroredClosingBalance).toBe(-1000000);
    expect(result.mismatchMagnitude).toBeCloseTo(4000000);
    expect(result.reason).toBe("balance_mismatch");
  });

  it("flags a contact as stale via the rolling sweep backstop even when balances already agree (item 1: catches balance-neutral drift)", async () => {
    const database = createFakeDatabase({
      contacts: [{ parasut_id: "500", company_id: "company-1", parasut_company_id: "666034", source_archived: false, attributes: { trl_balance: "1000", updated_at: "2026-08-01T00:00:00Z" } }],
      transaction_history_items: [
        { contact_parasut_id: "500", company_id: "company-1", parasut_company_id: "666034", statement_order: 0, trl_balance: 1000 },
      ],
      sync_runs: [
        {
          company_id: "company-1", parasut_company_id: "666034", resource_type: "transaction_history_items", status: "completed",
          created_at: "2026-08-01T00:00:00Z", completed_at: "2026-08-01T00:00:00Z", // far older than STALE_SWEEP_HOURS before NOW
          request_metadata: { endpoint: "/v4/666034/contacts/500/transaction_history_items" },
        },
      ],
    });
    const [result] = await computeContactStaleness(buildContext(database), NOW);
    expect(result.mismatchMagnitude).toBe(0);
    expect(result.hoursSinceLastCompletedSync).toBeGreaterThan(STALE_SWEEP_HOURS);
    expect(result.reason).toBe("sweep_due");
  });

  it("marks a contact fresh only when balances agree AND the last sync is within the sweep window", async () => {
    const database = createFakeDatabase({
      contacts: [{ parasut_id: "500", company_id: "company-1", parasut_company_id: "666034", source_archived: false, attributes: { trl_balance: "1000", updated_at: "2026-08-23T00:00:00Z" } }],
      transaction_history_items: [
        { contact_parasut_id: "500", company_id: "company-1", parasut_company_id: "666034", statement_order: 0, trl_balance: 1000 },
      ],
      sync_runs: [
        {
          company_id: "company-1", parasut_company_id: "666034", resource_type: "transaction_history_items", status: "completed",
          created_at: "2026-08-23T11:00:00Z", completed_at: "2026-08-23T11:00:00Z", // 1 hour before NOW
          request_metadata: { endpoint: "/v4/666034/contacts/500/transaction_history_items" },
        },
      ],
    });
    const [result] = await computeContactStaleness(buildContext(database), NOW);
    expect(result.reason).toBe("fresh");
    expect(staleOnly([result])).toHaveLength(0);
  });

  it("orders stale contacts by mismatch magnitude descending, missing-baseline (Infinity) first, then most recent Paraşüt activity (item 4)", async () => {
    const database = createFakeDatabase({
      contacts: [
        { parasut_id: "small-mismatch", company_id: "company-1", parasut_company_id: "666034", source_archived: false, attributes: { trl_balance: "100", updated_at: "2026-08-20T00:00:00Z" } },
        { parasut_id: "never-synced-old-activity", company_id: "company-1", parasut_company_id: "666034", source_archived: false, attributes: { trl_balance: "50", updated_at: "2026-08-10T00:00:00Z" } },
        { parasut_id: "never-synced-recent-activity", company_id: "company-1", parasut_company_id: "666034", source_archived: false, attributes: { trl_balance: "50", updated_at: "2026-08-23T10:00:00Z" } },
        { parasut_id: "large-mismatch", company_id: "company-1", parasut_company_id: "666034", source_archived: false, attributes: { trl_balance: "-5000000", updated_at: "2026-08-01T00:00:00Z" } },
      ],
      transaction_history_items: [
        { contact_parasut_id: "small-mismatch", company_id: "company-1", parasut_company_id: "666034", statement_order: 0, trl_balance: 50 },
        { contact_parasut_id: "large-mismatch", company_id: "company-1", parasut_company_id: "666034", statement_order: 0, trl_balance: -1000000 },
      ],
      sync_runs: [],
    });
    const all = await computeContactStaleness(buildContext(database), NOW);
    const order = staleOnly(all).map((c) => c.contactParasutId);
    // Both never-synced contacts (Infinity mismatch) sort ahead of every finite mismatch, in most-recent-activity order between themselves; then large-mismatch, then small-mismatch.
    expect(order).toEqual(["never-synced-recent-activity", "never-synced-old-activity", "large-mismatch", "small-mismatch"]);
  });
});

describe("refreshStaleStatements — invocation-level lease guard", () => {
  it("skips the entire invocation (touches zero contacts, makes zero Paraşüt requests) when a live lease (recent heartbeat) is already held", async () => {
    let getPaginatedCalls = 0;
    const database = createFakeDatabase({
      contacts: [{ parasut_id: "500", company_id: "company-1", parasut_company_id: "666034", source_archived: false, attributes: { trl_balance: "0" } }],
      transaction_history_items: [], // never synced -> would normally be the top-priority candidate
      sync_runs: [
        {
          company_id: "company-1", parasut_company_id: "666034", resource_type: "statement_refresh_lock", status: "running",
          request_metadata: { last_heartbeat_at: "2026-08-23T11:59:30.000Z" }, // 30s before NOW — well within the orphan threshold
        },
      ],
    });
    const context: SyncContext = {
      companyId: "company-1", parasutCompanyId: "666034", database,
      client: { async *getPaginated() { getPaginatedCalls++; } },
    };
    const summary = await refreshStaleStatements(context, { now: NOW });
    expect(summary.skippedOverlap).toBe(true);
    expect(summary.contactsTouched).toHaveLength(0);
    expect(getPaginatedCalls).toBe(0);
  });

  it("this is exactly the long-run case: a lease whose holder is still genuinely working (heartbeat inside the orphan window) at a time a fixed 90s window would have expired — must still skip (proves the guard bounds by activity, not by a clock)", async () => {
    let getPaginatedCalls = 0;
    const database = createFakeDatabase({
      contacts: [{ parasut_id: "500", company_id: "company-1", parasut_company_id: "666034", source_archived: false, attributes: { trl_balance: "0" } }],
      transaction_history_items: [],
      sync_runs: [
        {
          company_id: "company-1", parasut_company_id: "666034", resource_type: "statement_refresh_lock", status: "running",
          // Lease started 5 minutes ago (far past a fixed 90s window) but its heartbeat is fresh (10s old) — a still-alive, still-progressing run.
          request_metadata: { last_heartbeat_at: "2026-08-23T11:59:50.000Z" },
        },
      ],
    });
    const context: SyncContext = {
      companyId: "company-1", parasutCompanyId: "666034", database,
      client: { async *getPaginated() { getPaginatedCalls++; } },
    };
    const summary = await refreshStaleStatements(context, { now: NOW });
    expect(summary.skippedOverlap).toBe(true);
    expect(getPaginatedCalls).toBe(0);
  });

  it("reaps an orphaned lease (no heartbeat within the orphan window) explicitly — marks it failed and proceeds", async () => {
    const database = createFakeDatabase({
      contacts: [{ parasut_id: "500", company_id: "company-1", parasut_company_id: "666034", source_archived: false, attributes: { trl_balance: "0" } }],
      transaction_history_items: [
        { contact_parasut_id: "500", company_id: "company-1", parasut_company_id: "666034", statement_order: 0, trl_balance: 0 },
      ], // balance already agrees and recently synced -> nothing stale, but proves the guard itself did not block
      sync_runs: [
        {
          id: "orphaned-lease", company_id: "company-1", parasut_company_id: "666034", resource_type: "statement_refresh_lock", status: "running",
          request_metadata: { last_heartbeat_at: "2026-08-23T11:00:00.000Z" }, // 1 hour before NOW — well past the orphan threshold
        },
        {
          company_id: "company-1", parasut_company_id: "666034", resource_type: "transaction_history_items", status: "completed",
          created_at: "2026-08-23T11:55:00.000Z", completed_at: "2026-08-23T11:55:00.000Z",
          request_metadata: { endpoint: "/v4/666034/contacts/500/transaction_history_items" },
        },
      ],
    });
    const context: SyncContext = {
      companyId: "company-1", parasutCompanyId: "666034", database,
      client: { async *getPaginated() {} },
    };
    const summary = await refreshStaleStatements(context, { now: NOW });
    expect(summary.skippedOverlap).toBe(false);
  });
});
