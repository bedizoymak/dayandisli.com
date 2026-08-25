// PHASE 4/15 architecture guard: exactly ONE Supabase browser client may be
// created, in the canonical module. This is a static-source scan over src/
// (same style as server/parasut/no-unbounded-select.test.ts): any new
// `createClient(` call outside the canonical file fails here. The canonical
// file itself creates the single shared instance (with a degraded-mode
// Proxy when env vars are missing); @supabase/ssr factories are not used by
// this SPA and were removed during the 2026-08 remediation.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const CANONICAL = "integrations/supabase/client.ts";

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) files.push(...listSourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry) && !/\.(test|spec)\./.test(entry)) files.push(full);
  }
  return files;
}

describe("architecture: single canonical Supabase client", () => {
  it("no source file outside the canonical module calls createClient / createBrowserClient / createServerClient", () => {
    const srcDir = join(__dirname, "..");
    const violations: string[] = [];
    for (const file of listSourceFiles(srcDir)) {
      const rel = file.replace(/\\/g, "/").split("/src/")[1];
      if (rel === CANONICAL) continue;
      const source = readFileSync(file, "utf-8");
      if (/createClient\s*\(|createBrowserClient\s*\(|createServerClient\s*\(/.test(source)) {
        violations.push(rel);
      }
    }
    expect(violations).toEqual([]);
  });

  it("the deprecated alias lib/supabase.ts re-exports the canonical instance rather than constructing its own", () => {
    const aliasPath = join(__dirname, "supabase.ts");
    let exists = true;
    try {
      statSync(aliasPath);
    } catch {
      exists = false;
    }
    if (!exists) return; // alias already removed with its legacy consumers — guard satisfied
    const source = readFileSync(aliasPath, "utf-8");
    expect(source).toMatch(/from ["']@\/integrations\/supabase\/client["']/);
    expect(source).not.toMatch(/createClient\s*\(/);
    expect(source).toMatch(/@deprecated/);
  });
});
