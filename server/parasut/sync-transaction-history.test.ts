import { beforeEach, describe, expect, it, vi } from "vitest";

const { syncCollection } = vi.hoisted(() => ({ syncCollection: vi.fn() }));
vi.mock("./sync-base.ts", () => ({ syncCollection }));

import { RECONCILIATION_TARGET_CONTACT_IDS, syncContactTransactionHistory, TRANSACTION_HISTORY_INCLUDE } from "./sync-transaction-history.ts";

describe("authoritative transaction history sync", () => {
  beforeEach(() => syncCollection.mockReset().mockResolvedValue({ status: "completed" }));

  it("uses the bounded shared engine and the complete authoritative include graph", async () => {
    const client = { getPaginated: vi.fn() };
    const context = { parasutCompanyId: "666034", companyId: "erp", client, database: {} } as never;
    await syncContactTransactionHistory(context, "1011029161", { concurrencyLock: true });
    const [, options] = syncCollection.mock.calls[0];
    expect(options).toMatchObject({
      resourceType: "transaction_history_items",
      table: "transaction_history_items",
      maxPagesPerInvocation: 20,
      concurrencyLock: true,
    });
    expect(options.endpoint).toContain("/contacts/1011029161/transaction_history_items");
    expect(options.include).toEqual(TRANSACTION_HISTORY_INCLUDE);
  });

  it("is scope-confined to safe numeric contact ids", async () => {
    expect(RECONCILIATION_TARGET_CONTACT_IDS).toEqual(["1011029161", "1010743830", "1011029140", "1068984956"]);
    expect(() => syncContactTransactionHistory({ parasutCompanyId: "666034" } as never, "../contacts")).toThrow("Invalid Paraşüt contact id");
  });
});
