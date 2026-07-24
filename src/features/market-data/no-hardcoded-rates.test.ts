import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, "../../..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("no hardcoded financial/weather values in production source", () => {
  it("the frontend api adapter never assigns a literal numeric fallback to a rate/temperature field", () => {
    const source = readSource("src/features/market-data/api.ts");
    expect(source).not.toMatch(/(usdTry|eurTry|gramTry|temperatureC)\s*[:=]\s*\d/);
  });

  it("the edge function handlers never assign a literal numeric fallback to a rate/temperature field", () => {
    const source = readSource("supabase/functions/market-data/handlers.ts");
    expect(source).not.toMatch(/(usdTry|eurTry|gramTry|temperatureC)\s*[:=]\s*\d/);
  });

  it("the dashboard derives exchange/gold/weather values from useMarketData, not a static literal array", () => {
    const source = readSource("src/features/ebru-preview/EbruPreviewPage.tsx");
    expect(source).toMatch(/useMarketData\(\)/);
    expect(source).not.toMatch(/const dashboardExchange = \[\s*\{ label: "Dolar \/ TL", value: "—"/);
  });
});

describe("no API secret in frontend or bundle", () => {
  it("no VITE_-prefixed market-data endpoint variable remains anywhere in the frontend", () => {
    const source = readSource("src/features/ebru-preview/EbruPreviewPage.tsx");
    expect(source).not.toMatch(/VITE_MARKET_RATES_ENDPOINT/);
    expect(existsSync(path.join(repoRoot, "src/features/market-rates"))).toBe(false);
  });

  it("GOLD_API_KEY is never referenced from frontend source", () => {
    const files = [
      "src/features/market-data/api.ts",
      "src/features/market-data/useMarketData.ts",
      "src/features/market-data/format.ts",
      "src/features/market-data/types.ts",
      "src/features/ebru-preview/EbruPreviewPage.tsx",
      "src/vite-env.d.ts",
      ".env.example",
    ];
    for (const file of files) {
      expect(readSource(file)).not.toMatch(/GOLD_API_KEY/);
    }
  });

  it("GOLD_API_KEY is read only from Deno.env inside the edge function, never logged or returned", () => {
    const source = readSource("supabase/functions/market-data/index.ts");
    expect(source).toMatch(/Deno\.env\.get\("GOLD_API_KEY"\)/);
    expect(source).not.toMatch(/console\.(log|error|warn|info)\([^)]*goldApiKey/i);
  });
});

describe("the approved card JSX hierarchy and CSS classes are preserved", () => {
  it("ebru-fx-grid, ebru-fx and ebru-weather markup structure is unchanged", () => {
    const source = readSource("src/features/ebru-preview/EbruPreviewPage.tsx");
    expect(source).toMatch(/className="ebru-fx-grid"/);
    expect(source).toMatch(/className="ebru-fx"/);
    expect(source).toMatch(/className="ebru-weather"/);
  });
});
