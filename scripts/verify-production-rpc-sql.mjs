import { access, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const draftUrls = [
  new URL(
    "../supabase/manual/production_work_order_from_sales_order_rpc_draft.sql",
    import.meta.url,
  ),
  new URL(
    "../supabase/manual/production_route_operations_rpc_draft.sql",
    import.meta.url,
  ),
];

const drafts = [];
for (const url of draftUrls) {
  await access(url);
  drafts.push({
    path: fileURLToPath(url),
    sql: await readFile(url, "utf8"),
  });
}

const combinedSql = drafts.map(({ sql }) => sql).join("\n");
const checks = [];

for (const draft of drafts) {
  checks.push(
    {
      name: `${draft.path}: DRAFT ONLY marker`,
      passes: /DRAFT ONLY\. DO NOT RUN WITHOUT REVIEW\./i.test(draft.sql),
    },
    {
      name: `${draft.path}: SECURITY INVOKER`,
      passes: /\bSECURITY\s+INVOKER\b/i.test(draft.sql),
    },
    {
      name: `${draft.path}: no SECURITY DEFINER`,
      passes: !/\bSECURITY\s+DEFINER\b/i.test(draft.sql),
    },
    {
      name: `${draft.path}: no EXECUTE grant to anon`,
      passes:
        !/\bgrant\s+execute\s+on\s+function[\s\S]*?\bto\s+[^;]*\banon\b[^;]*;/i.test(
          draft.sql,
        ),
    },
    {
      name: `${draft.path}: revokes execution from PUBLIC`,
      passes:
        /\brevoke\s+all\s+on\s+function[\s\S]*?\bfrom\s+[^;]*\bpublic\b[^;]*;/i.test(
          draft.sql,
        ),
    },
  );
}

for (const tableName of [
  "public.sales_orders",
  "public.sales_order_items",
  "public.work_orders",
  "public.work_order_operations",
  "public.production_route_steps",
  "public.erp_audit_logs",
]) {
  checks.push({
    name: `references ${tableName}`,
    passes: combinedSql.includes(tableName),
  });
}

const failures = checks.filter(({ passes }) => !passes);

for (const check of checks) {
  console.log(`${check.passes ? "PASS" : "FAIL"}: ${check.name}`);
}

if (failures.length > 0) {
  console.error(
    `Production RPC SQL safety verification failed: ${failures.length} check(s) failed.`,
  );
  process.exitCode = 1;
} else {
  console.log("Production RPC SQL safety verification passed.");
}
