import { execFileSync } from "node:child_process";

const PRODUCTION_REF = "meauutjsnnggzcigyvfp";
const PRODUCTION_NAME = "dayandisli.com";
const UNRELATED_NAME = "eclipsemuhendislik.com";
const STAGING_NAME = "dayandisli.com-staging";
const SAFE_FAILURE =
  "No approved dayandisli.com staging target is linked. No database operation was performed.";

function normalize(value) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function refuse(detail) {
  if (detail) console.error(`Staging preflight refused: ${detail}`);
  console.error(SAFE_FAILURE);
  process.exit(1);
}

function run(command, args) {
  try {
    return execFileSync(command, args, {
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

if (!run("supabase", ["--version"])) {
  refuse("Supabase CLI is unavailable.");
}

const target = normalize(process.env.SUPABASE_TARGET);
const allowPush = process.env.ALLOW_STAGING_DB_PUSH;
const declaredRef = normalize(process.env.SUPABASE_TARGET_PROJECT_REF);
const declaredName = normalize(process.env.SUPABASE_TARGET_PROJECT_NAME);

if (
  target !== "staging" ||
  allowPush !== "1" ||
  !declaredRef ||
  declaredName !== STAGING_NAME
) {
  refuse("Required staging identity variables are missing or invalid.");
}

if (
  declaredRef === PRODUCTION_REF ||
  declaredName === PRODUCTION_NAME ||
  declaredName === UNRELATED_NAME
) {
  refuse("Declared identity is prohibited.");
}

const projects = parseJson(
  run("supabase", ["projects", "list", "--output-format", "json"]),
);
if (!Array.isArray(projects)) {
  refuse("Linked project identity is not discoverable.");
}

const linked = projects.find(
  (project) => project?.linked === true || project?.is_linked === true,
);
const linkedRef = normalize(
  linked?.id ?? linked?.ref ?? linked?.project_ref ?? "",
);
const linkedName = normalize(linked?.name);

if (
  !linkedRef ||
  !linkedName ||
  linkedRef !== declaredRef ||
  linkedName !== STAGING_NAME ||
  linkedRef === PRODUCTION_REF ||
  linkedName === PRODUCTION_NAME ||
  linkedName === UNRELATED_NAME
) {
  refuse("The linked project is not the approved staging identity.");
}

if (!run(process.execPath, ["scripts/check-supabase-target-safety.mjs"])) {
  refuse("The repository target-safety check did not pass.");
}

if (!run("supabase", ["migration", "list", "--linked"])) {
  refuse("The linked staging migration list could not be inspected.");
}

console.log(
  `Staging preflight passed: ${STAGING_NAME} (${linkedRef}) is linked and its migration list is readable.`,
);
console.log("No database operation was performed.");
