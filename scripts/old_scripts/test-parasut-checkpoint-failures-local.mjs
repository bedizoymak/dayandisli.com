import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  assertLocalOnlyEnvironment,
  verifyDatabaseCleanup,
} from "../server/parasut/local-safety.ts";
import {
  advanceCheckpointMetadata,
  initializeCheckpointMetadata,
} from "../server/parasut/sync-checkpoint.ts";

const MARKER = "dayan-local-integration";
const PARASUT_COMPANY_ID = "local-checkpoint-failure";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeError(error) {
  if (!error || typeof error !== "object") return "Unknown local database error";
  return [error.code, error.message, error.hint].filter(Boolean).join(" | ");
}

function localStatus() {
  const output = execFileSync("supabase", ["status", "-o", "json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  return JSON.parse(output);
}

async function countRows(client, table, ids) {
  if (ids.length === 0) return 0;
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .in("id", ids);
  if (error) throw new Error(`cleanup count failed: ${safeError(error)}`);
  return count ?? 0;
}

async function cleanup(client, created) {
  if (created.syncRunIds.length > 0) {
    const { error } = await client
      .from("parasut_sync_runs")
      .delete()
      .in("id", created.syncRunIds);
    if (error) throw new Error(`sync-run cleanup failed: ${safeError(error)}`);
  }
  if (created.companyIds.length > 0) {
    const { error } = await client
      .from("companies")
      .delete()
      .in("id", created.companyIds);
    if (error) throw new Error(`company cleanup failed: ${safeError(error)}`);
  }
}

async function run() {
  const status = localStatus();
  const environment = assertLocalOnlyEnvironment({
    SUPABASE_URL: status.API_URL,
    SUPABASE_ANON_KEY: status.ANON_KEY,
    RUN_LOCAL_DB_TESTS: process.env.RUN_LOCAL_DB_TESTS,
  });
  const client = createClient(environment.supabaseUrl, status.SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  const created = { companyIds: [], syncRunIds: [] };
  let controlledFailureObserved = false;

  try {
    const { data: company, error: companyError } = await client
      .from("companies")
      .insert({
        code: `PF${suffix}`,
        legal_name: `Synthetic Failure ${suffix}`,
      })
      .select("id")
      .single();
    if (companyError) {
      throw new Error(`synthetic company creation failed: ${safeError(companyError)}`);
    }
    created.companyIds.push(company.id);

    const runId = randomUUID();
    const initialMetadata = initializeCheckpointMetadata(
      { marker: MARKER },
      runId,
      {
        resourceType: "contacts",
        endpoint: `/v4/${PARASUT_COMPANY_ID}/contacts`,
        include: [],
        pageSize: 25,
      },
    );
    const pageOneMetadata = advanceCheckpointMetadata(initialMetadata, 1);
    const { error: insertError } = await client.from("parasut_sync_runs").insert({
      id: runId,
      company_id: company.id,
      parasut_company_id: PARASUT_COMPANY_ID,
      resource_type: "contacts",
      trigger_type: "local_failure_test",
      status: "running",
      page_count: 1,
      request_metadata: pageOneMetadata,
    });
    if (insertError) throw new Error(`sync-run creation failed: ${safeError(insertError)}`);
    created.syncRunIds.push(runId);

    const rejectedCheckpoint = await client
      .from("parasut_sync_runs")
      .update({ request_metadata: [] })
      .eq("id", runId);
    assert(rejectedCheckpoint.error, "invalid checkpoint write unexpectedly succeeded");

    const { data: preserved, error: preservedError } = await client
      .from("parasut_sync_runs")
      .select("request_metadata")
      .eq("id", runId)
      .single();
    if (preservedError) {
      throw new Error(`checkpoint verification failed: ${safeError(preservedError)}`);
    }
    assert(
      preserved.request_metadata.resume?.last_completed_page === 1,
      "checkpoint failure changed the previous checkpoint",
    );
    console.log("PASS: checkpoint failure preserved the previous checkpoint");

    const completedAt = new Date().toISOString();
    const { data: failedRun, error: finalizationError } = await client
      .from("parasut_sync_runs")
      .update({
        status: "failed",
        completed_at: completedAt,
        error_count: 1,
      })
      .eq("id", runId)
      .select("status,request_metadata")
      .single();
    if (finalizationError) {
      throw new Error(`failed-run finalization failed: ${safeError(finalizationError)}`);
    }
    assert(
      failedRun.status === "failed" &&
        failedRun.request_metadata.resume?.last_completed_page === 1,
      "failed-run finalization did not preserve checkpoint state",
    );
    console.log("PASS: failed-run finalization persisted status=failed");

    try {
      throw new Error("controlled assertion failure");
    } catch (error) {
      controlledFailureObserved =
        error instanceof Error && error.message === "controlled assertion failure";
    }
    assert(controlledFailureObserved, "controlled failure was not observed");
  } finally {
    await cleanup(client, created);
    await cleanup(client, created);
    verifyDatabaseCleanup({
      parasut_sync_runs: await countRows(
        client,
        "parasut_sync_runs",
        created.syncRunIds,
      ),
      companies: await countRows(client, "companies", created.companyIds),
    });
    console.log("PASS: repeated cleanup is idempotent and removed all synthetic rows");
  }
}

try {
  await run();
} catch (error) {
  console.error(
    `Local checkpoint failure integration refused or failed: ${
      error instanceof Error ? error.message : "unexpected integration failure"
    }`,
  );
  process.exitCode = 1;
}

