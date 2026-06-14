import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const PRODUCTION_REF = "meauutjsnnggzcigyvfp";
const PRODUCTION_NAME = "dayandisli.com";
const OPT_IN = "RUN_LOCAL_AUTH_TESTS";

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
  );
}

function assertLocalTarget(status) {
  assert(process.env[OPT_IN] === "1", `set ${OPT_IN}=1 to opt in`);
  for (const value of [
    status.API_URL,
    status.DB_URL,
    process.env.SUPABASE_PROJECT_REF,
    process.env.SUPABASE_PROJECT_NAME,
  ]) {
    const normalized = String(value ?? "").toLowerCase();
    assert(!normalized.includes(PRODUCTION_REF), "production project reference is prohibited");
    assert(!normalized.includes(PRODUCTION_NAME), "production project name is prohibited");
  }
  for (const rawUrl of [status.API_URL, status.DB_URL]) {
    const hostname = new URL(rawUrl).hostname;
    assert(
      hostname === "127.0.0.1" || hostname === "localhost",
      "Supabase target must be localhost or 127.0.0.1",
    );
  }
}

async function createAuthUser(admin, label) {
  const email = `auth3-${label}-${randomUUID()}@example.invalid`;
  const password = `Local-${randomUUID()}-Aa1!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`local Auth user creation failed: ${safeError(error)}`);
  return { id: data.user.id, email, password };
}

async function signIn(status, user) {
  const client = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email: user.email,
    password: user.password,
  });
  if (error) throw new Error(`local sign-in failed: ${safeError(error)}`);
  return client;
}

async function run() {
  const status = localStatus();
  assertLocalTarget(status);
  const container = localDatabaseContainer();
  const options = {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  };
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
  const anon = createClient(status.API_URL, status.ANON_KEY, options);
  const users = [];
  const clients = [];
  const erpUserIds = [];

  try {
    const owner = await createAuthUser(admin, "owner");
    const bootstrap = await createAuthUser(admin, "bootstrap");
    const inactive = await createAuthUser(admin, "inactive");
    const unregistered = await createAuthUser(admin, "unregistered");
    const manager = await createAuthUser(admin, "manager");
    users.push(owner, bootstrap, inactive, unregistered, manager);

    const fixtures = [
      {
        auth_user_id: owner.id,
        email: owner.email,
        full_name: "Local Owner",
        role: "viewer",
        roles: [],
        permissions: [],
        is_active: true,
      },
      {
        auth_user_id: null,
        email: bootstrap.email.toUpperCase(),
        full_name: "Local Bootstrap",
        role: "viewer",
        roles: [],
        permissions: [],
        is_active: true,
      },
      {
        auth_user_id: inactive.id,
        email: inactive.email,
        full_name: "Local Inactive",
        role: "viewer",
        roles: [],
        permissions: [],
        is_active: false,
      },
      {
        auth_user_id: manager.id,
        email: manager.email,
        full_name: "Local Manager",
        role: "viewer",
        roles: ["admin"],
        permissions: ["users.edit"],
        is_active: true,
      },
    ];
    const { data: rows, error: insertError } = await admin
      .from("erp_users")
      .insert(fixtures)
      .select("id,email");
    if (insertError) throw new Error(`ERP-user fixture creation failed: ${safeError(insertError)}`);
    erpUserIds.push(...rows.map(({ id }) => id));

    const ownerClient = await signIn(status, owner);
    const bootstrapClient = await signIn(status, bootstrap);
    const inactiveClient = await signIn(status, inactive);
    const unregisteredClient = await signIn(status, unregistered);
    const managerClient = await signIn(status, manager);
    clients.push(
      ownerClient,
      bootstrapClient,
      inactiveClient,
      unregisteredClient,
      managerClient,
    );

    let result = await ownerClient.from("erp_users").select("id,email");
    assert(!result.error && result.data.length === 1, "active UUID-linked self-read must succeed");
    assert(result.data[0].email === owner.email, "UUID-linked self-read returned another user");

    result = await bootstrapClient.from("erp_users").select("id,email");
    assert(
      !result.error && result.data.length === 1,
      "active null-linked normalized email self-read must succeed",
    );
    assert(
      result.data[0].email.toLowerCase() === bootstrap.email,
      "email bootstrap returned another user",
    );

    result = await inactiveClient.from("erp_users").select("id");
    assert(!result.error && result.data.length === 0, "inactive ERP user must be denied");
    result = await unregisteredClient.from("erp_users").select("id");
    assert(!result.error && result.data.length === 0, "unregistered Auth user must be denied");

    result = await ownerClient.from("erp_users").select("id").eq("id", erpUserIds[1]);
    assert(!result.error && result.data.length === 0, "cross-user ERP profile must be hidden");
    result = await anon.from("erp_users").select("id");
    assert(result.error || result.data?.length === 0, "anonymous ERP-user access must be denied");

    for (const operation of [
      () => ownerClient.from("erp_users").insert({
        email: `blocked-${randomUUID()}@example.invalid`,
        full_name: "Blocked",
        role: "viewer",
      }),
      () => ownerClient.from("erp_users").update({ role: "admin" }).eq("id", erpUserIds[0]),
      () => ownerClient.from("erp_users").delete().eq("id", erpUserIds[0]),
    ]) {
      const mutation = await operation();
      assert(Boolean(mutation.error), "ordinary browser write must be denied");
    }

    result = await managerClient.from("erp_users").select("id");
    assert(
      !result.error &&
        erpUserIds.every((id) => result.data.some((row) => row.id === id)),
      "ERP admin management read must use role, roles, or permissions",
    );

    const policyDependencies = runLocalSql(
      container,
      `
        select count(*)
        from pg_policies
        where coalesce(qual, '') ~* '(admin_users|allowed_emails|is_email_allowed)'
           or coalesce(with_check, '') ~* '(admin_users|allowed_emails|is_email_allowed)';
      `,
    ).trim();
    assert(policyDependencies === "0", "effective policies retain legacy authorization dependencies");

    console.log("PASS: unified ERP-user RLS scenarios and policy dependency gate");
  } finally {
    for (const client of clients) await client.auth.signOut();
    if (erpUserIds.length > 0) {
      await admin.from("erp_users").delete().in("id", erpUserIds);
    }
    for (const user of users) await admin.auth.admin.deleteUser(user.id);

    const { count, error } = erpUserIds.length
      ? await admin
          .from("erp_users")
          .select("id", { count: "exact", head: true })
          .in("id", erpUserIds)
      : { count: 0, error: null };
    assert(!error && count === 0, "local ERP-user fixture cleanup failed");
    console.log("PASS: local auth integration cleanup removed all synthetic rows");
  }
}

try {
  await run();
} catch (error) {
  console.error(
    `Local unified-auth integration refused or failed: ${
      error instanceof Error ? error.message : "unexpected integration failure"
    }`,
  );
  process.exitCode = 1;
}
