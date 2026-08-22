import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

export const TRANSACTION_HISTORY_INCLUDE = [
  "transaction.sales_invoice",
  "transaction.purchase_bill",
  "transaction.reimbursement_purchase_bill",
  "transaction.opening_balance",
  "transaction.check",
  "transaction.contact_transfer",
];

export function syncContactTransactionHistory(
  context: SyncContext,
  contactParasutId: string,
  options: { concurrencyLock?: boolean } = {},
): Promise<SyncResult> {
  if (!/^\d+$/.test(contactParasutId)) throw new Error("Invalid Paraşüt contact id");
  const contactRef = { data: { type: "contacts", id: contactParasutId } };
  const scopedContext: SyncContext = {
    ...context,
    client: {
      async *getPaginated(path, include, startPage) {
        for await (const page of context.client.getPaginated(path, include, startPage)) {
          const data = Array.isArray(page.document.data)
            ? page.document.data.map((item) => ({
              ...item,
              relationships: { ...(item.relationships ?? {}), contact: contactRef },
            }))
            : page.document.data;
          const included = (page.document.included ?? []).map((item) =>
            item.type === "transactions" || item.type === "opening_balances"
              ? { ...item, relationships: { ...(item.relationships ?? {}), contact: contactRef } }
              : item
          );
          yield { ...page, document: { ...page.document, data, included } };
        }
      },
    },
  };
  return syncCollection(scopedContext, {
    resourceType: "transaction_history_items",
    table: "transaction_history_items",
    endpoint: `/v4/${encodeURIComponent(context.parasutCompanyId)}/contacts/${encodeURIComponent(contactParasutId)}/transaction_history_items`,
    include: TRANSACTION_HISTORY_INCLUDE,
    numericAttributeFields: ["trl_balance", "usd_balance", "eur_balance", "gbp_balance"],
    maxPagesPerInvocation: 20,
    concurrencyLock: options.concurrencyLock,
  });
}

export const RECONCILIATION_TARGET_CONTACT_IDS = ["1011029161", "1010743830", "1011029140", "1068984956"] as const;
