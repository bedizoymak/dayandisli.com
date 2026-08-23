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
import { computeContactStaleness, staleOnly, STALE_SWEEP_HOURS } from "./sync-statement-staleness.ts";
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

  function makeQuery(table: string) {
    const predicates: Array<[string, unknown]> = [];
    const api = {
      select() { return api; },
      eq(column: string, value: unknown) { predicates.push([column, value]); return api; },
      gt() { return api; },
      then(resolve: (value: unknown) => unknown) {
        const rows = tables[table].filter((row) => predicates.every(([col, val]) => row[col] === val));
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
