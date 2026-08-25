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
import { RECONCILIATION_TARGET_CONTACT_IDS, syncContactTransactionHistory } from "../../../server/parasut/sync-transaction-history.ts";
import { refreshStaleStatements, DEFAULT_ALERT_AFTER_HOURS } from "../../../server/parasut/sync-statement-staleness.ts";
import type { MirrorDatabase, SyncContext, SyncResult } from "../../../server/parasut/types.ts";
import { SyncAlreadyRunningError } from "../../../server/parasut/types.ts";

const APPROVED_ERP_COMPANY_ID = "54b50745-89e0-4b97-adb6-4f2426fa2a2f";
const APPROVED_PARASUT_COMPANY_ID = "666034";
const MAX_CONSECUTIVE_RESOURCE_ERRORS = 5;
// P0 follow-up (implemented): raising the contact budget on the SHARED
// 5-minute invocation (accounts/contacts/products/invoices/bills/checks)
// added enough wall-clock time that consecutive ticks started overlapping —
// enforceSingleRunner then correctly, but visibly, killed the losing
// invocation's "checks" run (observed live: failures at 12:56:02 and
// 12:57:11 UTC on 2026-08-23, immediately after raising to 10). Rather than
// keep the budget at a safe-but-slow 1/tick (~36h to clear the ~430-contact
// never-synced backlog, during which ~98% of statements are correctly but
// unacceptably blocked from printing by the P1 fix), the statement-refresh
// step now runs on its OWN separate cron schedule/action
// ("statement-refresh", see the migration adding its own pg_cron job) with
// its own budget, entirely decoupled from the six-resource loop — it can
// never extend that loop's cycle time regardless of its own budget size.
const STATEMENT_REFRESH_MAX_PAGES = 20;
const STATEMENT_REFRESH_MAX_CONTACTS = 5;

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

