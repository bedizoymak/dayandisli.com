import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const sqlUrl = new URL(
  "../supabase/manual/inventory_movement_rpc_draft.sql",
  import.meta.url,
);
const sqlPath = fileURLToPath(sqlUrl);
const sql = await readFile(sqlUrl, "utf8");

const checks = [
  {
    name: "draft-only warning",
    passes: /DRAFT ONLY/i.test(sql),
  },
  {
    name: "SECURITY INVOKER",
    passes: /\bSECURITY\s+INVOKER\b/i.test(sql),
  },
  {
    name: "no SECURITY DEFINER",
    passes: !/\bSECURITY\s+DEFINER\b/i.test(sql),
  },
  {
    name: "no EXECUTE grant to anon",
    passes:
      !/\bgrant\s+execute\s+on\s+function[\s\S]*?\bto\s+[^;]*\banon\b[^;]*;/i.test(
        sql,
      ),
  },
  ...[
    "public.inventory_items",
    "public.inventory_movements",
    "public.warehouses",
    "public.erp_audit_logs",
  ].map((tableName) => ({
    name: `references ${tableName}`,
    passes: sql.includes(tableName),
  })),
];

const failures = checks.filter(({ passes }) => !passes);

for (const check of checks) {
  console.log(`${check.passes ? "PASS" : "FAIL"}: ${check.name}`);
}

if (failures.length > 0) {
  console.error(
    `Inventory RPC SQL safety verification failed for ${sqlPath}: ${failures.length} check(s) failed.`,
  );
  process.exitCode = 1;
} else {
  console.log(`Inventory RPC SQL safety verification passed for ${sqlPath}.`);
}
