import { buildProductionSyncContext } from "./run-parasut-sync-production.ts";
import { RECONCILIATION_TARGET_CONTACT_IDS, syncContactTransactionHistory } from "../server/parasut/sync-transaction-history.ts";
import { pathToFileURL } from "node:url";

export async function runTargetHistoryBackfill(env: Record<string, string | undefined> = process.env) {
  if (env.RUN_PARASUT_HISTORY_BACKFILL !== "1") throw new Error("Refusing to run: RUN_PARASUT_HISTORY_BACKFILL=1 is required.");
  const requested = (env.PARASUT_HISTORY_CONTACT_IDS ?? RECONCILIATION_TARGET_CONTACT_IDS.join(",")).split(",").map((id) => id.trim()).filter(Boolean);
  const disallowed = requested.filter((id) => !RECONCILIATION_TARGET_CONTACT_IDS.includes(id as typeof RECONCILIATION_TARGET_CONTACT_IDS[number]));
  if (disallowed.length) throw new Error(`Contact scope is not approved: ${disallowed.join(",")}`);
  if (!env.SUPABASE_SERVICE_ROLE_KEY) {
    const url = env.VITE_SUPABASE_URL;
    const key = env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are required for the remote guarded backfill.");
    if (!url.includes("meauutjsnnggzcigyvfp")) throw new Error("Supabase production target mismatch.");
    const response = await fetch(`${url}/functions/v1/parasut-sync-run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ action: "authoritative-history-backfill" }),
    });
    if (!response.ok) throw new Error(`Remote history backfill failed with HTTP ${response.status}`);
    return (await response.json()).results;
  }
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
