// Minimal production-safe Paraşüt sync runner. Sequences existing
// server/parasut/*.ts modules — no new sync engine. GET-only toward Paraşüt;
// upsert-only toward the mirror; insert/update-only toward sync_runs/sync_errors.
import { createClient } from "@supabase/supabase-js";
import { TokenManager } from "../server/parasut/auth.ts";
import { ParaşütClient } from "../server/parasut/client.ts";
import { buildCanonicalCompanyContext } from "../server/parasut/company-identity-contract.ts";
import { syncAccounts } from "../server/parasut/sync-accounts.ts";
import { syncContacts } from "../server/parasut/sync-contacts.ts";
import { syncProducts } from "../server/parasut/sync-products.ts";
import { syncSalesInvoices } from "../server/parasut/sync-sales-invoices.ts";
import { syncPurchaseBills } from "../server/parasut/sync-purchase-bills.ts";
import type { MirrorDatabase, SyncContext, SyncResult } from "../server/parasut/types.ts";

const APPROVED_ERP_COMPANY_ID = "54b50745-89e0-4b97-adb6-4f2426fa2a2f";
const APPROVED_PARASUT_COMPANY_ID = "666034";
const APPROVED_PROJECT_REF = "meauutjsnnggzcigyvfp";
const MAX_CONSECUTIVE_RESOURCE_ERRORS = 5;

function requireEnv(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (!value || !value.trim()) throw new Error(`${name} is required and must not be empty.`);
  return value;
}

function assertProductionGuard(env: Record<string, string | undefined>): void {
  if (env.RUN_PARASUT_SYNC_PRODUCTION !== "1") {
    throw new Error("Refusing to run: RUN_PARASUT_SYNC_PRODUCTION=1 execution guard is not set.");
  }
}

function assertApprovedIdentifiers(companyId: string, parasutCompanyId: string): void {
  if (companyId !== APPROVED_ERP_COMPANY_ID) {
    throw new Error(`ERP_COMPANY_ID mismatch: expected ${APPROVED_ERP_COMPANY_ID}.`);
  }
  if (parasutCompanyId !== APPROVED_PARASUT_COMPANY_ID) {
    throw new Error(`PARASUT_COMPANY_ID mismatch: expected ${APPROVED_PARASUT_COMPANY_ID}.`);
  }
}

function assertProductionTarget(supabaseUrl: string): void {
  if (!supabaseUrl.includes(APPROVED_PROJECT_REF)) {
    throw new Error(`Supabase target mismatch: expected project ref ${APPROVED_PROJECT_REF}.`);
  }
}

export function buildProductionSyncContext(env: Record<string, string | undefined>): {
  context: SyncContext;
  supabaseUrl: string;
} {
  assertProductionGuard(env);

  const { companyId, parasutCompanyId } = buildCanonicalCompanyContext(env);
  assertApprovedIdentifiers(companyId, parasutCompanyId);

  const clientId = requireEnv(env, "PARASUT_CLIENT_ID");
  const clientSecret = requireEnv(env, "PARASUT_CLIENT_SECRET");
  const username = requireEnv(env, "PARASUT_USERNAME");
  const password = requireEnv(env, "PARASUT_PASSWORD");
  const supabaseUrl = requireEnv(env, "SUPABASE_URL");
  const serviceRoleKey = requireEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  assertProductionTarget(supabaseUrl);

  const tokens = new TokenManager({ clientId, clientSecret, username, password });
  // ParaşütClient.get() only ever issues GET requests (see client.ts) — no
  // write-capable method exists on this class, so no runtime guard can be
  // bypassed here even accidentally.
  const client = new ParaşütClient(tokens);
  const database = createClient(supabaseUrl, serviceRoleKey) as unknown as MirrorDatabase;

  return {
    context: { companyId, parasutCompanyId, database, client },
    supabaseUrl,
  };
}

interface ResourceRunner {
  name: string;
  run: (context: SyncContext) => Promise<SyncResult>;
}

const RESOURCE_ORDER: ResourceRunner[] = [
  { name: "accounts", run: syncAccounts },
  { name: "contacts", run: syncContacts },
  { name: "products", run: syncProducts },
  { name: "sales_invoices", run: syncSalesInvoices },
  { name: "purchase_bills", run: syncPurchaseBills },
];

function logSafe(message: string): void {
  // eslint-disable-next-line no-console
  console.log(message.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]"));
}

export async function runProductionSync(context: SyncContext): Promise<SyncResult[]> {
  const results: SyncResult[] = [];
  for (const resource of RESOURCE_ORDER) {
    const startedAt = new Date().toISOString();
    logSafe(`[sync] starting ${resource.name} at ${startedAt}`);
    let result: SyncResult;
    try {
      result = await resource.run(context);
    } catch (error) {
      logSafe(`[sync] ${resource.name} failed structurally: ${(error as Error).message}`);
      throw error;
    }
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
  return results;
}

export async function main(): Promise<void> {
  const { context, supabaseUrl } = buildProductionSyncContext(process.env);
  logSafe(`[sync] target project verified (${supabaseUrl.replace(/\/\/.*@/, "//[redacted]@")})`);
  logSafe(`[sync] companyId=${context.companyId} parasutCompanyId=${context.parasutCompanyId}`);
  const results = await runProductionSync(context);
  logSafe(`[sync] all resources completed: ${results.map((r) => `${r.resourceType}=${r.status}`).join(", ")}`);
}
