import { syncCollection } from "./sync-base.ts";
import type { SyncContext, SyncResult } from "./types.ts";

export const TRANSACTION_HISTORY_INCLUDE = [
  "transaction.sales_invoice",
  "transaction.purchase_bill",
  "transaction.reimbursement_purchase_bill",
  "transaction.opening_balance",
  "transaction.check",
  "transaction.contact_transfer",
  "transaction.payments",
];

/**
 * Paraşüt's transaction_history_items endpoint returns rows newest-first
 * (verified empirically against production: for all 159 already-synced rows
 * across the 4 reconciliation-target contacts, the page/array arrival order
 * is the exact reverse of the linked transaction's chronological date). This
 * stride converts each item's absolute (page, index-in-page) position into a
 * single monotonic "arrival index" that is then negated so that ascending
 * `statement_order` yields oldest-first display — never derived from the
 * transaction id or from calendar date, per the reconciliation master
 * prompt's ordering rules. 100000 is far larger than any plausible per-page
 * item count, so the exact real page size never matters for correctness.
 */
const ARRIVAL_PAGE_STRIDE = 100_000;

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
          const paymentTransactions = new Map<string, string>();
          const transactionDateById = new Map<string, string | null>();
          for (const item of page.document.included ?? []) {
            if (item.type !== "transactions") continue;
            transactionDateById.set(item.id, typeof item.attributes?.date === "string" ? item.attributes.date : null);
            const payments = (item.relationships?.payments as { data?: { id?: unknown }[] } | undefined)?.data;
            for (const payment of Array.isArray(payments) ? payments : []) {
              if (typeof payment.id === "string") paymentTransactions.set(payment.id, item.id);
            }
          }
          const data = Array.isArray(page.document.data)
            ? page.document.data.map((item, indexInPage) => {
              const transactionId = (item.relationships?.transaction as { data?: { id?: unknown } } | undefined)?.data?.id;
              const linkedDate = typeof transactionId === "string" ? transactionDateById.get(transactionId) ?? null : null;
              const arrivalIndex = (page.pageNumber - 1) * ARRIVAL_PAGE_STRIDE + indexInPage;
              return {
                ...item,
                relationships: { ...(item.relationships ?? {}), contact: contactRef },
                attributes: {
                  ...(item.attributes ?? {}),
                  synthetic_statement_order: -arrivalIndex,
                  synthetic_transaction_date: linkedDate,
                },
              };
            })
            : page.document.data;
          const included = (page.document.included ?? []).map((item) => {
            if (item.type === "transactions" || item.type === "opening_balances") {
              return { ...item, relationships: { ...(item.relationships ?? {}), contact: contactRef } };
            }
            const transactionId = item.type === "payments" ? paymentTransactions.get(item.id) : undefined;
            return transactionId
              ? { ...item, relationships: { ...(item.relationships ?? {}), transaction: { data: { type: "transactions", id: transactionId } } } }
              : item;
          });
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
