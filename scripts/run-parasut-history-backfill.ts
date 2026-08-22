import { buildProductionSyncContext } from "./run-parasut-sync-production.ts";
import { RECONCILIATION_TARGET_CONTACT_IDS, syncContactTransactionHistory } from "../server/parasut/sync-transaction-history.ts";

export async function runTargetHistoryBackfill(env: Record<string, string | undefined> = process.env) {
  if (env.RUN_PARASUT_HISTORY_BACKFILL !== "1") throw new Error("Refusing to run: RUN_PARASUT_HISTORY_BACKFILL=1 is required.");
  const requested = (env.PARASUT_HISTORY_CONTACT_IDS ?? RECONCILIATION_TARGET_CONTACT_IDS.join(",")).split(",").map((id) => id.trim()).filter(Boolean);
  const disallowed = requested.filter((id) => !RECONCILIATION_TARGET_CONTACT_IDS.includes(id as typeof RECONCILIATION_TARGET_CONTACT_IDS[number]));
  if (disallowed.length) throw new Error(`Contact scope is not approved: ${disallowed.join(",")}`);
  const { context } = buildProductionSyncContext(env);
  const results = [];
  for (const id of requested) {
    let result = await syncContactTransactionHistory(context, id, { concurrencyLock: true });
    results.push({ contactId: id, ...result });
    while (result.hasMore) {
      result = await syncContactTransactionHistory(context, id, { concurrencyLock: true });
      results.push({ contactId: id, ...result });
    }
  }
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runTargetHistoryBackfill().then((results) => {
    // Counts only; no payloads, tokens, or business descriptions.
    console.log(JSON.stringify(results.map(({ contactId, status, observed, inserted, updated, unchanged, errors }) => ({ contactId, status, observed, inserted, updated, unchanged, errors }))));
  }).catch((error) => { console.error((error as Error).message); process.exitCode = 1; });
}
