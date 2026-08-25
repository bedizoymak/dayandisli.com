import { buildProductionSyncContext } from "./run-parasut-sync-production.ts";
import { syncContactTransactionHistory } from "../server/parasut/sync-transaction-history.ts";
import { pathToFileURL } from "node:url";

// Targeted transaction-history backfill for OPERATOR use. The contact list
// is ALWAYS explicit (PARASUT_HISTORY_CONTACT_IDS) — there is deliberately
// no default allowlist and no remote edge-function mode: the former
// hardcoded four-contact list and its parasut-sync-run backfill action were
// removed on 2026-08-25 so that no sync correctness logic depends on known
// customer ids. Per-contact refresh through the authenticated ERP is
// available via parasut-write-api's admin-gated "resync" action instead.
export async function runTargetHistoryBackfill(env: Record<string, string | undefined> = process.env) {
  if (env.RUN_PARASUT_HISTORY_BACKFILL !== "1") throw new Error("Refusing to run: RUN_PARASUT_HISTORY_BACKFILL=1 is required.");
  const requested = (env.PARASUT_HISTORY_CONTACT_IDS ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  if (!requested.length) throw new Error("PARASUT_HISTORY_CONTACT_IDS is required (comma-separated Paraşüt contact ids).");
  const invalid = requested.filter((id) => !/^\d{1,20}$/.test(id));
  if (invalid.length) throw new Error(`Contact ids must be numeric Paraşüt ids: ${invalid.join(",")}`);
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runTargetHistoryBackfill().then((results) => {
    // Counts only; no payloads, tokens, or business descriptions.
    console.log(JSON.stringify(results.map(({ contactId, status, observed, inserted, updated, unchanged, errors }) => ({ contactId, status, observed, inserted, updated, unchanged, errors }))));
  }).catch((error) => { console.error((error as Error).message); process.exitCode = 1; });
}
