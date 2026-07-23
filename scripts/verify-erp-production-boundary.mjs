import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const root = "dist/erp";
const files = [];
const walk = (directory) => {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith(".js")) files.push(path);
  }
};
walk(root);

const canonicalChunks = files.filter((path) => {
  const source = readFileSync(path, "utf8");
  return source.includes("data-provider") || source.includes("Senkronizasyon tamamlandı");
});
if (!canonicalChunks.length) {
  throw new Error("Canonical ERP production chunks could not be identified.");
}

const forbiddenDemoMarkers = [
  "Atlas Makine Sanayi",
  "TKL-2026-0092",
  "Marmara Metal A.Ş.",
  "Redüktör Modernizasyonu",
  "₺3.340.000",
];
for (const path of canonicalChunks) {
  const source = readFileSync(path, "utf8");
  for (const marker of forbiddenDemoMarkers) {
    if (source.includes(marker)) {
      throw new Error(`Demo fixture marker leaked into canonical ERP chunk ${path}: ${marker}`);
    }
  }
}

console.log(`ERP production boundary safeguard passed (${canonicalChunks.length} canonical chunks scanned).`);
