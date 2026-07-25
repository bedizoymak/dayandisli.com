import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  assertLocalOnlyEnvironment,
  createSyntheticPayload,
  verifyDatabaseCleanup,
} from "../server/parasut/local-safety.ts";
import {
  advanceCheckpointMetadata,
  initializeCheckpointMetadata,
} from "../server/parasut/sync-checkpoint.ts";
import { recoverStaleRuns } from "../server/parasut/sync-run-recovery.ts";

const MARKER = "dayan-local-integration";
const PARASUT_COMPANY_ID = "local-checkpoint";

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
  const synthetic = createSyntheticPayload(1, "contacts");
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
  const created = {
    companyIds: [],
    syncRunIds: [],
  };

  try {
    const { data: company, error: companyError } = await client
      .from("companies")
      .insert({
        code: `PC${suffix}`,
        legal_name: `Synthetic Checkpoint ${suffix}`,
      })
      .select("id")
      .single();
    if (companyError) {
      throw new Error(`synthetic company creation failed: ${safeError(companyError)}`);
    }
    created.companyIds.push(company.id);

    const runId = randomUUID();
    const initialMetadata = initializeCheckpointMetadata(
      {
        marker: MARKER,
        synthetic,
      },
      runId,
      {
        resourceType: "contacts",
        endpoint: `/v4/${PARASUT_COMPANY_ID}/contacts`,
        include: [],
        pageSize: 25,
      },
    );
    const { data: run, error: runError } = await client
      .from("parasut_sync_runs")
      .insert({
        id: runId,
        company_id: company.id,
        parasut_company_id: PARASUT_COMPANY_ID,
        resource_type: "contacts",
        trigger_type: "local_integration",
        status: "running",
        request_metadata: initialMetadata,
      })
      .select("id,request_metadata")
      .single();
    if (runError) throw new Error(`sync-run creation failed: ${safeError(runError)}`);
    created.syncRunIds.push(run.id);
    assert(
      run.request_metadata.resume?.last_completed_page === 0 &&
        run.request_metadata.resume?.source_run_id === runId,
      "sync-run creation did not persist initialized resume metadata",
    );
    console.log("PASS: sync-run creation persisted resume metadata");

    const pageOneMetadata = advanceCheckpointMetadata(run.request_metadata, 1);
    const { data: checkpointed, error: checkpointError } = await client
      .from("parasut_sync_runs")
      .update({
        page_count: 1,
        request_metadata: pageOneMetadata,
      })
      .eq("id", runId)
      .select("request_metadata")
      .single();
    if (checkpointError) {
      throw new Error(`checkpoint persistence failed: ${safeError(checkpointError)}`);
    }
    assert(
      checkpointed.request_metadata.resume?.last_completed_page === 1,
      "last_completed_page was not persisted",
    );
    console.log("PASS: completed page checkpoint persisted");

    const { data: afterFailedPage, error: failedPageError } = await client
      .from("parasut_sync_runs")
      .select("request_metadata")
      .eq("id", runId)
      .single();
    if (failedPageError) {
      throw new Error(`failed-page verification failed: ${safeError(failedPageError)}`);
    }
    assert(
      afterFailedPage.request_metadata.resume?.last_completed_page === 1,
      "simulated failed page advanced the checkpoint",
    );
    console.log("PASS: failed page left the checkpoint unchanged");

    const staleRunId = randomUUID();
    const staleMetadata = initializeCheckpointMetadata(
      { marker: MARKER },
      staleRunId,
      {
        resourceType: "contacts",
        endpoint: `/v4/${PARASUT_COMPANY_ID}/contacts`,
        include: [],
        pageSize: 25,
      },
    );
    const staleStartedAt = "2026-01-01T00:00:00.000Z";
    const { error: staleInsertError } = await client
      .from("parasut_sync_runs")
      .insert({
        id: staleRunId,
        company_id: company.id,
        parasut_company_id: PARASUT_COMPANY_ID,
        resource_type: "contacts",
        trigger_type: "local_integration",
        status: "running",
        started_at: staleStartedAt,
        created_at: staleStartedAt,
        page_count: 0,
        request_metadata: staleMetadata,
      });
    if (staleInsertError) {
      throw new Error(`stale sync-run creation failed: ${safeError(staleInsertError)}`);
    }
    created.syncRunIds.push(staleRunId);

    const recovery = await recoverStaleRuns(client, {
      now: new Date("2026-01-01T01:00:00.000Z"),
      thresholdMinutes: 30,
      companyId: company.id,
      parasutCompanyId: PARASUT_COMPANY_ID,
    });
    assert(
      recovery.recoveredRunIds.includes(staleRunId),
      "stale sync run was not recovered",
    );
    const { data: recovered, error: recoveredError } = await client
      .from("parasut_sync_runs")
      .select("status,request_metadata")
      .eq("id", staleRunId)
      .single();
    if (recoveredError) {
      throw new Error(`stale recovery verification failed: ${safeError(recoveredError)}`);
    }
    assert(recovered.status === "failed", "recovered run status is not failed");
    assert(
      recovered.request_metadata.resume?.source_run_id === staleRunId &&
        recovered.request_metadata.resume?.resource_type === "contacts",
      "stale recovery did not preserve compatible resume metadata",
    );
    console.log("PASS: stale-run recovery preserved resume metadata");
  } finally {
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

    const remainingRows = {
      parasut_sync_runs: await countRows(
        client,
        "parasut_sync_runs",
        created.syncRunIds,
      ),
      companies: await countRows(client, "companies", created.companyIds),
    };
    verifyDatabaseCleanup(remainingRows);
    console.log("PASS: cleanup removed all synthetic rows");
  }
}

try {
  await run();
} catch (error) {
  console.error(
    `Local checkpoint integration refused or failed: ${
      error instanceof Error ? error.message : "unexpected integration failure"
    }`,
  );
  process.exitCode = 1;
}

