import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const PRODUCTION_REFS = new Set(["meauutjsnnggzcigyvfp"]);
const REQUIRED_ENV = [
  "INVENTORY_RPC_TEST_URL",
  "INVENTORY_RPC_TEST_ANON_KEY",
  "INVENTORY_RPC_TEST_SERVICE_ROLE_KEY",
];

function fail(message) {
  console.error(`Inventory RPC integration test refused or failed: ${message}`);
  process.exitCode = 1;
}

function projectRefFromUrl(value) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    const match = hostname.match(/^([a-z0-9]+)\.supabase\.co$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function safeError(error) {
  if (!error || typeof error !== "object") return "Unknown Supabase error";
  return [error.code, error.message, error.hint].filter(Boolean).join(" | ");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function runLocalSql(sql) {
  const container = process.env.INVENTORY_RPC_TEST_DB_CONTAINER;
  if (!container) {
    throw new Error("INVENTORY_RPC_TEST_DB_CONTAINER is required for local rollback testing");
  }

  execFileSync(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      "postgres",
    ],
    { input: sql, stdio: ["pipe", "ignore", "pipe"] },
  );
}

async function run() {
  if (process.env.RUN_INVENTORY_RPC_INTEGRATION !== "1") {
    fail("set RUN_INVENTORY_RPC_INTEGRATION=1 to opt in");
    return;
  }

  const missing = REQUIRED_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    fail(`missing required environment variables: ${missing.join(", ")}`);
    return;
  }

  const target = process.env.INVENTORY_RPC_TEST_TARGET?.trim().toLowerCase();
  if (!["local", "staging"].includes(target)) {
    fail("INVENTORY_RPC_TEST_TARGET must be exactly local or staging");
    return;
  }

  const url = process.env.INVENTORY_RPC_TEST_URL;
  const projectRef = projectRefFromUrl(url);
  const declaredRef = process.env.INVENTORY_RPC_TEST_PROJECT_REF?.trim();
  const declaredName = process.env.INVENTORY_RPC_TEST_PROJECT_NAME?.trim().toLowerCase();

  if (
    (projectRef && PRODUCTION_REFS.has(projectRef)) ||
    (declaredRef && PRODUCTION_REFS.has(declaredRef)) ||
    declaredName === "dayandisli.com"
  ) {
    fail("target identifies the production dayandisli.com project");
    return;
  }

  if (target === "local" && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url)) {
    fail("local target must use localhost or 127.0.0.1");
    return;
  }

  if (target === "local" && !process.env.INVENTORY_RPC_TEST_DB_CONTAINER) {
    fail("INVENTORY_RPC_TEST_DB_CONTAINER is required for local rollback testing");
    return;
  }

  if (target === "staging" && (!projectRef || !declaredRef || projectRef !== declaredRef)) {
    fail("staging URL ref must match INVENTORY_RPC_TEST_PROJECT_REF");
    return;
  }

  const clientOptions = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
  const admin = createClient(
    url,
    process.env.INVENTORY_RPC_TEST_SERVICE_ROLE_KEY,
    clientOptions,
  );
  const anon = createClient(url, process.env.INVENTORY_RPC_TEST_ANON_KEY, clientOptions);
  const authenticated = createClient(
    url,
    process.env.INVENTORY_RPC_TEST_ANON_KEY,
    clientOptions,
  );

  const runId = randomUUID();
  const email = `inventory-rpc-${runId}@example.invalid`;
  const password = `Rpc-${randomUUID()}-Aa1!`;
  const code = runId.replaceAll("-", "").slice(0, 12).toUpperCase();
  const created = {};

  try {
    const { data: userResult, error: userError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (userError) throw new Error(`test user creation failed: ${safeError(userError)}`);
    created.userId = userResult.user.id;

    const { data: company, error: companyError } = await admin
      .from("companies")
      .insert({ code: `RPC${code}`, legal_name: `RPC Test ${code}` })
      .select("id")
      .single();
    if (companyError) throw new Error(`company creation failed: ${safeError(companyError)}`);
    created.companyId = company.id;

    const { data: otherCompany, error: otherCompanyError } = await admin
      .from("companies")
      .insert({ code: `RPX${code}`, legal_name: `RPC Other ${code}` })
      .select("id")
      .single();
    if (otherCompanyError) {
      throw new Error(`other company creation failed: ${safeError(otherCompanyError)}`);
    }
    created.otherCompanyId = otherCompany.id;

    const { data: branch, error: branchError } = await admin
      .from("company_branches")
      .insert({ company_id: company.id, code: `B${code}`, name: "RPC Test Branch" })
      .select("id")
      .single();
    if (branchError) throw new Error(`branch creation failed: ${safeError(branchError)}`);
    created.branchId = branch.id;

    const { error: membershipError } = await admin.from("company_memberships").insert({
      company_id: company.id,
      branch_id: branch.id,
      auth_user_id: created.userId,
      email,
      role: "admin",
      is_company_admin: true,
      is_active: true,
    });
    if (membershipError) {
      throw new Error(`membership creation failed: ${safeError(membershipError)}`);
    }

    const { data: warehouse, error: warehouseError } = await admin
      .from("warehouses")
      .insert({
        company_id: company.id,
        branch_id: branch.id,
        code: `W${code}`,
        name: "RPC Test Warehouse",
      })
      .select("id")
      .single();
    if (warehouseError) throw new Error(`warehouse creation failed: ${safeError(warehouseError)}`);
    created.warehouseId = warehouse.id;

    const { data: otherWarehouse, error: otherWarehouseError } = await admin
      .from("warehouses")
      .insert({
        company_id: otherCompany.id,
        code: `X${code}`,
        name: "RPC Other Warehouse",
      })
      .select("id")
      .single();
    if (otherWarehouseError) {
      throw new Error(`other warehouse creation failed: ${safeError(otherWarehouseError)}`);
    }
    created.otherWarehouseId = otherWarehouse.id;

    const { data: item, error: itemError } = await admin
      .from("inventory_items")
      .insert({
        item_type: "raw_material",
        code: `ITEM${code}`,
        name: "RPC Test Item",
        current_stock: 10,
        company_id: company.id,
        branch_id: branch.id,
        default_warehouse_id: warehouse.id,
      })
      .select("id")
      .single();
    if (itemError) throw new Error(`inventory item creation failed: ${safeError(itemError)}`);
    created.itemId = item.id;

    const { data: concurrencyItem, error: concurrencyItemError } = await admin
      .from("inventory_items")
      .insert({
        item_type: "raw_material",
        code: `CON${code}`,
        name: "RPC Concurrency Item",
        current_stock: 10,
        company_id: company.id,
        branch_id: branch.id,
        default_warehouse_id: warehouse.id,
      })
      .select("id")
      .single();
    if (concurrencyItemError) {
      throw new Error(`concurrency item creation failed: ${safeError(concurrencyItemError)}`);
    }
    created.concurrencyItemId = concurrencyItem.id;

    const { data: rollbackItem, error: rollbackItemError } = await admin
      .from("inventory_items")
      .insert({
        item_type: "raw_material",
        code: `RBK${code}`,
        name: "RPC Rollback Item",
        current_stock: 10,
        company_id: company.id,
        branch_id: branch.id,
        default_warehouse_id: warehouse.id,
      })
      .select("id")
      .single();
    if (rollbackItemError) {
      throw new Error(`rollback item creation failed: ${safeError(rollbackItemError)}`);
    }
    created.rollbackItemId = rollbackItem.id;

    const { error: signInError } = await authenticated.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) throw new Error(`test user sign-in failed: ${safeError(signInError)}`);

    const callRpc = (movementType, quantity, warehouseId = warehouse.id) =>
      authenticated.rpc("erp_create_inventory_movement", {
        p_item_id: item.id,
        p_movement_type: movementType,
        p_quantity: quantity,
        p_source_type: "phase13_test",
        p_source_id: null,
        p_notes: `Phase 13 ${runId}`,
        p_warehouse_id: warehouseId,
      });

    let result = await callRpc("in", 5);
    if (result.error) throw new Error(`incoming RPC failed: ${safeError(result.error)}`);
    let stock = await authenticated.from("inventory_items").select("current_stock").eq("id", item.id).single();
    assert(!stock.error && Number(stock.data.current_stock) === 15, "incoming stock should be 15");
    console.log("PASS: incoming movement increases stock");

    result = await callRpc("out", 3);
    if (result.error) throw new Error(`outgoing RPC failed: ${safeError(result.error)}`);
    stock = await authenticated.from("inventory_items").select("current_stock").eq("id", item.id).single();
    assert(!stock.error && Number(stock.data.current_stock) === 12, "outgoing stock should be 12");
    console.log("PASS: outgoing movement decreases stock");

    result = await callRpc("out", 1000);
    assert(result.error?.message?.includes("Stok eksiye düşemez."), "excessive outgoing must fail in Turkish");
    console.log("PASS: excessive outgoing movement fails");

    result = await callRpc("reservation", 2);
    if (result.error) throw new Error(`reservation RPC failed: ${safeError(result.error)}`);
    stock = await authenticated.from("inventory_items").select("current_stock").eq("id", item.id).single();
    assert(!stock.error && Number(stock.data.current_stock) === 12, "reservation must not change stock");
    console.log("PASS: reservation does not change stock");

    result = await callRpc("invalid", 1);
    assert(result.error?.message?.includes("Geçersiz stok hareketi türü."), "invalid type must fail in Turkish");
    console.log("PASS: invalid movement type fails");

    result = await callRpc("in", 1, otherWarehouse.id);
    assert(result.error, "warehouse mismatch must fail");
    console.log("PASS: warehouse mismatch fails");

    const anonResult = await anon.rpc("erp_create_inventory_movement", {
      p_item_id: item.id,
      p_movement_type: "in",
      p_quantity: 1,
    });
    assert(anonResult.error, "anonymous RPC execution must fail");
    console.log("PASS: anon cannot execute RPC");

    const concurrencySource = `phase14_concurrency_${runId}`;
    const callConcurrentOutgoing = () =>
      authenticated.rpc("erp_create_inventory_movement", {
        p_item_id: concurrencyItem.id,
        p_movement_type: "out",
        p_quantity: 6,
        p_source_type: concurrencySource,
        p_source_id: null,
        p_notes: `Phase 14 concurrency ${runId}`,
        p_warehouse_id: warehouse.id,
      });
    const concurrentResults = await Promise.all([
      callConcurrentOutgoing(),
      callConcurrentOutgoing(),
    ]);
    const successes = concurrentResults.filter(({ error }) => !error);
    const failures = concurrentResults.filter(({ error }) => error);
    assert(successes.length === 1, "exactly one concurrent outgoing call must succeed");
    assert(failures.length === 1, "exactly one concurrent outgoing call must fail");
    assert(
      failures[0].error.message.includes("Stok eksiye düşemez."),
      "concurrent failure must use the Turkish insufficient-stock message",
    );
    const concurrencyStock = await authenticated
      .from("inventory_items")
      .select("current_stock")
      .eq("id", concurrencyItem.id)
      .single();
    assert(
      !concurrencyStock.error && Number(concurrencyStock.data.current_stock) === 4,
      "concurrency item final stock must be 4",
    );
    const concurrencyMovements = await authenticated
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("inventory_item_id", concurrencyItem.id)
      .eq("source_type", concurrencySource);
    assert(
      !concurrencyMovements.error && concurrencyMovements.count === 1,
      "exactly one concurrent movement row must persist",
    );
    console.log("PASS: concurrent outgoing movements serialize correctly");

    const rollbackSource = `phase14_audit_failure_${runId}`;
    runLocalSql(`
      create or replace function public.phase14_force_inventory_audit_failure()
      returns trigger
      language plpgsql
      as $$
      begin
        if new.metadata ->> 'source_type' = '${rollbackSource}' then
          raise exception using
            errcode = 'P0001',
            message = 'Phase 14 zorunlu denetim kaydı hatası.';
        end if;
        return new;
      end;
      $$;

      create trigger phase14_force_inventory_audit_failure
      before insert on public.erp_audit_logs
      for each row execute function public.phase14_force_inventory_audit_failure();
    `);
    created.auditFailureTrigger = true;

    const rollbackResult = await authenticated.rpc("erp_create_inventory_movement", {
      p_item_id: rollbackItem.id,
      p_movement_type: "in",
      p_quantity: 5,
      p_source_type: rollbackSource,
      p_source_id: null,
      p_notes: `Phase 14 rollback ${runId}`,
      p_warehouse_id: warehouse.id,
    });
    assert(
      rollbackResult.error?.message?.includes("Phase 14 zorunlu denetim kaydı hatası."),
      "forced audit failure must surface deterministically",
    );
    const rollbackStock = await authenticated
      .from("inventory_items")
      .select("current_stock")
      .eq("id", rollbackItem.id)
      .single();
    assert(
      !rollbackStock.error && Number(rollbackStock.data.current_stock) === 10,
      "audit failure must roll back the stock update",
    );
    const rollbackMovements = await authenticated
      .from("inventory_movements")
      .select("id", { count: "exact", head: true })
      .eq("inventory_item_id", rollbackItem.id)
      .eq("source_type", rollbackSource);
    assert(
      !rollbackMovements.error && rollbackMovements.count === 0,
      "audit failure must roll back the movement insert",
    );
    console.log("PASS: forced audit failure rolls back movement and stock");
  } catch (error) {
    fail(error instanceof Error ? error.message : "unexpected integration failure");
  } finally {
    await authenticated.auth.signOut();
    if (created.auditFailureTrigger) {
      try {
        runLocalSql(`
          drop trigger if exists phase14_force_inventory_audit_failure
          on public.erp_audit_logs;
          drop function if exists public.phase14_force_inventory_audit_failure();
        `);
      } catch {
        fail("failed to remove the local audit-failure trigger");
      }
    }
    const itemIds = [
      created.itemId,
      created.concurrencyItemId,
      created.rollbackItemId,
    ].filter(Boolean);
    for (const itemId of itemIds) {
      await admin.from("erp_audit_logs").delete().eq("entity_id", itemId);
      await admin.from("inventory_movements").delete().eq("inventory_item_id", itemId);
      await admin.from("inventory_items").delete().eq("id", itemId);
    }
    if (created.companyId) {
      await admin.from("company_memberships").delete().eq("company_id", created.companyId);
    }
    if (created.warehouseId) await admin.from("warehouses").delete().eq("id", created.warehouseId);
    if (created.otherWarehouseId) {
      await admin.from("warehouses").delete().eq("id", created.otherWarehouseId);
    }
    if (created.branchId) await admin.from("company_branches").delete().eq("id", created.branchId);
    if (created.companyId) await admin.from("companies").delete().eq("id", created.companyId);
    if (created.otherCompanyId) await admin.from("companies").delete().eq("id", created.otherCompanyId);
    if (created.userId) await admin.auth.admin.deleteUser(created.userId);
    console.log("Integration cleanup attempted.");
  }
}

await run();
