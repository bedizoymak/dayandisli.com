import { execFileSync } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { TokenManager } from "../server/parasut/auth.ts";
import { ParaşütClient } from "../server/parasut/client.ts";
import { syncAccounts } from "../server/parasut/sync-accounts.ts";
import { syncContacts } from "../server/parasut/sync-contacts.ts";
import { syncProducts } from "../server/parasut/sync-products.ts";
import { syncPurchaseBills } from "../server/parasut/sync-purchase-bills.ts";
import { syncSalesInvoices } from "../server/parasut/sync-sales-invoices.ts";
import { createLocalObservabilitySink } from "../server/parasut/local-observability-sink.ts";
import { sanitizeObservabilityText } from "../server/parasut/sync-observability.ts";
import { createExecutionPlan } from "../server/parasut/sync-execution-plan.ts";
import { composeExecutionResults } from "../server/parasut/execution-result-composition.ts";
import { consumeExecutionResult } from "../server/parasut/execution-result-consumer.ts";
import { createExecutionEnvelopeDiagnostic } from "../server/parasut/execution-envelope-diagnostic.ts";

const PRODUCTION_REF = "meauutjsnnggzcigyvfp";
const PRODUCTION_NAME = "dayandisli.com";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

function fail(message) {
  throw new Error(message);
}

const stdoutWriter = (output) => process.stdout.write(output);

export function createCliOutputChannels(options = {}) {
  return {
    diagnosticWriter: options.diagnosticWriter ?? stdoutWriter,
    reportWriter: options.reportWriter ?? stdoutWriter,
  };
}

export function composeLocalSyncContext(baseContext, options = {}) {
  return {
    ...baseContext,
    observability: createLocalObservabilitySink({
      env: options.env ?? {},
      writeLine: options.diagnosticWriter ?? options.writeLine,
    }),
  };
}

export function formatAggregateReport(report) {
  return `${JSON.stringify({ target: "local", resources: report }, null, 2)}\n`;
}

export async function writeAggregateReport(report, reportWriter) {
  await reportWriter(formatAggregateReport(report));
}

export async function orchestrateLocalExecution(requested, dependencies) {
  const plan = createExecutionPlan(requested);
  const setup = await dependencies.setup(plan);
  const composition = await composeExecutionResults(plan, (resource) =>
    dependencies.executeResource(resource, setup),
  );
  const diagnostic = createExecutionEnvelopeDiagnostic({
    env: dependencies.env ?? {},
    diagnosticWriter: setup?.output?.diagnosticWriter,
  });
  const reports = await consumeExecutionResult(composition, diagnostic);

  return { plan, setup, reports };
}

export function formatCliFailure(error) {
  const message = sanitizeObservabilityText(
    error instanceof Error ? error.message : "unexpected failure",
  ).replace(
    /\b(?:request_metadata|raw_payload)\b\s*[:=]\s*\S+/gi,
    "[REDACTED]",
  );
  return `Local Paraşüt sync refused or failed: ${message}`;
}

