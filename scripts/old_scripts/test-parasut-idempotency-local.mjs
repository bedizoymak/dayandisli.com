import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import {
  assertLocalOnlyEnvironment,
  verifyDatabaseCleanup,
} from "../server/parasut/local-safety.ts";
import {
  hashResource,
  upsertResource,
} from "../server/parasut/upsert-resource.ts";

const MARKER = "dayan-local-integration";
const PARASUT_COMPANY_ID = "local-idempotency";
const CONTACT_DEFINITION = {
  resourceType: "contacts",
  table: "parasut_contacts",
};
const DETAIL_DEFINITION = {
  resourceType: "sales_invoice_details",
  table: "parasut_sales_invoice_details",
};

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

async function countByExternalId(client, table, externalId) {
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("parasut_company_id", PARASUT_COMPANY_ID)
    .eq("parasut_id", externalId);
  if (error) throw new Error(`row count failed: ${safeError(error)}`);
  return count ?? 0;
}

async function countByIds(client, table, ids) {
  if (ids.length === 0) return 0;
  const { count, error } = await client
    .from(table)
    .select("id", { count: "exact", head: true })
    .in("id", ids);
  if (error) throw new Error(`cleanup count failed: ${safeError(error)}`);
  return count ?? 0;
}

async function readMirrorRow(client, table, externalId) {
  const { data, error } = await client
    .from(table)
    .select("id,parasut_id,payload_hash,attributes,raw_payload")
    .eq("parasut_company_id", PARASUT_COMPANY_ID)
    .eq("parasut_id", externalId)
    .single();
  if (error) throw new Error(`mirror row read failed: ${safeError(error)}`);
  return data;
}

