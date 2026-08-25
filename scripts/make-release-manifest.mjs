// PHASE 14: produce the immutable release record for a built dist/.
// Run AFTER `npm run build` and BEFORE uploading. Never rebuild between
// manifest creation and deploy (the manifest pins exactly what ships).
import { createHash } from "node:crypto";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = join(process.cwd(), "dist");
const OUT = join(DIST, "release-manifest.json");

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...walk(full));
    else files.push(full);
  }
  return files;
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function safeExec(command) {
  try {
    return execSync(command, { encoding: "utf8" }).trim();
  } catch {
    return null;
  }
}

const files = walk(DIST)
  .filter((file) => relative(DIST, file).replace(/\\/g, "/") !== "release-manifest.json")
  .sort()
  .map((file) => ({
    path: relative(DIST, file).replace(/\\/g, "/"),
    bytes: statSync(file).size,
    sha256: sha256(file),
  }));

const commit = safeExec("git rev-parse HEAD") ?? "unknown";
const dirtyStatus = safeExec("git status --porcelain");
const dirty = dirtyStatus !== null && dirtyStatus.length > 0;

const manifest = {
  generated_at: new Date().toISOString(),
  commit,
  working_tree_dirty_at_build: dirty,
  node: process.version,
  npm: safeExec("npm --version"),
  file_count: files.length,
  files,
};

writeFileSync(OUT, JSON.stringify(manifest, null, 2));
console.log(
  `Release manifest written: ${OUT} (${files.length} files, commit ${commit}${dirty ? ", DIRTY TREE" : ""})`,
);
if (dirty) {
  console.warn("WARNING: working tree was dirty at manifest time — releases should be built from clean commits.");
}
