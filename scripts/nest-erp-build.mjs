import { cp, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const distDir = fileURLToPath(new URL("../dist/", import.meta.url));
const erpDir = join(distDir, "erp");

const topLevelEntries = (await readdir(distDir)).filter((name) => name !== "erp");

await Promise.all(
  topLevelEntries.map((name) => cp(join(distDir, name), join(erpDir, name), { recursive: true })),
);

console.log(`Nested ERP build created: dist/erp/ now mirrors dist/ (${topLevelEntries.length} entries copied).`);
