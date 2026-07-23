import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outputDirectory = fileURLToPath(new URL("../dist/erp/", import.meta.url));
const forbidden = [
  "INV-DEMO-2026-001",
  "[DEMO] Atlas Makina",
  "[DEMO] İsil Fason",
  "PARASUT_CLIENT_SECRET",
  "PARASUT_PASSWORD",
  "SUPABASE_SERVICE_ROLE_KEY",
];

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  }));
  return nested.flat();
}

const bundleFiles = (await filesUnder(outputDirectory)).filter((file) =>
  [".html", ".js", ".css"].includes(extname(file)),
);
const violations = [];

for (const file of bundleFiles) {
  const contents = await readFile(file, "utf8");
  for (const marker of forbidden) {
    if (contents.includes(marker)) violations.push(`${marker} in ${file}`);
  }
}

if (violations.length > 0) {
  throw new Error(`Production bundle contains forbidden data or secrets:\n${violations.join("\n")}`);
}

console.log(`Production bundle safeguard passed (${bundleFiles.length} files scanned).`);
