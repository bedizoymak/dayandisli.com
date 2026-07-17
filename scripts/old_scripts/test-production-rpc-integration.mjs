import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const PRODUCTION_REF = "meauutjsnnggzcigyvfp";
const PRODUCTION_NAME = "dayandisli.com";
const DRAFT_URLS = [
  new URL(
    "../supabase/manual/production_work_order_from_sales_order_rpc_draft.sql",
    import.meta.url,
  ),
  new URL(
    "../supabase/manual/production_route_operations_rpc_draft.sql",
    import.meta.url,
  ),
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function safeError(error) {
  if (!error || typeof error !== "object") return "Unknown Supabase error";
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

function localDatabaseContainer() {
  const output = execFileSync(
    "docker",
    ["ps", "--filter", "name=supabase_db_", "--format", "{{.Names}}"],
    { encoding: "utf8", windowsHide: true },
  );
  const containers = output.split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
  assert(containers.length === 1, "exactly one local Supabase database container is required");
  return containers[0];
}

function runLocalSql(container, sql) {
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
    {
      input: sql,
      stdio: ["pipe", "ignore", "pipe"],
      windowsHide: true,
    },
  );
}

async function applyDrafts(container) {
  for (const url of DRAFT_URLS) {
    runLocalSql(container, await readFile(url, "utf8"));
  }
}

async function createLocalUser(admin, prefix) {
  const email = `${prefix}-${randomUUID()}@example.invalid`;
  const password = `Rpc-${randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`test user creation failed: ${safeError(error)}`);
  return { id: data.user.id, email, password };
}

async function signIn(url, anonKey, user) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw new Error(`test user sign-in failed: ${safeError(error)}`);
  return client;
}

async function run() {
  if (process.env.RUN_PRODUCTION_RPC_INTEGRATION !== "1") {
    throw new Error("set RUN_PRODUCTION_RPC_INTEGRATION=1 to opt in");
  }

  if (
    process.env.SUPABASE_PROJECT_REF?.trim() === PRODUCTION_REF ||
    process.env.SUPABASE_PROJECT_NAME?.trim().toLowerCase() === PRODUCTION_NAME
  ) {
    throw new Error("production project identifiers are prohibited");
  }

  for (const envName of [
    "PRODUCTION_RPC_TEST_URL",
    "PRODUCTION_RPC_TEST_ANON_KEY",
    "PRODUCTION_RPC_TEST_SERVICE_ROLE_KEY",
  ]) {
    if (process.env[envName]) {
      throw new Error(`${envName} must not override the discovered local Supabase target`);
    }
  }

  const status = localStatus();
  const url = status.API_URL;
  const host = new URL(url).hostname.toLowerCase();
  assert(["127.0.0.1", "localhost"].includes(host), "Supabase API target must be local");
  assert(new URL(status.DB_URL).hostname === "127.0.0.1", "Supabase database target must be local");

  const container = localDatabaseContainer();
  await applyDrafts(container);
  console.log("PASS: RPC drafts applied to the local Supabase database only");
  runLocalSql(container, `
    drop policy if exists phase20_local_select_work_order_operations
    on public.work_order_operations;
    create policy phase20_local_select_work_order_operations
    on public.work_order_operations
    for select
    to authenticated
    using (true);

    drop policy if exists phase20_local_insert_work_order_operations
    on public.work_order_operations;
    create policy phase20_local_insert_work_order_operations
    on public.work_order_operations
    for insert
    to authenticated
    with check (true);
  `);
  console.log("PASS: temporary local work-order-operation policies installed");

  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
  const admin = createClient(url, status.SERVICE_ROLE_KEY, options);
  const anon = createClient(url, status.ANON_KEY, options);
  const runId = randomUUID();
  const code = runId.replaceAll("-", "").slice(0, 10).toUpperCase();
  const created = {
    userIds: [],
    companyIds: [],
    branchIds: [],
    membershipIds: [],
    salesOrderIds: [],
    workOrderIds: [],
    routeIds: [],
  };
  let userClient;
  let otherClient;
  let rollbackTriggerInstalled = false;
  let routePoliciesInstalled = true;

  try {
    const user = await createLocalUser(admin, "production-rpc");
    const otherUser = await createLocalUser(admin, "production-rpc-other");
    created.userIds.push(user.id, otherUser.id);

    const { data: companies, error: companiesError } = await admin
      .from("companies")
      .insert([
        { code: `P${code}`, legal_name: `Production RPC ${code}` },
        { code: `X${code}`, legal_name: `Production RPC Other ${code}` },
      ])
      .select("id");
    if (companiesError) throw new Error(`company creation failed: ${safeError(companiesError)}`);
    const [company, otherCompany] = companies;
    created.companyIds.push(company.id, otherCompany.id);

    const { data: branch, error: branchError } = await admin
      .from("company_branches")
      .insert({ company_id: company.id, code: `B${code}`, name: "Production RPC Branch" })
      .select("id")
      .single();
    if (branchError) throw new Error(`branch creation failed: ${safeError(branchError)}`);
    created.branchIds.push(branch.id);

    const { data: memberships, error: membershipsError } = await admin
      .from("company_memberships")
      .insert([
        {
          company_id: company.id,
          branch_id: branch.id,
          auth_user_id: user.id,
          email: user.email,
          role: "admin",
          is_company_admin: true,
          is_active: true,
        },
        {
          company_id: otherCompany.id,
          auth_user_id: otherUser.id,
          email: otherUser.email,
          role: "admin",
          is_company_admin: true,
          is_active: true,
        },
      ])
      .select("id");
    if (membershipsError) {
      throw new Error(`membership creation failed: ${safeError(membershipsError)}`);
    }
    created.membershipIds.push(...memberships.map(({ id }) => id));

    userClient = await signIn(url, status.ANON_KEY, user);
    otherClient = await signIn(url, status.ANON_KEY, otherUser);

    async function createSalesOrder(suffix) {
      const { data: order, error: orderError } = await admin
        .from("sales_orders")
        .insert({
          order_no: `SO-${code}-${suffix}`,
          title: `Production RPC Order ${suffix}`,
          status: "confirmed",
          priority: "high",
          due_date: "2026-06-30",
          company_id: company.id,
          branch_id: branch.id,
        })
        .select("*")
        .single();
      if (orderError) throw new Error(`sales order creation failed: ${safeError(orderError)}`);
      created.salesOrderIds.push(order.id);

      const { error: itemError } = await admin.from("sales_order_items").insert({
        sales_order_id: order.id,
        item_code: `ITEM-${suffix}`,
        description: `Test Parçası ${suffix}`,
        quantity: 3,
        unit: "adet",
      });
      if (itemError) throw new Error(`sales item creation failed: ${safeError(itemError)}`);
      return order;
    }

    const successOrder = await createSalesOrder("SUCCESS");
    let result = await userClient.rpc("erp_create_work_order_from_sales_order", {
      p_sales_order_id: successOrder.id,
    });
    if (result.error) throw new Error(`conversion RPC failed: ${safeError(result.error)}`);
    created.workOrderIds.push(result.data.id);
    assert(result.data.sales_order_id === successOrder.id, "created work order must reference sales order");
    const convertedOrder = await admin
      .from("sales_orders")
      .select("status")
      .eq("id", successOrder.id)
      .single();
    assert(convertedOrder.data?.status === "in_production", "sales order must be in production");
    console.log("PASS: sales order converts atomically to a work order");

    result = await userClient.rpc("erp_create_work_order_from_sales_order", {
      p_sales_order_id: successOrder.id,
    });
    assert(
      result.error?.message?.includes("Bu sipariş için zaten iş emri var."),
      "duplicate conversion must use the Turkish duplicate message",
    );
    console.log("PASS: duplicate conversion is rejected");

    const concurrentOrder = await createSalesOrder("CONCURRENT");
    const concurrentConversions = await Promise.all([
      userClient.rpc("erp_create_work_order_from_sales_order", {
        p_sales_order_id: concurrentOrder.id,
      }),
      userClient.rpc("erp_create_work_order_from_sales_order", {
        p_sales_order_id: concurrentOrder.id,
      }),
    ]);
    const conversionSuccesses = concurrentConversions.filter(({ error }) => !error);
    const conversionFailures = concurrentConversions.filter(({ error }) => error);
    assert(conversionSuccesses.length === 1, "exactly one concurrent conversion must succeed");
    assert(conversionFailures.length === 1, "exactly one concurrent conversion must fail");
    assert(
      conversionFailures[0].error.message.includes("Bu sipariş için zaten iş emri var."),
      "concurrent duplicate failure must preserve the Turkish message",
    );
    created.workOrderIds.push(conversionSuccesses[0].data.id);
    const concurrentWorkOrders = await admin
      .from("work_orders")
      .select("id", { count: "exact" })
      .eq("sales_order_id", concurrentOrder.id);
    assert(concurrentWorkOrders.count === 1, "concurrent conversion must persist one work order");
    console.log("PASS: concurrent sales conversions serialize correctly");

    const deniedOrder = await createSalesOrder("DENIED");
    result = await otherClient.rpc("erp_create_work_order_from_sales_order", {
      p_sales_order_id: deniedOrder.id,
    });
    assert(
      result.error?.message?.includes("Bu şirket veya şube için işlem yetkiniz yok."),
      "cross-company conversion must be denied",
    );
    console.log("PASS: cross-company sales conversion is denied");

    const anonConversion = await anon.rpc("erp_create_work_order_from_sales_order", {
      p_sales_order_id: deniedOrder.id,
    });
    assert(anonConversion.error, "anonymous conversion execution must fail");
    console.log("PASS: anonymous sales conversion is denied");

    const rollbackOrder = await createSalesOrder("ROLLBACK");

    const { data: route, error: routeError } = await admin
      .from("production_routes")
      .insert({ name: `Production RPC Route ${code}`, is_template: true })
      .select("id")
      .single();
    if (routeError) throw new Error(`route creation failed: ${safeError(routeError)}`);
    created.routeIds.push(route.id);
    const { error: stepsError } = await admin.from("production_route_steps").insert([
      { route_id: route.id, step_no: 10, operation_name: "Torna", estimated_minutes: 30 },
      { route_id: route.id, step_no: 20, operation_name: "Taşlama", estimated_minutes: 15 },
    ]);
    if (stepsError) throw new Error(`route-step creation failed: ${safeError(stepsError)}`);

    const { data: routeWorkOrder, error: routeWorkOrderError } = await admin
      .from("work_orders")
      .insert({
        work_order_no: `WO-${code}-ROUTE`,
        title: "Production RPC Route Work Order",
        status: "planned",
        company_id: company.id,
        branch_id: branch.id,
      })
      .select("*")
      .single();
    if (routeWorkOrderError) {
      throw new Error(`route work-order creation failed: ${safeError(routeWorkOrderError)}`);
    }
    created.workOrderIds.push(routeWorkOrder.id);

    result = await userClient.rpc("erp_create_operations_from_route", {
      p_work_order_id: routeWorkOrder.id,
      p_route_id: route.id,
      p_allow_append: false,
    });
    if (result.error) throw new Error(`route RPC failed: ${safeError(result.error)}`);
    assert(result.data.length === 2, "route RPC must create two operations");
    assert(
      result.data.map(({ step_no }) => step_no).join(",") === "10,20",
      "route operations must preserve step order",
    );
    console.log("PASS: route operations are created in step order");

    result = await userClient.rpc("erp_create_operations_from_route", {
      p_work_order_id: routeWorkOrder.id,
      p_route_id: route.id,
      p_allow_append: false,
    });
    assert(
      result.error?.message?.includes("Bu iş emrinde zaten operasyon var."),
      "existing operations must be rejected",
    );
    console.log("PASS: existing operations are rejected");

    const { data: emptyRoute, error: emptyRouteError } = await admin
      .from("production_routes")
      .insert({ name: `Production RPC Empty Route ${code}`, is_template: true })
      .select("id")
      .single();
    if (emptyRouteError) throw new Error(`empty route creation failed: ${safeError(emptyRouteError)}`);
    created.routeIds.push(emptyRoute.id);
    const { data: emptyWorkOrder, error: emptyWorkOrderError } = await admin
      .from("work_orders")
      .insert({
        work_order_no: `WO-${code}-EMPTY`,
        title: "Production RPC Empty Route Work Order",
        company_id: company.id,
        branch_id: branch.id,
      })
      .select("id")
      .single();
    if (emptyWorkOrderError) {
      throw new Error(`empty work-order creation failed: ${safeError(emptyWorkOrderError)}`);
    }
    created.workOrderIds.push(emptyWorkOrder.id);
    result = await userClient.rpc("erp_create_operations_from_route", {
      p_work_order_id: emptyWorkOrder.id,
      p_route_id: emptyRoute.id,
      p_allow_append: false,
    });
    assert(
      result.error?.message?.includes("Üretim rotasında operasyon adımı bulunamadı."),
      "empty route must use the Turkish validation message",
    );
    console.log("PASS: empty route is rejected");

    const { data: concurrentWorkOrder, error: concurrentWorkOrderError } = await admin
      .from("work_orders")
      .insert({
        work_order_no: `WO-${code}-CONCURRENT`,
        title: "Production RPC Concurrent Route Work Order",
        company_id: company.id,
        branch_id: branch.id,
      })
      .select("id")
      .single();
    if (concurrentWorkOrderError) {
      throw new Error(`concurrent work-order creation failed: ${safeError(concurrentWorkOrderError)}`);
    }
    created.workOrderIds.push(concurrentWorkOrder.id);
    const concurrentRoutes = await Promise.all([
      userClient.rpc("erp_create_operations_from_route", {
        p_work_order_id: concurrentWorkOrder.id,
        p_route_id: route.id,
        p_allow_append: false,
      }),
      userClient.rpc("erp_create_operations_from_route", {
        p_work_order_id: concurrentWorkOrder.id,
        p_route_id: route.id,
        p_allow_append: false,
      }),
    ]);
    assert(concurrentRoutes.filter(({ error }) => !error).length === 1, "one route call must succeed");
    assert(concurrentRoutes.filter(({ error }) => error).length === 1, "one route call must fail");
    const concurrentOperations = await admin
      .from("work_order_operations")
      .select("id", { count: "exact" })
      .eq("work_order_id", concurrentWorkOrder.id);
    assert(concurrentOperations.count === 2, "concurrent route calls must persist one operation set");
    console.log("PASS: concurrent route generation serializes correctly");

    const anonRoute = await anon.rpc("erp_create_operations_from_route", {
      p_work_order_id: emptyWorkOrder.id,
      p_route_id: route.id,
      p_allow_append: false,
    });
    assert(anonRoute.error, "anonymous route execution must fail");
    console.log("PASS: anonymous route generation is denied");

    const { data: rollbackWorkOrder, error: rollbackWorkOrderError } = await admin
      .from("work_orders")
      .insert({
        work_order_no: `WO-${code}-ROLLBACK`,
        title: "Production RPC Rollback Work Order",
        company_id: company.id,
        branch_id: branch.id,
      })
      .select("id")
      .single();
    if (rollbackWorkOrderError) {
      throw new Error(`rollback work-order creation failed: ${safeError(rollbackWorkOrderError)}`);
    }
    created.workOrderIds.push(rollbackWorkOrder.id);

    runLocalSql(container, `
      create or replace function public.phase20_force_production_audit_failure()
      returns trigger
      language plpgsql
      as $$
      begin
        if new.entity_id in ('${rollbackOrder.id}'::uuid, '${rollbackWorkOrder.id}'::uuid)
          and new.action in ('sales_order_converted', 'route_operations_created') then
          raise exception using
            errcode = 'P0001',
            message = 'Phase 20 zorunlu denetim kaydı hatası.';
        end if;
        return new;
      end;
      $$;

      create trigger phase20_force_production_audit_failure
      before insert on public.erp_audit_logs
      for each row execute function public.phase20_force_production_audit_failure();
    `);
    rollbackTriggerInstalled = true;

    const rollbackConversion = await userClient.rpc(
      "erp_create_work_order_from_sales_order",
      { p_sales_order_id: rollbackOrder.id },
    );
    assert(
      rollbackConversion.error?.message?.includes("Phase 20 zorunlu denetim kaydı hatası."),
      "forced conversion audit failure must surface",
    );
    const rollbackConversionRows = await admin
      .from("work_orders")
      .select("id", { count: "exact" })
      .eq("sales_order_id", rollbackOrder.id);
    assert(rollbackConversionRows.count === 0, "audit failure must roll back work-order creation");
    const rollbackSalesStatus = await admin
      .from("sales_orders")
      .select("status")
      .eq("id", rollbackOrder.id)
      .single();
    assert(rollbackSalesStatus.data?.status === "confirmed", "audit failure must roll back Sales status");
    console.log("PASS: conversion audit failure rolls back work order and Sales status");

    const rollbackRoute = await userClient.rpc("erp_create_operations_from_route", {
      p_work_order_id: rollbackWorkOrder.id,
      p_route_id: route.id,
      p_allow_append: false,
    });
    assert(
      rollbackRoute.error?.message?.includes("Phase 20 zorunlu denetim kaydı hatası."),
      "forced route audit failure must surface",
    );
    const rollbackOperations = await admin
      .from("work_order_operations")
      .select("id", { count: "exact" })
      .eq("work_order_id", rollbackWorkOrder.id);
    assert(rollbackOperations.count === 0, "audit failure must roll back all route operations");
    console.log("PASS: route audit failure rolls back every operation");
  } finally {
    if (userClient) await userClient.auth.signOut();
    if (otherClient) await otherClient.auth.signOut();
    if (rollbackTriggerInstalled) {
      runLocalSql(container, `
        drop trigger if exists phase20_force_production_audit_failure
        on public.erp_audit_logs;
        drop function if exists public.phase20_force_production_audit_failure();
      `);
    }
    if (routePoliciesInstalled) {
      runLocalSql(container, `
        drop policy if exists phase20_local_select_work_order_operations
        on public.work_order_operations;
        drop policy if exists phase20_local_insert_work_order_operations
        on public.work_order_operations;
      `);
      routePoliciesInstalled = false;
    }

    for (const companyId of created.companyIds) {
      await admin.from("erp_audit_logs").delete().eq("company_id", companyId);
    }
    for (const workOrderId of created.workOrderIds) {
      await admin.from("work_order_operations").delete().eq("work_order_id", workOrderId);
    }
    if (created.workOrderIds.length > 0) {
      await admin.from("work_orders").delete().in("id", created.workOrderIds);
    }
    if (created.salesOrderIds.length > 0) {
      await admin.from("sales_order_items").delete().in("sales_order_id", created.salesOrderIds);
      await admin.from("sales_orders").delete().in("id", created.salesOrderIds);
    }
    if (created.routeIds.length > 0) {
      await admin.from("production_route_steps").delete().in("route_id", created.routeIds);
      await admin.from("production_routes").delete().in("id", created.routeIds);
    }
    if (created.membershipIds.length > 0) {
      await admin.from("company_memberships").delete().in("id", created.membershipIds);
    }
    if (created.branchIds.length > 0) {
      await admin.from("company_branches").delete().in("id", created.branchIds);
    }
    if (created.companyIds.length > 0) {
      await admin.from("companies").delete().in("id", created.companyIds);
    }
    for (const userId of created.userIds) {
      await admin.auth.admin.deleteUser(userId);
    }

    const cleanupChecks = await Promise.all([
      created.salesOrderIds.length
        ? admin.from("sales_orders").select("id", { count: "exact", head: true }).in("id", created.salesOrderIds)
        : Promise.resolve({ count: 0, error: null }),
      created.workOrderIds.length
        ? admin.from("work_orders").select("id", { count: "exact", head: true }).in("id", created.workOrderIds)
        : Promise.resolve({ count: 0, error: null }),
      created.routeIds.length
        ? admin.from("production_routes").select("id", { count: "exact", head: true }).in("id", created.routeIds)
        : Promise.resolve({ count: 0, error: null }),
    ]);
    assert(
      cleanupChecks.every(({ count, error }) => !error && count === 0),
      "integration cleanup verification failed",
    );
    console.log("PASS: integration cleanup left zero test business rows");
  }
}

try {
  await run();
} catch (error) {
  console.error(
    `Production RPC integration test refused or failed: ${
      error instanceof Error ? error.message : "unexpected integration failure"
    }`,
  );
  process.exitCode = 1;
}
