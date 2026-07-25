import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";

const PRODUCTION_REF = "meauutjsnnggzcigyvfp";
const PRODUCTION_NAME = "dayandisli.com";
const DRAFTS = {
  operations: new URL(
    "../supabase/manual/work_order_operations_rls_prereq_draft.sql",
    import.meta.url,
  ),
  predicates: new URL(
    "../supabase/manual/tenant_policy_predicate_corrections_draft.sql",
    import.meta.url,
  ),
  uniqueness: new URL(
    "../supabase/manual/work_orders_sales_order_unique_draft.sql",
    import.meta.url,
  ),
};

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

function runLocalSql(container, sql, { capture = false, expectFailure = false } = {}) {
  try {
    return execFileSync(
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
        ...(capture ? ["-At"] : []),
      ],
      {
        input: sql,
        encoding: "utf8",
        stdio: ["pipe", capture ? "pipe" : "ignore", "pipe"],
        windowsHide: true,
      },
    );
  } catch (error) {
    if (expectFailure) return error;
    throw error;
  }
}

async function createLocalUser(admin, prefix) {
  const email = `${prefix}-${randomUUID()}@example.invalid`;
  const password = `Prereq-${randomUUID()}-Aa1!`;
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
  if (process.env.RUN_PRODUCTION_PREREQ_INTEGRATION !== "1") {
    throw new Error("set RUN_PRODUCTION_PREREQ_INTEGRATION=1 to opt in");
  }

  if (
    process.env.SUPABASE_PROJECT_REF?.trim() === PRODUCTION_REF ||
    process.env.SUPABASE_PROJECT_NAME?.trim().toLowerCase() === PRODUCTION_NAME
  ) {
    throw new Error("production project identifiers are prohibited");
  }

  for (const envName of [
    "PRODUCTION_PREREQ_TEST_URL",
    "PRODUCTION_PREREQ_TEST_ANON_KEY",
    "PRODUCTION_PREREQ_TEST_SERVICE_ROLE_KEY",
  ]) {
    if (process.env[envName]) {
      throw new Error(`${envName} must not override the discovered local Supabase target`);
    }
  }

  const status = localStatus();
  const apiUrl = new URL(status.API_URL);
  const databaseUrl = new URL(status.DB_URL);
  assert(["127.0.0.1", "localhost"].includes(apiUrl.hostname), "API target must be local");
  assert(
    ["127.0.0.1", "localhost"].includes(databaseUrl.hostname),
    "database target must be local",
  );
  assert(
    !status.API_URL.includes(PRODUCTION_REF) &&
      !status.API_URL.toLowerCase().includes(PRODUCTION_NAME),
    "production target identifiers are prohibited",
  );

  const container = localDatabaseContainer();
  const operationsSql = await readFile(DRAFTS.operations, "utf8");
  const predicatesSql = await readFile(DRAFTS.predicates, "utf8");
  const uniquenessSql = await readFile(DRAFTS.uniqueness, "utf8");

  runLocalSql(container, operationsSql);
  runLocalSql(container, predicatesSql);
  console.log("PASS: RLS prerequisite drafts applied to local PostgreSQL only");

  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
  const anon = createClient(status.API_URL, status.ANON_KEY, options);
  const runId = randomUUID();
  const code = runId.replaceAll("-", "").slice(0, 10).toUpperCase();
  const created = {
    userIds: [],
    companyIds: [],
    branchIds: [],
    membershipIds: [],
    salesOrderIds: [],
    workOrderIds: [],
    operationIds: [],
  };
  const clients = [];

  try {
    const branchUser = await createLocalUser(admin, "prereq-branch");
    const companyUser = await createLocalUser(admin, "prereq-company");
    const otherUser = await createLocalUser(admin, "prereq-other");
    created.userIds.push(branchUser.id, companyUser.id, otherUser.id);

    const { data: companies, error: companiesError } = await admin
      .from("companies")
      .insert([
        { code: `P${code}`, legal_name: `Prerequisite ${code}` },
        { code: `X${code}`, legal_name: `Prerequisite Other ${code}` },
      ])
      .select("id");
    if (companiesError) throw new Error(`company creation failed: ${safeError(companiesError)}`);
    const [company, otherCompany] = companies;
    created.companyIds.push(company.id, otherCompany.id);

    const { data: branches, error: branchesError } = await admin
      .from("company_branches")
      .insert([
        { company_id: company.id, code: `A${code}`, name: "Prerequisite Branch A" },
        { company_id: company.id, code: `B${code}`, name: "Prerequisite Branch B" },
      ])
      .select("id");
    if (branchesError) throw new Error(`branch creation failed: ${safeError(branchesError)}`);
    const [branchA, branchB] = branches;
    created.branchIds.push(branchA.id, branchB.id);

    const { data: memberships, error: membershipsError } = await admin
      .from("company_memberships")
      .insert([
        {
          company_id: company.id,
          branch_id: branchA.id,
          auth_user_id: branchUser.id,
          email: branchUser.email,
          role: "admin",
          is_company_admin: false,
          is_active: true,
        },
        {
          company_id: company.id,
          branch_id: null,
          auth_user_id: companyUser.id,
          email: companyUser.email,
          role: "admin",
          is_company_admin: true,
          is_active: true,
        },
        {
          company_id: otherCompany.id,
          branch_id: null,
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

    const branchClient = await signIn(status.API_URL, status.ANON_KEY, branchUser);
    const companyClient = await signIn(status.API_URL, status.ANON_KEY, companyUser);
    const otherClient = await signIn(status.API_URL, status.ANON_KEY, otherUser);
    clients.push(branchClient, companyClient, otherClient);

    const { data: workOrders, error: workOrdersError } = await admin
      .from("work_orders")
      .insert([
        {
          work_order_no: `WO-${code}-A`,
          title: "Prerequisite Branch A",
          company_id: company.id,
          branch_id: branchA.id,
        },
        {
          work_order_no: `WO-${code}-B`,
          title: "Prerequisite Branch B",
          company_id: company.id,
          branch_id: branchB.id,
        },
        {
          work_order_no: `WO-${code}-X`,
          title: "Prerequisite Other Company",
          company_id: otherCompany.id,
          branch_id: null,
        },
      ])
      .select("id");
    if (workOrdersError) {
      throw new Error(`work-order creation failed: ${safeError(workOrdersError)}`);
    }
    const [workOrderA, workOrderB, otherWorkOrder] = workOrders;
    created.workOrderIds.push(...workOrders.map(({ id }) => id));

    let result = await branchClient
      .from("work_order_operations")
      .insert({
        work_order_id: workOrderA.id,
        step_no: 10,
        operation_name: "Torna",
      })
      .select("*")
      .single();
    if (result.error) throw new Error(`same-branch insert failed: ${safeError(result.error)}`);
    created.operationIds.push(result.data.id);

    result = await branchClient
      .from("work_order_operations")
      .update({ status: "in_progress" })
      .eq("id", result.data.id)
      .select("status")
      .single();
    assert(!result.error && result.data.status === "in_progress", "same-branch update must succeed");

    const sameBranchSelect = await branchClient
      .from("work_order_operations")
      .select("id")
      .eq("id", created.operationIds[0]);
    assert(sameBranchSelect.data?.length === 1, "same-branch member must select operation");
    console.log("PASS: same-company matching-branch member can select, insert, and update");

    const { data: branchBOperation, error: branchBOperationError } = await admin
      .from("work_order_operations")
      .insert({
        work_order_id: workOrderB.id,
        step_no: 10,
        operation_name: "Taşlama",
      })
      .select("id")
      .single();
    if (branchBOperationError) {
      throw new Error(`branch-B operation creation failed: ${safeError(branchBOperationError)}`);
    }
    created.operationIds.push(branchBOperation.id);

    const branchDenied = await branchClient
      .from("work_order_operations")
      .select("id")
      .eq("id", branchBOperation.id);
    assert(!branchDenied.error && branchDenied.data.length === 0, "other branch must be hidden");

    const companyWide = await companyClient
      .from("work_order_operations")
      .select("id")
      .in("id", created.operationIds);
    assert(companyWide.data?.length === 2, "company-wide member must access both company branches");
    console.log("PASS: branch scope is exact and company-wide membership spans company branches");

    const { data: otherOperation, error: otherOperationError } = await admin
      .from("work_order_operations")
      .insert({
        work_order_id: otherWorkOrder.id,
        step_no: 10,
        operation_name: "Kontrol",
      })
      .select("id")
      .single();
    if (otherOperationError) {
      throw new Error(`other-company operation creation failed: ${safeError(otherOperationError)}`);
    }
    created.operationIds.push(otherOperation.id);

    const crossCompany = await otherClient
      .from("work_order_operations")
      .select("id")
      .eq("id", created.operationIds[0]);
    assert(!crossCompany.error && crossCompany.data.length === 0, "cross-company row must be hidden");
    const anonResult = await anon
      .from("work_order_operations")
      .select("id")
      .eq("id", created.operationIds[0]);
    assert(anonResult.error || anonResult.data?.length === 0, "anonymous access must be denied");
    console.log("PASS: cross-company and anonymous operation access is denied");

    const effectivePolicies = runLocalSql(
      container,
      `
        select coalesce(string_agg(coalesce(qual, '') || ' ' || coalesce(with_check, ''), E'\\n'), '')
        from pg_policies
        where schemaname = 'public'
          and tablename in ('sales_orders', 'work_orders', 'work_order_operations');
      `,
      { capture: true },
    );
    assert(
      !/\bcm\.company_id\s*=\s*cm\.company_id\b/i.test(effectivePolicies),
      "effective policies must not contain the known company self-comparison",
    );
    assert(
      !/\bmembership\.company_id\s*=\s*membership\.company_id\b/i.test(effectivePolicies),
      "effective policies must not collapse explicit company qualification",
    );
    assert(
      effectivePolicies.includes("parent_work_order.company_id"),
      "operation policies must resolve access through parent work_orders",
    );
    console.log("PASS: effective policy catalog retains explicit tenant qualification");

    runLocalSql(
      container,
      "drop index if exists public.uq_work_orders_sales_order_id_not_null;",
    );

    const { data: duplicateOrder, error: duplicateOrderError } = await admin
      .from("sales_orders")
      .insert({
        order_no: `SO-${code}-DUP`,
        title: "Prerequisite Duplicate Detection",
        company_id: company.id,
        branch_id: branchA.id,
      })
      .select("id")
      .single();
    if (duplicateOrderError) {
      throw new Error(`duplicate sales-order creation failed: ${safeError(duplicateOrderError)}`);
    }
    created.salesOrderIds.push(duplicateOrder.id);

    const { data: duplicateWorkOrders, error: duplicateWorkOrdersError } = await admin
      .from("work_orders")
      .insert([
        {
          work_order_no: `WO-${code}-DUP1`,
          title: "Prerequisite Duplicate One",
          sales_order_id: duplicateOrder.id,
          company_id: company.id,
          branch_id: branchA.id,
        },
        {
          work_order_no: `WO-${code}-DUP2`,
          title: "Prerequisite Duplicate Two",
          sales_order_id: duplicateOrder.id,
          company_id: company.id,
          branch_id: branchA.id,
        },
      ])
      .select("id");
    if (duplicateWorkOrdersError) {
      throw new Error(`duplicate work-order setup failed: ${safeError(duplicateWorkOrdersError)}`);
    }
    created.workOrderIds.push(...duplicateWorkOrders.map(({ id }) => id));

    const duplicateCount = runLocalSql(
      container,
      `
        select count(*)
        from (
          select sales_order_id
          from public.work_orders
          where sales_order_id is not null
          group by sales_order_id
          having count(*) > 1
        ) as duplicate_groups;
      `,
      { capture: true },
    ).trim();
    assert(Number(duplicateCount) >= 1, "duplicate detection query must find the fixture");

    const refusal = runLocalSql(container, uniquenessSql, { expectFailure: true });
    const refusalText = `${refusal.stderr ?? ""}`;
    assert(
      refusalText.includes("Duplicate work_orders.sales_order_id values"),
      "uniqueness draft must refuse duplicate data",
    );
    console.log("PASS: duplicate detection works and draft refuses index creation");

    const duplicateToDelete = duplicateWorkOrders[1].id;
    const { error: duplicateDeleteError } = await admin
      .from("work_orders")
      .delete()
      .eq("id", duplicateToDelete);
    if (duplicateDeleteError) {
      throw new Error(`duplicate cleanup failed: ${safeError(duplicateDeleteError)}`);
    }
    created.workOrderIds = created.workOrderIds.filter((id) => id !== duplicateToDelete);

    runLocalSql(container, uniquenessSql);
    const indexDefinition = runLocalSql(
      container,
      `
        select indexdef
        from pg_indexes
        where schemaname = 'public'
          and indexname = 'uq_work_orders_sales_order_id_not_null';
      `,
      { capture: true },
    );
    assert(
      /unique index[\s\S]*where \(sales_order_id is not null\)/i.test(indexDefinition),
      "partial unique index must be installed",
    );

    const duplicateInsert = await admin.from("work_orders").insert({
      work_order_no: `WO-${code}-DUP3`,
      title: "Prerequisite Duplicate Rejected",
      sales_order_id: duplicateOrder.id,
      company_id: company.id,
      branch_id: branchA.id,
    });
    assert(duplicateInsert.error?.code === "23505", "second non-null sales-order link must fail");

    const nullInsert = await admin
      .from("work_orders")
      .insert([
        {
          work_order_no: `WO-${code}-NULL1`,
          title: "Prerequisite Null One",
          sales_order_id: null,
          company_id: company.id,
          branch_id: branchA.id,
        },
        {
          work_order_no: `WO-${code}-NULL2`,
          title: "Prerequisite Null Two",
          sales_order_id: null,
          company_id: company.id,
          branch_id: branchA.id,
        },
      ])
      .select("id");
    if (nullInsert.error) {
      throw new Error(`null sales-order work orders failed: ${safeError(nullInsert.error)}`);
    }
    created.workOrderIds.push(...nullInsert.data.map(({ id }) => id));
    console.log("PASS: partial unique index rejects duplicates and permits multiple null links");
  } finally {
    for (const client of clients) await client.auth.signOut();

    if (created.operationIds.length > 0) {
      await admin.from("work_order_operations").delete().in("id", created.operationIds);
    }
    if (created.workOrderIds.length > 0) {
      await admin.from("work_orders").delete().in("id", created.workOrderIds);
    }
    if (created.salesOrderIds.length > 0) {
      await admin.from("sales_orders").delete().in("id", created.salesOrderIds);
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
      created.workOrderIds.length
        ? admin.from("work_orders").select("id", { count: "exact", head: true }).in("id", created.workOrderIds)
        : Promise.resolve({ count: 0, error: null }),
      created.salesOrderIds.length
        ? admin.from("sales_orders").select("id", { count: "exact", head: true }).in("id", created.salesOrderIds)
        : Promise.resolve({ count: 0, error: null }),
      created.companyIds.length
        ? admin.from("companies").select("id", { count: "exact", head: true }).in("id", created.companyIds)
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
    `Production prerequisite integration test refused or failed: ${
      error instanceof Error ? error.message : "unexpected integration failure"
    }`,
  );
  process.exitCode = 1;
}
