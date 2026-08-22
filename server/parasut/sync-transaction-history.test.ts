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

  it("hydrates included payment-to-transaction relationships from the authoritative transaction envelope", async () => {
    const client = {
      async *getPaginated() {
        yield {
          pageNumber: 1,
          document: {
            data: [{ id: "history-1", type: "transaction_history_items", relationships: {} }],
            included: [
              { id: "transaction-1", type: "transactions", relationships: { payments: { data: [{ id: "payment-1", type: "payments" }] } } },
              { id: "payment-1", type: "payments", attributes: { amount: "10.00" }, relationships: { transaction: { meta: {} } } },
            ],
          },
        };
      },
    };
    await syncContactTransactionHistory({ parasutCompanyId: "666034", companyId: "erp", client, database: {} } as never, "1011029161");
    const [scopedContext] = syncCollection.mock.calls[0];
    const pages = [];
    for await (const page of scopedContext.client.getPaginated("/history", TRANSACTION_HISTORY_INCLUDE, 1)) pages.push(page);
    const payment = pages[0].document.included.find((item: { type: string }) => item.type === "payments");
    expect(payment.relationships.transaction).toEqual({ data: { type: "transactions", id: "transaction-1" } });
  });
});
