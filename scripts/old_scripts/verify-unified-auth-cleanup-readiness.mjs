import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LEGACY_PATTERN = /\b(admin_users|allowed_emails|is_email_allowed)\b/i;
const PRODUCTION_REF = "meauutjsnnggzcigyvfp";
const PRODUCTION_NAME = "dayandisli.com";
const RUNTIME_PATHS = ["src", "server", "supabase/functions"];
const GENERATED_TYPES = resolve("src/integrations/supabase/types.ts");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function command(name, args) {
  return execFileSync(name, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
}

function runtimeFiles() {
  const output = command("rg", [
    "--files",
    ...RUNTIME_PATHS,
    "-g",
    "!**/*.test.ts",
    "-g",
    "!**/*.test.tsx",
    "-g",
    "!src/integrations/supabase/types.ts",
  ]);
  return output.split(/\r?\n/).filter(Boolean);
}

function assertRuntimeClean() {
  const findings = [];
  for (const file of runtimeFiles()) {
    const source = readFileSync(resolve(file), "utf8");
    if (LEGACY_PATTERN.test(source)) findings.push(file);
  }
  assert(
    findings.length === 0,
    `runtime legacy authorization references remain: ${findings.join(", ")}`,
  );
}

function localStatus() {
  const status = JSON.parse(command("supabase", ["status", "-o", "json"]));
  for (const rawUrl of [status.API_URL, status.DB_URL]) {
    const normalized = String(rawUrl).toLowerCase();
    const hostname = new URL(rawUrl).hostname;
    assert(
      hostname === "127.0.0.1" || hostname === "localhost",
      "cleanup readiness requires a local Supabase target",
    );
    assert(!normalized.includes(PRODUCTION_REF), "production project reference is prohibited");
    assert(!normalized.includes(PRODUCTION_NAME), "production project name is prohibited");
  }
  return status;
}

function localContainer() {
  const containers = command("docker", [
    "ps",
    "--filter",
    "name=supabase_db_",
    "--format",
    "{{.Names}}",
  ])
    .split(/\r?\n/)
    .map((value) => value.trim())
    .filter(Boolean);
  assert(containers.length === 1, "exactly one local Supabase database container is required");
  return containers[0];
}

function catalogDependencyCount(container) {
  const sql = `
    with policy_dependencies as (
      select 'policy' as kind, schemaname || '.' || tablename || '.' || policyname as identity
      from pg_policies
      where coalesce(qual, '') ~* '(admin_users|allowed_emails|is_email_allowed)'
         or coalesce(with_check, '') ~* '(admin_users|allowed_emails|is_email_allowed)'
    ),
    view_dependencies as (
      select 'view', schemaname || '.' || viewname
      from pg_views
      where schemaname not in ('pg_catalog', 'information_schema')
        and definition ~* '(admin_users|allowed_emails|is_email_allowed)'
    ),
    function_dependencies as (
      select 'function', n.nspname || '.' || p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname not in ('pg_catalog', 'information_schema')
        and p.prokind in ('f', 'p')
        and not (n.nspname = 'public' and p.proname = 'is_email_allowed')
        and pg_get_functiondef(p.oid) ~* '(admin_users|allowed_emails|is_email_allowed)'
    ),
    trigger_dependencies as (
      select 'trigger', n.nspname || '.' || c.relname || '.' || t.tgname
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where not t.tgisinternal
        and pg_get_triggerdef(t.oid) ~* '(admin_users|allowed_emails|is_email_allowed)'
    ),
    dependencies as (
      select * from policy_dependencies
      union all select * from view_dependencies
      union all select * from function_dependencies
      union all select * from trigger_dependencies
    )
    select count(*) from dependencies;
  `;
  return command("docker", [
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
    "-Atc",
    sql,
  ]).trim();
}

function run() {
  assertRuntimeClean();
  const generatedTypesContainLegacyObjects = LEGACY_PATTERN.test(
    readFileSync(GENERATED_TYPES, "utf8"),
  );
  if (process.env.RUN_LOCAL_AUTH_TESTS !== "1") {
    throw new Error("set RUN_LOCAL_AUTH_TESTS=1 to inspect local cleanup readiness");
  }
  localStatus();
  const dependencyCount = catalogDependencyCount(localContainer());
  assert(dependencyCount === "0", `legacy catalog dependencies remain: ${dependencyCount}`);
  if (generatedTypesContainLegacyObjects) {
    console.log("INFO: generated types still contain legacy objects before cleanup");
  }
  console.log("PASS: runtime and local catalog cleanup readiness gates");
}

try {
  run();
} catch (error) {
  console.error(
    `Unified-auth cleanup readiness refused or failed: ${
      error instanceof Error ? error.message : "unexpected readiness failure"
    }`,
  );
  process.exitCode = 1;
}