function localStatus() {
  return JSON.parse(
    execFileSync("supabase", ["status", "-o", "json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    }),
  );
}

async function loadEnvironment() {
  const toolEnv = path.resolve("tools/parasut/.env");
  const rootEnv = path.resolve(".env");
  try {
    await access(toolEnv);
    config({ path: toolEnv, quiet: true });
  } catch {
    config({ path: rootEnv, quiet: true });
  }
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) fail(`${name} is required`);
  return value;
}

async function countRows(database, table, companyId, parasutCompanyId) {
  const { count, error } = await database
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .eq("parasut_company_id", parasutCompanyId);
  if (error) fail(`Count failed for ${table}: ${error.message}`);
  return count ?? 0;
}

const resources = {
  contacts: {
    table: "parasut_contacts",
    sync: syncContacts,
  },
  products: {
    table: "parasut_products",
    sync: syncProducts,
  },
  sales_invoices: {
    table: "parasut_sales_invoices",
    sync: syncSalesInvoices,
  },
  purchase_bills: {
    table: "parasut_purchase_bills",
    sync: syncPurchaseBills,
  },
  accounts: {
    table: "parasut_accounts",
    sync: syncAccounts,
  },
};

async function run() {
  if (process.env.RUN_PARASUT_SYNC_LOCAL !== "1") {
    fail("set RUN_PARASUT_SYNC_LOCAL=1 to opt in");
  }
  if (
    process.env.SUPABASE_PROJECT_REF === PRODUCTION_REF ||
    process.env.SUPABASE_PROJECT_NAME?.toLowerCase() === PRODUCTION_NAME
  ) {
    fail("production project identifiers are prohibited");
  }

  const execution = await orchestrateLocalExecution(process.argv.slice(2), {
    env: process.env,
    async setup() {
      await loadEnvironment();
      const status = localStatus();
      const apiHost = new URL(status.API_URL).hostname;
      const databaseHost = new URL(status.DB_URL).hostname;
      if (!LOCAL_HOSTS.has(apiHost) || !LOCAL_HOSTS.has(databaseHost)) {
        fail("Supabase API and database targets must both be local");
      }
      if (
        status.API_URL.includes(PRODUCTION_REF) ||
        status.API_URL.toLowerCase().includes(PRODUCTION_NAME)
      ) {
        fail("production target identifiers are prohibited");
      }

      const database = createClient(status.API_URL, status.SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const companyCode =
        process.env.PARASUT_DAYAN_COMPANY_CODE?.trim() || "DAYAN";
      const { data: company, error: companyError } = await database
        .from("companies")
        .select("id,code")
        .eq("code", companyCode)
        .single();
      if (companyError || !company) {
        fail(
          `Local DAYAN company could not be resolved: ${
            companyError?.message ?? "missing"
          }`,
        );
      }

      const parasutCompanyId = required("PARASUT_COMPANY_ID");
      const tokenManager = new TokenManager({
        clientId: required("PARASUT_CLIENT_ID"),
        clientSecret: required("PARASUT_CLIENT_SECRET"),
        username: process.env.PARASUT_USERNAME,
        password: process.env.PARASUT_PASSWORD,
        refreshToken: process.env.PARASUT_REFRESH_TOKEN,
      });
      const client = new ParaşütClient(tokenManager);
      const output = createCliOutputChannels();
      const context = composeLocalSyncContext(
        {
          companyId: company.id,
          parasutCompanyId,
          database,
          client,
        },
        {
          env: process.env,
          diagnosticWriter: output.diagnosticWriter,
        },
      );

      return { company, context, database, output, parasutCompanyId };
    },
    async executeResource(name, setup) {
      const definition = resources[name];
      const before = await countRows(
        setup.database,
        definition.table,
        setup.company.id,
        setup.parasutCompanyId,
      );
      const first = await definition.sync(setup.context);
      const afterFirst = await countRows(
        setup.database,
        definition.table,
        setup.company.id,
        setup.parasutCompanyId,
      );
      const second = await definition.sync(setup.context);
      const afterSecond = await countRows(
        setup.database,
        definition.table,
        setup.company.id,
        setup.parasutCompanyId,
      );

      return {
        resource: name,
        rowsBefore: before,
        rowsAfterFirst: afterFirst,
        rowsAfterSecond: afterSecond,
        firstRun: first,
        secondRun: second,
        idempotent: afterFirst === afterSecond && second.inserted === 0,
        updateDetection: {
          updatedOnSecondRun: second.updated,
          unchangedOnSecondRun: second.unchanged,
        },
      };
    },
  });

  await writeAggregateReport(
    execution.reports,
    execution.setup.output.reportWriter,
  );
}

const isDirectExecution =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  run().catch((error) => {
    console.error(formatCliFailure(error));
    process.exitCode = 1;
  });
}
