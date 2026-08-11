// supabase/functions/parasut-sync-run/index.ts
//
// Repaired to reuse the existing, already-tested sync engine in
// ../../../server/parasut/*.ts (TokenManager, ParaşütClient, sync-*.ts,
// company-identity-contract.ts) instead of the dead hand-rolled sync that
// previously wrote to nonexistent public.parasut_contacts/products/invoices
// tables. Writes now go to the `parasut` schema, the same schema the
// `parasut_readable` views read from. No new sync engine, no new tables.
import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { TokenManager } from "../../../server/parasut/auth.ts";
import { ParaşütClient } from "../../../server/parasut/client.ts";
import { buildCanonicalCompanyContext } from "../../../server/parasut/company-identity-contract.ts";
import { syncAccounts } from "../../../server/parasut/sync-accounts.ts";
import { syncContacts } from "../../../server/parasut/sync-contacts.ts";
import { syncProducts } from "../../../server/parasut/sync-products.ts";
import { syncSalesInvoices } from "../../../server/parasut/sync-sales-invoices.ts";
import { syncPurchaseBills } from "../../../server/parasut/sync-purchase-bills.ts";
import { syncChecks } from "../../../server/parasut/sync-checks.ts";
import type { MirrorDatabase, SyncContext, SyncResult } from "../../../server/parasut/types.ts";

const APPROVED_ERP_COMPANY_ID = "54b50745-89e0-4b97-adb6-4f2426fa2a2f";
const APPROVED_PARASUT_COMPANY_ID = "666034";
const MAX_CONSECUTIVE_RESOURCE_ERRORS = 5;

interface ResourceRunner {
  name: string;
  run: (context: SyncContext, options?: { concurrencyLock?: boolean }) => Promise<SyncResult>;
}

const RESOURCE_ORDER: ResourceRunner[] = [
  { name: "accounts", run: syncAccounts },
  { name: "contacts", run: syncContacts },
  { name: "products", run: syncProducts },
  { name: "sales_invoices", run: syncSalesInvoices },
  { name: "purchase_bills", run: syncPurchaseBills },
  { name: "checks", run: syncChecks },
];

function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value || !value.trim()) throw new Error(`${name} is required and must not be empty.`);
  return value;
}

function logSafe(message: string): void {
  console.log(message.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]"));
}

serve(async (req: Request) => {
  try {
    if (req.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const env = {
      ERP_COMPANY_ID: Deno.env.get("ERP_COMPANY_ID"),
      PARASUT_COMPANY_ID: Deno.env.get("PARASUT_COMPANY_ID"),
    };
    const { companyId, parasutCompanyId } = buildCanonicalCompanyContext(env);
    if (companyId !== APPROVED_ERP_COMPANY_ID) {
      throw new Error(`ERP_COMPANY_ID mismatch: expected ${APPROVED_ERP_COMPANY_ID}.`);
    }
    if (parasutCompanyId !== APPROVED_PARASUT_COMPANY_ID) {
      throw new Error(`PARASUT_COMPANY_ID mismatch: expected ${APPROVED_PARASUT_COMPANY_ID}.`);
    }

    const clientId = requireEnv("PARASUT_CLIENT_ID");
    const clientSecret = requireEnv("PARASUT_CLIENT_SECRET");
    const username = requireEnv("PARASUT_USERNAME");
    const password = requireEnv("PARASUT_PASSWORD");
    const supabaseUrl = requireEnv("SUPABASE_URL");
    const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

    const tokens = new TokenManager({ clientId, clientSecret, username, password });
    const client = new ParaşütClient(tokens);
    const database = createClient(supabaseUrl, serviceRoleKey) as unknown as MirrorDatabase;

    // pg_cron's scheduled invocation (see the migration adding the cron job)
    // sends this header so sync_runs.trigger_type distinguishes scheduled
    // runs from manual ones — every other caller (manual admin invocation,
    // the local CLI runner) is unaffected and still records "local_manual".
    const triggerType = req.headers.get("X-Sync-Trigger") === "scheduled" ? "scheduled" : undefined;
    const context: SyncContext = { companyId, parasutCompanyId, database, client, triggerType };

    logSafe(`[sync] companyId=${companyId} parasutCompanyId=${parasutCompanyId} triggerType=${triggerType ?? "local_manual"}`);

    const results: SyncResult[] = [];
    for (const resource of RESOURCE_ORDER) {
      logSafe(`[sync] starting ${resource.name}`);
      // concurrencyLock: true reuses sync-base.ts's existing enforceSingleRunner
      // election (already implemented/tested for the manual "Sync" button path) —
      // the smallest guard against two overlapping scheduled invocations
      // (or a scheduled + manual invocation) racing on the same resource's
      // resume chain. No new locking mechanism introduced.
      const result = await resource.run(context, { concurrencyLock: true });
      results.push(result);
      logSafe(
        `[sync] ${resource.name} ${result.status} — pages=${result.pages} observed=${result.observed} ` +
          `inserted=${result.inserted} updated=${result.updated} unchanged=${result.unchanged} errors=${result.errors}`,
      );
      if (result.errors > MAX_CONSECUTIVE_RESOURCE_ERRORS) {
        throw new Error(
          `Stopping: ${resource.name} recorded ${result.errors} errors, exceeding the ${MAX_CONSECUTIVE_RESOURCE_ERRORS} failure threshold.`,
        );
      }
    }

    logSafe(`[sync] all resources completed: ${results.map((r) => `${r.resourceType}=${r.status}`).join(", ")}`);

    return new Response(JSON.stringify({ results }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("🔥 SYNC ERROR:", (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