// EMERGENCY PAUSE (2026-08-24 production incident — see
// CLAUDE_CODE_PRODUCTION_SYNC_INCIDENT_REPORT.md): fail-safe default is
// PAUSED — any value other than the literal string "false" for
// PARASUT_SYNC_EMERGENCY_PAUSE keeps every sync/statement-refresh/backfill
// action (scheduled cron, the manual "Sync" button, and the CLI backfill
// runner all funnel through this one entrypoint) from doing any Paraşüt or
// database work at all. This is deliberately checked before any other
// work — before env/secret loading, before the Supabase client is created,
// before a single Paraşüt or Postgres request is made — so it stays
// effective even if the underlying database is itself under load. Re-enable
// by setting the PARASUT_SYNC_EMERGENCY_PAUSE secret to "false" (no redeploy
// required); the unset/default state is always safe (paused).
serve(async (req: Request) => {
  try {
    const emergencyPause = (Deno.env.get("PARASUT_SYNC_EMERGENCY_PAUSE") ?? "true") !== "false";
    if (emergencyPause) {
      console.log("[sync] EMERGENCY PAUSE active — refusing to run. Set PARASUT_SYNC_EMERGENCY_PAUSE=false to resume.");
      return new Response(
        JSON.stringify({ status: "paused", reason: "emergency_pause_active" }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

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

    const body = await req.json().catch(() => ({})) as { action?: unknown };
    if (body.action === "statement-refresh") {
      // Runs on its own cron schedule (see the migration adding
      // parasut-sync-run-statement-refresh-every-minute), never inside the
      // shared six-resource loop — its budget can be sized independently
      // without risking the overlap regression above.
      const statementRefresh = await refreshStaleStatements(context, {
        maxPagesPerInvocation: STATEMENT_REFRESH_MAX_PAGES,
        maxContactsPerInvocation: STATEMENT_REFRESH_MAX_CONTACTS,
      });
      if (statementRefresh.skippedOverlap) {
        // Whole-invocation overlap guard fired — a prior statement-refresh
        // run was still in flight, so this tick did nothing at all rather
        // than risk contending for the shared Paraşüt rate-limit budget.
        // Logged explicitly so a run stuck long enough to cause repeated
        // skips is visible, not silent.
        logSafe(`[statement-refresh] skipped: a prior invocation is still in flight (overlap guard)`);
      } else {
        logSafe(
          `[statement-refresh] stale=${statementRefresh.staleCount} oldest_stale_hours=${statementRefresh.oldestStaleHours.toFixed(1)} ` +
            `touched=${statementRefresh.contactsTouched.length} completed=${statementRefresh.completed.length} ` +
            `partial=${statementRefresh.partial.length} failed=${statementRefresh.failed.length} pages=${statementRefresh.pagesUsed}`,
        );
      }
      if (statementRefresh.alert) {
        // Item 5: no external alerting pipeline exists in this repo — a
        // greppable [ALERT]-prefixed structured log line is the same
        // observability convention already used throughout this codebase
        // (logSafe), not an invented new mechanism.
        logSafe(
          `[ALERT] statement staleness exceeded the sweep-interval threshold: ${statementRefresh.staleCount} contacts stale, ` +
            `oldest ${statementRefresh.oldestStaleHours.toFixed(1)}h (threshold ${DEFAULT_ALERT_AFTER_HOURS}h) — the statement-refresh step may be stuck or under-budgeted.`,
        );
      }
      return new Response(JSON.stringify({ statementRefresh }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (body.action === "authoritative-history-backfill") {
      const results: Array<SyncResult & { contactId: string }> = [];
      for (const contactId of RECONCILIATION_TARGET_CONTACT_IDS) {
        let result = await syncContactTransactionHistory(context, contactId, { concurrencyLock: true });
        results.push({ contactId, ...result });
        while (result.hasMore) {
          result = await syncContactTransactionHistory(context, contactId, { concurrencyLock: true });
          results.push({ contactId, ...result });
        }
      }
      return new Response(JSON.stringify({ scope: [...RECONCILIATION_TARGET_CONTACT_IDS], results }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    logSafe(`[sync] companyId=${companyId} parasutCompanyId=${parasutCompanyId} triggerType=${triggerType ?? "local_manual"}`);

    const results: SyncResult[] = [];
    // PHASE 1A remediation: per-resource failure isolation. Previously ANY
    // thrown error here (including a benign SyncAlreadyRunningError election
    // loss) aborted the whole invocation with a 500, starving every later
    // resource in RESOURCE_ORDER for that tick — and a chronically failing
    // resource (errors > MAX_CONSECUTIVE_RESOURCE_ERRORS) starved the rest
    // of the loop on EVERY tick. Now: one resource's failure is contained,
    // logged with [ALERT], and the remaining resources still run. Total
    // Paraşüt load stays bounded by each resource's own page budget plus
    // sync-base.ts retry governance; liveness of unrelated resources no
    // longer depends on the health of the worst one.
    const degraded: string[] = [];
    for (const resource of RESOURCE_ORDER) {
      logSafe(`[sync] starting ${resource.name}`);
      try {
        // concurrencyLock: true reuses sync-base.ts's existing enforceSingleRunner
        // election (already implemented/tested for the manual "Sync" button path) —
        // the smallest guard against two overlapping scheduled invocations
        // (or a scheduled + manual invocation) racing on the same resource's
        // resume chain. No new locking mechanism introduced.
        const result = await resource.run(context, { concurrencyLock: true });
        results.push(result);
        if (result.status === "circuit_open") {
          // Retry governance refused this attempt (zero side effects):
          // a poisoned resume chain is waiting out its backoff window.
          logSafe(
            `[sync] ${resource.name} skipped — retry-governance circuit open until ${result.circuitOpenUntil ?? "?"} ` +
              `(zero-progress backoff after repeated identical failures)`,
          );
          continue;
        }
        logSafe(
          `[sync] ${resource.name} ${result.status} — pages=${result.pages} observed=${result.observed} ` +
            `inserted=${result.inserted} updated=${result.updated} unchanged=${result.unchanged} errors=${result.errors}`,
        );
        if (result.errors > MAX_CONSECUTIVE_RESOURCE_ERRORS) {
          degraded.push(`${resource.name}: ${result.errors} errors`);
          logSafe(
            `[ALERT] [sync] ${resource.name} recorded ${result.errors} errors, exceeding the ` +
              `${MAX_CONSECUTIVE_RESOURCE_ERRORS} threshold — remaining resources continue; ` +
              `retry governance will throttle this one if it keeps making no progress.`,
          );
        }
      } catch (error) {
        if (error instanceof SyncAlreadyRunningError) {
          // Benign FIFO-election loss to an older still-running invocation:
          // zero work was done. Skip quietly and let the winner proceed —
          // this must NOT fail the invocation or block later resources.
          logSafe(`[sync] ${resource.name} superseded — another invocation for this resource is active`);
          continue;
        }
        degraded.push(resource.name);
        console.error(`🔥 [sync] ${resource.name} failed:`, (error as Error).message);
      }
    }

    if (degraded.length > 0) {
      logSafe(`[ALERT] [sync] degraded resources this invocation: ${degraded.join("; ")}`);
    }
    logSafe(`[sync] all resources completed: ${results.map((r) => `${r.resourceType}=${r.status}`).join(", ")}`);

    return new Response(
      JSON.stringify({ results, degraded }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    console.error("🔥 SYNC ERROR:", (err as Error).message);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
