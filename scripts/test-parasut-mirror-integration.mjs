import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const PRODUCTION_REF = "meauutjsnnggzcigyvfp";
const PRODUCTION_NAME = "dayandisli.com";
const REQUIRED_TABLES = [
  "parasut_sync_runs",
  "parasut_contacts",
  "parasut_products",
  "parasut_sales_invoices",
  "parasut_sales_invoice_details",
  "parasut_purchase_bills",
  "parasut_purchase_bill_details",
  "parasut_payments",
  "parasut_accounts",
  "parasut_sync_errors",
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
  const containers = output
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  assert(containers.length === 1, "exactly one local Supabase database container is required");
  return containers[0];
}

function queryLocal(container, sql) {
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
      "-At",
    ],
    {
      input: sql,
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    },
  ).trim();
}

async function createLocalUser(admin, prefix) {
  const email = `${prefix}-${randomUUID()}@example.invalid`;
  const password = `Mirror-${randomUUID()}-Aa1!`;
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
  if (error) throw new Error(`test sign-in failed: ${safeError(error)}`);
  return client;
}

async function run() {
  if (process.env.RUN_PARASUT_MIRROR_INTEGRATION !== "1") {
    throw new Error("set RUN_PARASUT_MIRROR_INTEGRATION=1 to opt in");
  }

  if (
    process.env.SUPABASE_PROJECT_REF?.trim() === PRODUCTION_REF ||
    process.env.SUPABASE_PROJECT_NAME?.trim().toLowerCase() === PRODUCTION_NAME
  ) {
    throw new Error("production project identifiers are prohibited");
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
  const tableCount = Number(
    queryLocal(
      container,
      `
        select count(*)
        from information_schema.tables
        where table_schema = 'public'
          and table_name in (${REQUIRED_TABLES.map((name) => `'${name}'`).join(", ")});
      `,
    ),
  );
  assert(tableCount === REQUIRED_TABLES.length, "all mirror tables must exist");
  console.log("PASS: clean migration application produced all required mirror tables");

  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
  const anon = createClient(status.API_URL, status.ANON_KEY, options);
  const code = randomUUID().replaceAll("-", "").slice(0, 10).toUpperCase();
  const created = {
    userIds: [],
    companyIds: [],
    membershipIds: [],
    erpUserIds: [],
    contactIds: [],
  };
  const clients = [];

  try {
    const companyAdminUser = await createLocalUser(admin, "mirror-company-admin");
    const branchUser = await createLocalUser(admin, "mirror-branch");
    const otherAdminUser = await createLocalUser(admin, "mirror-other-admin");
    const repositoryAdminUser = await createLocalUser(admin, "mirror-repository-admin");
    created.userIds.push(
      companyAdminUser.id,
      branchUser.id,
      otherAdminUser.id,
      repositoryAdminUser.id,
    );

    const { data: companies, error: companiesError } = await admin
      .from("companies")
      .insert([
        { code: `PM${code}`, legal_name: `Mirror ${code}` },
        { code: `PX${code}`, legal_name: `Mirror Other ${code}` },
      ])
      .select("id");
    if (companiesError) throw new Error(`company creation failed: ${safeError(companiesError)}`);
    const [company, otherCompany] = companies;
    created.companyIds.push(company.id, otherCompany.id);

    const { data: branch, error: branchError } = await admin
      .from("company_branches")
      .insert({ company_id: company.id, code: `B${code}`, name: "Mirror Branch" })
      .select("id")
      .single();
    if (branchError) throw new Error(`branch creation failed: ${safeError(branchError)}`);

    const { data: memberships, error: membershipsError } = await admin
      .from("company_memberships")
      .insert([
        {
          company_id: company.id,
          branch_id: null,
          auth_user_id: companyAdminUser.id,
          email: companyAdminUser.email,
          role: "admin",
          is_company_admin: true,
          is_active: true,
        },
        {
          company_id: company.id,
          branch_id: branch.id,
          auth_user_id: branchUser.id,
          email: branchUser.email,
          role: "admin",
          is_company_admin: true,
          is_active: true,
        },
        {
          company_id: otherCompany.id,
          branch_id: null,
          auth_user_id: otherAdminUser.id,
          email: otherAdminUser.email,
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

    const { data: repositoryAdmin, error: repositoryAdminError } = await admin
      .from("erp_users")
      .insert({
        auth_user_id: repositoryAdminUser.id,
        email: repositoryAdminUser.email,
        full_name: "Synthetic Repository Administrator",
        role: "admin",
        roles: ["admin"],
        permissions: ["system.manage"],
        is_active: true,
      })
      .select("id")
      .single();
    if (repositoryAdminError) {
      throw new Error(`repository admin creation failed: ${safeError(repositoryAdminError)}`);
    }
    created.erpUserIds.push(repositoryAdmin.id);

    const baseContact = {
      company_id: company.id,
      parasut_company_id: `local-${code}`,
      resource_type: "contacts",
      attributes: { archived: false, marker: "synthetic" },
      relationships: { category: { data: null }, contact_people: { data: [] } },
      included: [],
      raw_payload: {
        type: "contacts",
        attributes: { archived: false, marker: "synthetic" },
        relationships: { category: { data: null }, contact_people: { data: [] } },
      },
      payload_hash: `hash-${code}`,
    };

    const { data: contacts, error: contactsError } = await admin
      .from("parasut_contacts")
      .insert([
        { ...baseContact, parasut_id: `contact-${code}-1` },
        { ...baseContact, parasut_id: `contact-${code}-2` },
      ])
      .select("id, parasut_id, attributes, relationships, included");
    if (contactsError) throw new Error(`mirror insert failed: ${safeError(contactsError)}`);
    created.contactIds.push(...contacts.map(({ id }) => id));
    assert(contacts.length === 2, "separate source IDs with identical payloads must remain separate");
    assert(contacts[0].relationships.category.data === null, "null relationship must round-trip");
    assert(Array.isArray(contacts[0].included), "included JSONB array must round-trip");
    console.log("PASS: separate IDs and JSONB/null relationships are preserved");

    const duplicate = await admin.from("parasut_contacts").insert({
      ...baseContact,
      parasut_id: `contact-${code}-1`,
    });
    assert(duplicate.error?.code === "23505", "duplicate external identity must be rejected");
    console.log("PASS: external identity uniqueness is enforced");

    const companyAdminClient = await signIn(status.API_URL, status.ANON_KEY, companyAdminUser);
    const branchClient = await signIn(status.API_URL, status.ANON_KEY, branchUser);
    const otherAdminClient = await signIn(status.API_URL, status.ANON_KEY, otherAdminUser);
    const repositoryAdminClient = await signIn(
      status.API_URL,
      status.ANON_KEY,
      repositoryAdminUser,
    );
    clients.push(companyAdminClient, branchClient, otherAdminClient, repositoryAdminClient);

    const allowedRead = await companyAdminClient
      .from("parasut_contacts")
      .select("id")
      .in("id", created.contactIds);
    assert(!allowedRead.error && allowedRead.data.length === 2, "company admin read must succeed");

    const repositoryAdminRead = await repositoryAdminClient
      .from("parasut_contacts")
      .select("id")
      .in("id", created.contactIds);
    assert(
      !repositoryAdminRead.error && repositoryAdminRead.data.length === 2,
      "active repository admin read must succeed",
    );

    const branchRead = await branchClient
      .from("parasut_contacts")
      .select("id")
      .in("id", created.contactIds);
    assert(!branchRead.error && branchRead.data.length === 0, "branch member read must be denied");

    const crossCompanyRead = await otherAdminClient
      .from("parasut_contacts")
      .select("id")
      .in("id", created.contactIds);
    assert(
      !crossCompanyRead.error && crossCompanyRead.data.length === 0,
      "cross-company read must be denied",
    );

    const anonymousRead = await anon
      .from("parasut_contacts")
      .select("id")
      .in("id", created.contactIds);
    assert(
      anonymousRead.error || anonymousRead.data?.length === 0,
      "anonymous read must be denied",
    );

    const browserWrite = await companyAdminClient.from("parasut_contacts").insert({
      ...baseContact,
      parasut_id: `contact-${code}-browser`,
    });
    assert(browserWrite.error, "authenticated browser write must be denied");
    console.log("PASS: RLS allows approved reads and denies branch, cross-company, anon, and writes");

    const policySummary = queryLocal(
      container,
      `
        select count(*)
        from pg_policies
        where schemaname = 'public'
          and tablename in (${REQUIRED_TABLES.map((name) => `'${name}'`).join(", ")})
          and cmd <> 'SELECT';
      `,
    );
    assert(Number(policySummary) === 0, "mirror tables must have no write policies");
  } finally {
    for (const client of clients) await client.auth.signOut();

    if (created.contactIds.length > 0) {
      await admin.from("parasut_contacts").delete().in("id", created.contactIds);
    }
    if (created.membershipIds.length > 0) {
      await admin.from("company_memberships").delete().in("id", created.membershipIds);
    }
    if (created.erpUserIds.length > 0) {
      await admin.from("erp_users").delete().in("id", created.erpUserIds);
    }
    if (created.companyIds.length > 0) {
      await admin.from("companies").delete().in("id", created.companyIds);
    }
    for (const userId of created.userIds) {
      await admin.auth.admin.deleteUser(userId);
    }

    const cleanup = created.contactIds.length
      ? await admin
          .from("parasut_contacts")
          .select("id", { count: "exact", head: true })
          .in("id", created.contactIds)
      : { count: 0, error: null };
    assert(!cleanup.error && cleanup.count === 0, "mirror cleanup verification failed");
    console.log("PASS: integration cleanup removed all synthetic mirror rows");
  }
}

try {
  await run();
} catch (error) {
  console.error(
    `Paraşüt mirror integration test refused or failed: ${
      error instanceof Error ? error.message : "unexpected integration failure"
    }`,
  );
  process.exitCode = 1;
}
