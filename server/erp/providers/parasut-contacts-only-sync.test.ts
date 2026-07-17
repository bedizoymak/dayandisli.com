import { describe, expect, it } from "vitest";
import { ParasutContactsOnlySync, type MirrorContactLookup } from "./parasut-contacts-only-sync.ts";
import type { MirrorDatabase, QueryBuilder, SyncContext } from "../../parasut/types.ts";

/** Minimal fake MirrorDatabase — every chain resolves successfully with no data, enough for syncContacts() to complete a run with zero observed rows (this test only cares that syncAndCheck calls syncContacts and then the lookup, not sync-engine behavior itself — that's covered by server/parasut/sync-engine.test.ts). */
function makeFakeDatabase(): MirrorDatabase {
  function chain<T>(): QueryBuilder<T> {
    const result = { data: { id: "run-1" } as unknown as T, error: null };
    const builder: QueryBuilder<T> = {
      select: () => builder,
      eq: () => builder,
      maybeSingle: async () => result,
      single: async () => result,
      then: (onFulfilled) => Promise.resolve(result).then(onFulfilled as never),
    } as QueryBuilder<T>;
    return builder;
  }
  const database: MirrorDatabase = {
    schema: () => database,
    from: () => ({
      insert: () => chain(),
      update: () => chain(),
      select: () => chain(),
    }),
  };
  return database;
}

describe("ParasutContactsOnlySync.syncAndCheck", () => {
  it("runs the existing contacts-only sync function and then checks the mirror lookup for the provider id", async () => {
    let syncContextRequested: { companyId: string; providerCompanyId: string } | null = null;
    const buildSyncContext = (companyId: string, providerCompanyId: string): SyncContext => {
      syncContextRequested = { companyId, providerCompanyId };
      return {
        companyId,
        parasutCompanyId: providerCompanyId,
        database: makeFakeDatabase(),
        client: {
          async *getPaginated() {
            // Empty — no pages, matching this test's focus on wiring, not sync-engine pagination (already covered elsewhere).
          },
        },
      };
    };

    let lookupArgs: { companyId: string; parasutId: string } | null = null;
    const lookup: MirrorContactLookup = {
      existsByParasutId: async (companyId, parasutId) => {
        lookupArgs = { companyId, parasutId };
        return true;
      },
    };

    const sync = new ParasutContactsOnlySync(buildSyncContext, lookup);
    const found = await sync.syncAndCheck("54b50745-89e0-4b97-adb6-4f2426fa2a2f", "666034", "1010699999");

    expect(found).toBe(true);
    expect(syncContextRequested).toEqual({ companyId: "54b50745-89e0-4b97-adb6-4f2426fa2a2f", providerCompanyId: "666034" });
    expect(lookupArgs).toEqual({ companyId: "54b50745-89e0-4b97-adb6-4f2426fa2a2f", parasutId: "1010699999" });
  });

  it("returns false when the lookup reports the id is not present after sync", async () => {
    const buildSyncContext = (companyId: string, providerCompanyId: string): SyncContext => ({
      companyId,
      parasutCompanyId: providerCompanyId,
      database: makeFakeDatabase(),
      client: { async *getPaginated() {} },
    });
    const lookup: MirrorContactLookup = { existsByParasutId: async () => false };

    const sync = new ParasutContactsOnlySync(buildSyncContext, lookup);
    expect(await sync.syncAndCheck("company-1", "666034", "missing-id")).toBe(false);
  });
});
