import { describe, expect, it } from "vitest";
import { upsertResource } from "./upsert-resource.ts";
import type { JsonApiResource, MirrorDatabase } from "./types.ts";

/**
 * Guards the D-A fix: statement_order/transaction_date on
 * parasut.transaction_history_items must come from the sync layer's
 * page/index-derived synthetic_statement_order and the linked transaction's
 * real synthetic_transaction_date (see sync-transaction-history.ts) — never
 * from the history item's own id, which structurally equals the linked
 * transaction's id and is therefore never a valid chronological proxy.
 */
describe("upsertResource — authoritative statement ordering columns", () => {
  function fakeInsertDatabase(captured: { inserted: Record<string, unknown> | null }): MirrorDatabase {
    return {
      schema() {
        return this;
      },
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: null, error: null }),
          insert(value: Record<string, unknown>) {
            captured.inserted = value;
            return this;
          },
          update() {
            return this;
          },
          then(resolve: (value: unknown) => unknown) {
            return Promise.resolve(resolve({ data: null, error: null }));
          },
        };
      },
    } as unknown as MirrorDatabase;
  }

  it("prefers the sync-injected synthetic_statement_order over the history item id", async () => {
    const resource: JsonApiResource = {
      id: "1113769850", // deliberately equal to the transaction id, as Paraşüt returns it
      type: "transaction_history_items",
      attributes: { synthetic_statement_order: -400_000, synthetic_transaction_date: "2024-01-01" },
      relationships: { transaction: { data: { type: "transactions", id: "1113769850" } } },
    };
    const captured: { inserted: Record<string, unknown> | null } = { inserted: null };
    await upsertResource(
      fakeInsertDatabase(captured),
      { resourceType: "transaction_history_items", table: "transaction_history_items" },
      resource,
      { companyId: "company", parasutCompanyId: "666034", now: new Date("2026-08-22T00:00:00Z") },
    );
    expect(captured.inserted?.statement_order).toBe(-400_000);
    expect(captured.inserted?.statement_order).not.toBe(1113769850);
    expect(captured.inserted?.transaction_date).toBe("2024-01-01");
  });

  it("falls back to order/position/id only when no synthetic ordering was supplied (defensive, non-wrapped callers)", async () => {
    const resource: JsonApiResource = {
      id: "42",
      type: "transaction_history_items",
      attributes: {},
      relationships: {},
    };
    const captured: { inserted: Record<string, unknown> | null } = { inserted: null };
    await upsertResource(
      fakeInsertDatabase(captured),
      { resourceType: "transaction_history_items", table: "transaction_history_items" },
      resource,
      { companyId: "company", parasutCompanyId: "666034", now: new Date("2026-08-22T00:00:00Z") },
    );
    expect(captured.inserted?.statement_order).toBe(42);
    expect(captured.inserted?.transaction_date).toBeNull();
  });

  it("never derives transaction_date from anything other than the sync-supplied date", async () => {
    const resource: JsonApiResource = {
      id: "7",
      type: "transaction_history_items",
      attributes: { synthetic_statement_order: -1, synthetic_transaction_date: null },
      relationships: {},
    };
    const captured: { inserted: Record<string, unknown> | null } = { inserted: null };
    await upsertResource(
      fakeInsertDatabase(captured),
      { resourceType: "transaction_history_items", table: "transaction_history_items" },
      resource,
      { companyId: "company", parasutCompanyId: "666034", now: new Date("2026-08-22T00:00:00Z") },
    );
    expect(captured.inserted?.transaction_date).toBeNull();
  });
});