async function createSyncRun(client, companyId, sequence) {
  const id = randomUUID();
  const completedAt = new Date().toISOString();
  const { error } = await client.from("parasut_sync_runs").insert({
    id,
    company_id: companyId,
    parasut_company_id: PARASUT_COMPANY_ID,
    resource_type: "contacts",
    trigger_type: "local_idempotency",
    status: "completed",
    started_at: completedAt,
    completed_at: completedAt,
    page_count: 1,
    records_observed: 2,
    request_metadata: {
      marker: MARKER,
      sequence,
    },
  });
  if (error) throw new Error(`sync-run creation failed: ${safeError(error)}`);
  return id;
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
  const contactId = `synthetic-contact-${suffix}`;
  const detailId = `synthetic-detail-${suffix}`;
  const created = {
    companyIds: [],
    syncRunIds: [],
    contactRowIds: [],
    detailRowIds: [],
  };

  const contact = {
    type: "contacts",
    id: contactId,
    attributes: {
      marker: MARKER,
      synthetic: true,
      version: 1,
    },
    relationships: {
      category: { data: null },
    },
  };
  const reorderedContact = {
    id: contactId,
    type: "contacts",
    relationships: {
      category: { data: null },
    },
    attributes: {
      version: 1,
      synthetic: true,
      marker: MARKER,
    },
  };
  const modifiedContact = {
    ...contact,
    attributes: {
      ...contact.attributes,
      version: 2,
    },
  };
  const detail = {
    type: "sales_invoice_details",
    id: detailId,
    attributes: {
      marker: MARKER,
      synthetic: true,
      quantity: 1,
    },
    relationships: {
      product: { data: null },
    },
  };
  const modifiedDetail = {
    ...detail,
    attributes: {
      ...detail.attributes,
      quantity: 2,
    },
  };

  try {
    const { data: company, error: companyError } = await client
      .from("companies")
      .insert({
        code: `PI${suffix}`,
        legal_name: `Synthetic Idempotency ${suffix}`,
      })
      .select("id")
      .single();
    if (companyError) {
      throw new Error(`synthetic company creation failed: ${safeError(companyError)}`);
    }
    created.companyIds.push(company.id);

    const context = {
      companyId: company.id,
      parasutCompanyId: PARASUT_COMPANY_ID,
      now: new Date("2026-06-14T00:00:00.000Z"),
    };

    created.syncRunIds.push(await createSyncRun(client, company.id, 1));
    const firstContact = await upsertResource(
      client,
      CONTACT_DEFINITION,
      contact,
      context,
    );
    const firstDetail = await upsertResource(
      client,
      DETAIL_DEFINITION,
      detail,
      context,
    );
    assert(firstContact.outcome === "inserted", "first parent write was not inserted");
    assert(firstDetail.outcome === "inserted", "first included write was not inserted");

    const initialContactRow = await readMirrorRow(
      client,
      CONTACT_DEFINITION.table,
      contactId,
    );
    const initialDetailRow = await readMirrorRow(
      client,
      DETAIL_DEFINITION.table,
      detailId,
    );
    created.contactRowIds.push(initialContactRow.id);
    created.detailRowIds.push(initialDetailRow.id);

    created.syncRunIds.push(await createSyncRun(client, company.id, 2));
    const repeatedContact = await upsertResource(
      client,
      CONTACT_DEFINITION,
      reorderedContact,
      { ...context, now: new Date("2026-06-14T00:01:00.000Z") },
    );
    const repeatedDetail = await upsertResource(
      client,
      DETAIL_DEFINITION,
      detail,
      { ...context, now: new Date("2026-06-14T00:01:00.000Z") },
    );
    assert(repeatedContact.outcome === "unchanged", "identical parent was not unchanged");
    assert(repeatedDetail.outcome === "unchanged", "identical included row was not unchanged");
    assert(hashResource(contact) === hashResource(reorderedContact), "canonical hash changed");
    assert(
      (await countByExternalId(client, CONTACT_DEFINITION.table, contactId)) === 1 &&
        (await countByExternalId(client, DETAIL_DEFINITION.table, detailId)) === 1,
      "identical reprocessing created duplicates",
    );
    const repeatedContactRow = await readMirrorRow(
      client,
      CONTACT_DEFINITION.table,
      contactId,
    );
    const repeatedDetailRow = await readMirrorRow(
      client,
      DETAIL_DEFINITION.table,
      detailId,
    );
    assert(
      repeatedContactRow.id === initialContactRow.id &&
        repeatedDetailRow.id === initialDetailRow.id,
      "identical reprocessing changed mirror row identifiers",
    );
    console.log("PASS: identical parent and included payloads are idempotent");

    created.syncRunIds.push(await createSyncRun(client, company.id, 3));
    const updatedContact = await upsertResource(
      client,
      CONTACT_DEFINITION,
      modifiedContact,
      { ...context, now: new Date("2026-06-14T00:02:00.000Z") },
    );
    const updatedDetail = await upsertResource(
      client,
      DETAIL_DEFINITION,
      modifiedDetail,
      { ...context, now: new Date("2026-06-14T00:02:00.000Z") },
    );
    assert(updatedContact.outcome === "updated", "modified parent was not updated");
    assert(updatedDetail.outcome === "updated", "modified included row was not updated");

    const finalContactRow = await readMirrorRow(
      client,
      CONTACT_DEFINITION.table,
      contactId,
    );
    const finalDetailRow = await readMirrorRow(
      client,
      DETAIL_DEFINITION.table,
      detailId,
    );
    assert(finalContactRow.id === initialContactRow.id, "parent row ID changed");
    assert(finalDetailRow.id === initialDetailRow.id, "included row ID changed");
    assert(finalContactRow.parasut_id === contactId, "parent external ID changed");
    assert(finalDetailRow.parasut_id === detailId, "included external ID changed");
    assert(
      finalContactRow.payload_hash === hashResource(modifiedContact) &&
        finalContactRow.payload_hash !== initialContactRow.payload_hash,
      "parent hash update was not deterministic",
    );
    assert(
      finalDetailRow.payload_hash === hashResource(modifiedDetail) &&
        finalDetailRow.payload_hash !== initialDetailRow.payload_hash,
      "included hash update was not deterministic",
    );
    assert(
      finalContactRow.raw_payload.attributes.version === 2 &&
        finalDetailRow.raw_payload.attributes.quantity === 2,
      "modified payloads were not persisted",
    );
    console.log("PASS: modified payloads update existing mirror rows deterministically");

    const { count: runCount, error: runCountError } = await client
      .from("parasut_sync_runs")
      .select("id", { count: "exact", head: true })
      .in("id", created.syncRunIds);
    if (runCountError) throw new Error(`sync-run count failed: ${safeError(runCountError)}`);
    assert(runCount === 3, "sync runs were not persisted independently");
    assert(
      (await countByExternalId(client, CONTACT_DEFINITION.table, contactId)) === 1 &&
        (await countByExternalId(client, DETAIL_DEFINITION.table, detailId)) === 1,
      "mirror uniqueness changed across independent sync runs",
    );
    console.log("PASS: independent sync runs preserve unique mirror records");
  } finally {
    for (const [table, ids] of [
      [CONTACT_DEFINITION.table, created.contactRowIds],
      [DETAIL_DEFINITION.table, created.detailRowIds],
      ["parasut_sync_runs", created.syncRunIds],
    ]) {
      if (ids.length === 0) continue;
      const { error } = await client.from(table).delete().in("id", ids);
      if (error) throw new Error(`${table} cleanup failed: ${safeError(error)}`);
    }
    if (created.companyIds.length > 0) {
      const { error } = await client
        .from("companies")
        .delete()
        .in("id", created.companyIds);
      if (error) throw new Error(`company cleanup failed: ${safeError(error)}`);
    }

    verifyDatabaseCleanup({
      parasut_contacts: await countByIds(
        client,
        CONTACT_DEFINITION.table,
        created.contactRowIds,
      ),
      parasut_sales_invoice_details: await countByIds(
        client,
        DETAIL_DEFINITION.table,
        created.detailRowIds,
      ),
      parasut_sync_runs: await countByIds(
        client,
        "parasut_sync_runs",
        created.syncRunIds,
      ),
      companies: await countByIds(client, "companies", created.companyIds),
    });
    console.log("PASS: cleanup removed all synthetic rows");
  }
}

try {
  await run();
} catch (error) {
  console.error(
    `Local idempotency integration refused or failed: ${
      error instanceof Error ? error.message : "unexpected integration failure"
    }`,
  );
  process.exitCode = 1;
}
