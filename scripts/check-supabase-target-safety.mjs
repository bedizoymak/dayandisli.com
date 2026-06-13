import { execFileSync } from "node:child_process";

const PRODUCTION_PROJECT_REF = "meauutjsnnggzcigyvfp";
const PRODUCTION_PROJECT_NAME = "dayandisli.com";
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function fail(message) {
  console.error(`Supabase target check failed: ${message}`);
  process.exit(1);
}

function runSupabase(args) {
  try {
    return execFileSync("supabase", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });
  } catch {
    return null;
  }
}

function parseJson(output) {
  if (!output) return null;

  try {
    return JSON.parse(output);
  } catch {
    return null;
  }
}

function normalize(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function hostFromUrl(value) {
  if (!value) return null;

  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function isProduction(ref, name) {
  return (
    normalize(ref) === PRODUCTION_PROJECT_REF ||
    normalize(name) === PRODUCTION_PROJECT_NAME
  );
}

function getLocalApiHost() {
  const explicitHost = hostFromUrl(process.env.SUPABASE_TARGET_URL);
  if (explicitHost && LOCAL_HOSTS.has(explicitHost)) return explicitHost;

  const status = parseJson(runSupabase(["status", "-o", "json"]));
  const apiUrl = status?.API_URL ?? status?.api_url;
  const statusHost = hostFromUrl(apiUrl);
  return statusHost && LOCAL_HOSTS.has(statusHost) ? statusHost : null;
}

function getLinkedProject() {
  const projects = parseJson(runSupabase(["projects", "list", "--output", "json"]));
  if (!Array.isArray(projects)) return null;

  const linked = projects.find(
    (project) => project?.linked === true || project?.is_linked === true,
  );
  if (!linked) return null;

  return {
    ref: linked.id ?? linked.ref ?? linked.project_ref ?? "",
    name: linked.name ?? "",
  };
}

const requestedTarget = normalize(process.env.SUPABASE_TARGET);
const envRef = process.env.SUPABASE_TARGET_PROJECT_REF ?? "";
const envName = process.env.SUPABASE_TARGET_PROJECT_NAME ?? "";

if (isProduction(envRef, envName)) {
  fail("the configured target matches the known production project.");
}

if (requestedTarget === "production") {
  fail("production targets are never authorized by this preflight.");
}

if (requestedTarget && requestedTarget !== "local" && requestedTarget !== "staging") {
  fail('SUPABASE_TARGET must be either "local" or "staging".');
}

if (requestedTarget === "staging") {
  if (process.env.ALLOW_STAGING_DB_PUSH !== "1") {
    fail("staging requires ALLOW_STAGING_DB_PUSH=1.");
  }

  const linkedProject = getLinkedProject();
  if (!linkedProject && (!envRef || !envName)) {
    fail("the linked staging project identity could not be verified.");
  }

  const projectRef = linkedProject?.ref || envRef;
  const projectName = linkedProject?.name || envName;

  if (isProduction(projectRef, projectName)) {
    fail("the linked project is the known production project.");
  }

  if (envRef && linkedProject?.ref && normalize(envRef) !== normalize(linkedProject.ref)) {
    fail("SUPABASE_TARGET_PROJECT_REF does not match the linked project.");
  }

  if (envName && linkedProject?.name && normalize(envName) !== normalize(linkedProject.name)) {
    fail("SUPABASE_TARGET_PROJECT_NAME does not match the linked project.");
  }

  if (!projectRef || !projectName) {
    fail("both the staging project ref and name must be verifiable.");
  }

  console.log("Supabase target check passed: explicit non-production staging target verified.");
  process.exit(0);
}

const localHost = getLocalApiHost();
if (!localHost) {
  fail(
    "no verified local target was found; set SUPABASE_TARGET=staging and ALLOW_STAGING_DB_PUSH=1 for staging.",
  );
}

console.log(
  `Supabase target check passed: local target verified at ${localHost}. This does not authorize a linked db push.`,
);
