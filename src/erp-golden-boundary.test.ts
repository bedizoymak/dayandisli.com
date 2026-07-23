import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const demoRoot = "src/features/ebru-demo";
const productionRoot = "src/features/ebru-preview";
const goldenDigest = "d8f781c89964c8e89d5b9f971d9f3ccf94956481c5d55ef3e963d0f4a270a7c3";

function filesUnder(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) visit(path);
      else files.push(path);
    }
  };
  visit(root);
  return files.sort();
}

function sourceUnder(root: string) {
  return filesUnder(root)
    .filter((path) => /\.(?:ts|tsx|css)$/.test(path))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
}

describe("golden demo and canonical production boundary", () => {
  it("keeps every golden demo byte unchanged", () => {
    const hash = createHash("sha256");
    for (const path of filesUnder(demoRoot)) {
      hash.update(path.replaceAll("\\", "/"));
      hash.update("\0");
      hash.update(readFileSync(path));
      hash.update("\0");
    }
    expect(hash.digest("hex")).toBe(goldenDigest);
  });

  it("keeps live repositories, hooks, and Paraşüt code out of the demo", () => {
    const demo = sourceUnder(demoRoot);
    expect(demo).not.toMatch(/@\/features\/erp|@\/integrations\/supabase|ERPAuthContext|useParasut|callParasut|supabase/i);
  });

  it("keeps demo modules and fixture imports out of canonical production", () => {
    const production = sourceUnder(productionRoot);
    expect(production).not.toMatch(/from\s+["'][^"']*ebru-demo|import\(["'][^"']*ebru-demo/i);
    for (const marker of [
      "Atlas Makine",
      "Marmara Metal",
      "TKL-2026-",
      "UE-2026-",
      "Redüktör Modernizasyonu",
      "₺3.340.000",
      "₺8,42M",
    ]) {
      expect(production).not.toContain(marker);
    }
  });

  it("does not route canonical pages into the demo or restore legacy standalone apps", () => {
    const app = readFileSync("src/App.tsx", "utf8");
    expect(app).not.toMatch(/path=["']\/apps\/\*["'][\s\S]*Navigate to=["']\/apps\/demo/);
    expect(app).toContain('path="/apps/ebru-preview/*" element={protectedElement(<Navigate to="/apps" replace />)}');
    expect(app).toContain('path="/apps/parasut/*" element={protectedElement(<LegacyParasutRedirect />)}');
    expect(app).not.toContain("<ParasutModuleRoutes");
  });
});
