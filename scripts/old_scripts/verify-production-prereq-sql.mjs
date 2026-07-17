import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const drafts = {
  operations: "supabase/manual/work_order_operations_rls_prereq_draft.sql",
  predicates: "supabase/manual/tenant_policy_predicate_corrections_draft.sql",
  uniqueness: "supabase/manual/work_orders_sales_order_unique_draft.sql",
};
const migrationPath =
  "supabase/migrations/20260613052204_production_rpc_rls_prerequisites.sql";
const manualIndexPath =
  "supabase/manual/work_orders_sales_order_unique_concurrent_index.sql";

const failures = [];
const contents = {};

for (const [name, relativePath] of Object.entries(drafts)) {
  try {
    const sql = await readFile(path.join(root, relativePath), "utf8");
    contents[name] = sql;

    if (!sql.includes("DRAFT ONLY")) {
      failures.push(`${relativePath}: missing DRAFT ONLY marker`);
    }
    if (/security\s+definer/i.test(sql)) {
      failures.push(`${relativePath}: elevated function execution is forbidden`);
    }
    if (/grant\s+execute\b[\s\S]*?\bto\s+anon\b/i.test(sql)) {
      failures.push(`${relativePath}: execution must not be granted to anon`);
    }
  } catch (error) {
    failures.push(`${relativePath}: ${error.message}`);
  }
}

const operations = contents.operations ?? "";
if (!/work_order_operations/i.test(operations)) {
  failures.push("operation policy draft must reference work_order_operations");
}
if (!/from\s+public\.work_orders\s+as\s+parent_work_order/i.test(operations)) {
  failures.push("operation policy draft must derive access through work_orders");
}
if (!/to\s+authenticated/i.test(operations)) {
  failures.push("operation policy draft must target authenticated users");
}

const predicates = contents.predicates ?? "";
if (/\bcm\.company_id\s*=\s*cm\.company_id\b/i.test(predicates)) {
  failures.push("predicate correction draft contains the known ambiguous predicate");
}
if (!/membership\.company_id\s*=\s*(sales_orders|work_orders)\.company_id/i.test(predicates)) {
  failures.push("predicate correction draft lacks explicit target qualification");
}

const uniqueness = contents.uniqueness ?? "";
const duplicateCheckPosition = uniqueness.search(/having\s+count\(\*\)\s*>\s*1/i);
const indexPosition = uniqueness.search(/create\s+unique\s+index\s+concurrently/i);
if (duplicateCheckPosition < 0 || indexPosition < 0 || duplicateCheckPosition > indexPosition) {
  failures.push("uniqueness draft must check duplicates before creating the index");
}
if (!/where\s+sales_order_id\s+is\s+not\s+null/i.test(
  indexPosition >= 0 ? uniqueness.slice(indexPosition) : "",
)) {
  failures.push("uniqueness index must be partial for non-null sales_order_id");
}

let migration = "";
let manualIndex = "";
try {
  migration = await readFile(path.join(root, migrationPath), "utf8");
} catch (error) {
  failures.push(`${migrationPath}: ${error.message}`);
}
try {
  manualIndex = await readFile(path.join(root, manualIndexPath), "utf8");
} catch (error) {
  failures.push(`${manualIndexPath}: ${error.message}`);
}

if (/\bconcurrently\b/i.test(migration)) {
  failures.push(`${migrationPath}: normal migration must not contain concurrently`);
}
if (/security\s+definer/i.test(migration)) {
  failures.push(`${migrationPath}: elevated function execution is forbidden`);
}
if (/\bgrant\b[\s\S]*?\bto\s+anon\b/i.test(migration)) {
  failures.push(`${migrationPath}: grants to anon are forbidden`);
}
for (const table of [
  "work_order_operations",
  "sales_orders",
  "work_orders",
  "erp_audit_logs",
]) {
  if (!migration.includes(table)) {
    failures.push(`${migrationPath}: missing scoped table ${table}`);
  }
}
if (/\bcm\.company_id\s*=\s*cm\.company_id\b/i.test(migration)) {
  failures.push(`${migrationPath}: contains the known ambiguous predicate`);
}

if (!manualIndex.includes(
  "-- MANUAL PRODUCTION STEP. RUN ONLY AFTER DUPLICATE CHECK PASSES.",
)) {
  failures.push(`${manualIndexPath}: missing manual production warning`);
}
const manualDuplicatePosition = manualIndex.search(/having\s+count\(\*\)\s*>\s*1/i);
const manualIndexPosition = manualIndex.search(
  /create\s+unique\s+index\s+concurrently/i,
);
if (
  manualDuplicatePosition < 0 ||
  manualIndexPosition < 0 ||
  manualDuplicatePosition > manualIndexPosition
) {
  failures.push(`${manualIndexPath}: duplicate check must precede concurrent index`);
}
if (!/where\s+sales_order_id\s+is\s+not\s+null/i.test(
  manualIndexPosition >= 0 ? manualIndex.slice(manualIndexPosition) : "",
)) {
  failures.push(`${manualIndexPath}: index must be partial for non-null sales_order_id`);
}

if (failures.length > 0) {
  console.error("Production prerequisite SQL verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exitCode = 1;
} else {
  console.log("Production prerequisite SQL verification passed.");
}
