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

  it("derives statement order and transaction date from Paraşüt's newest-first page/index arrival — never from the history item id", async () => {
    // Paraşüt returns transaction_history_items newest-first (verified against
    // production: page 1 always carries the most recent movements). Two
    // pages here simulate that: page 1's single item is chronologically
    // LATER (2026-08-22) than page 2's item (2024-01-01, a backdated opening
    // balance) — exactly the PİNO/HİRA/BEKEM shape the sync must reorder to
    // oldest-first without ever consulting the transaction id.
    const client = {
      async *getPaginated() {
        yield {
          pageNumber: 1,
          document: {
            data: [{ id: "999999999", type: "transaction_history_items", relationships: { transaction: { data: { type: "transactions", id: "999999999" } } } }],
            included: [{ id: "999999999", type: "transactions", attributes: { date: "2026-08-22" }, relationships: {} }],
          },
        };
        yield {
          pageNumber: 2,
          document: {
            data: [{ id: "111111111", type: "transaction_history_items", relationships: { transaction: { data: { type: "transactions", id: "111111111" } } } }],
            included: [{ id: "111111111", type: "transactions", attributes: { date: "2024-01-01" }, relationships: {} }],
          },
        };
      },
    };
    await syncContactTransactionHistory({ parasutCompanyId: "666034", companyId: "erp", client, database: {} } as never, "1011029161");
    const [scopedContext] = syncCollection.mock.calls[0];
    const pages = [];
    for await (const page of scopedContext.client.getPaginated("/history", TRANSACTION_HISTORY_INCLUDE, 1)) pages.push(page);

    const page1Item = (pages[0].document.data as { attributes: Record<string, unknown> }[])[0];
    const page2Item = (pages[1].document.data as { attributes: Record<string, unknown> }[])[0];
    expect(page1Item.attributes.synthetic_transaction_date).toBe("2026-08-22");
    expect(page2Item.attributes.synthetic_transaction_date).toBe("2024-01-01");
    // Newer arrives first (page 1) but must sort AFTER the backdated item
    // once statement_order is read ascending — so page 1's order value must
    // be the LARGER of the two (0 vs. a very negative page-2 value).
    expect(page1Item.attributes.synthetic_statement_order).toBeGreaterThan(page2Item.attributes.synthetic_statement_order as number);
    expect(page1Item.attributes.synthetic_statement_order).not.toBe(999999999);
    expect(page2Item.attributes.synthetic_statement_order).not.toBe(111111111);
  });

  it("keeps arrival-index-derived ordering stable across resumed invocations (page/index are absolute, not relative to a resume boundary)", async () => {
    const clientAtPage3 = {
      async *getPaginated(_path: string, _include: string[] | undefined, startPage = 1) {
        expect(startPage).toBe(3);
        yield {
          pageNumber: 3,
          document: {
            data: [{ id: "t1", type: "transaction_history_items", relationships: { transaction: { data: { type: "transactions", id: "t1" } } } }],
            included: [{ id: "t1", type: "transactions", attributes: { date: "2025-05-01" }, relationships: {} }],
          },
        };
      },
    };
    await syncContactTransactionHistory({ parasutCompanyId: "666034", companyId: "erp", client: clientAtPage3, database: {} } as never, "1011029161");
    const [scopedContext] = syncCollection.mock.calls[syncCollection.mock.calls.length - 1];
    const pages = [];
    for await (const page of scopedContext.client.getPaginated("/history", TRANSACTION_HISTORY_INCLUDE, 3)) pages.push(page);
    const item = (pages[0].document.data as { attributes: Record<string, unknown> }[])[0];
    // page 3, index 0 → the same arrival index (and thus statement_order)
    // this item would get whether this invocation started at page 1 and
    // resumed, or was handed startPage=3 directly.
    expect(item.attributes.synthetic_statement_order).toBe(-200_000);
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
