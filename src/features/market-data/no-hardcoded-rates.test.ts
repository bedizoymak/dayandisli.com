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

  it("TOMORROW_API_KEY is never referenced from frontend source", () => {
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
      expect(readSource(file)).not.toMatch(/TOMORROW_API_KEY/);
    }
  });

  it("TOMORROW_API_KEY is read only from Deno.env inside the edge function, never logged or returned", () => {
    const source = readSource("supabase/functions/market-data/index.ts");
    expect(source).toMatch(/Deno\.env\.get\("TOMORROW_API_KEY"\)/);
    expect(source).not.toMatch(/console\.(log|error|warn|info)\([^)]*weatherApiKey/i);
  });
});

describe("no precise coordinates persisted or logged", () => {
  it("neither the edge function entrypoint nor the handlers ever log coordinates/lat/lon", () => {
    for (const file of ["supabase/functions/market-data/index.ts", "supabase/functions/market-data/handlers.ts"]) {
      const source = readSource(file);
      expect(source).not.toMatch(/console\.(log|error|warn|info)\([^)]*(coordinates|latitude|longitude|\blat\b|\blon\b)/i);
    }
  });

  it("the market-data function performs no database write (no insert/update/upsert/delete anywhere in it)", () => {
    for (const file of ["supabase/functions/market-data/index.ts", "supabase/functions/market-data/handlers.ts"]) {
      const source = readSource(file);
      expect(source).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
    }
  });

  it("the frontend never persists geolocation coordinates (no localStorage/sessionStorage write of lat/lon)", () => {
    const source = readSource("src/features/market-data/api.ts");
    expect(source).not.toMatch(/localStorage\.setItem|sessionStorage\.setItem/);
  });
});

describe("no update date/time shown on market or weather cards", () => {
  it("the currency and gold card builders no longer format a rate date or update timestamp", () => {
    const source = readSource("src/features/ebru-preview/EbruPreviewPage.tsx");
    expect(source).not.toMatch(/formatCurrencyMeta|formatGoldMeta/);
    expect(source).not.toMatch(/Güncellendi|Güncelleme gecikti/);
  });

  it("the market-data feature module no longer exports date/time formatting helpers", () => {
    const source = readSource("src/features/market-data/format.ts");
    expect(source).not.toMatch(/export function formatCurrencyMeta|export function formatGoldMeta/);
  });

  it("card builders use formatProviderLabel (provider name only) instead of a date-bearing formatter", () => {
    const source = readSource("src/features/ebru-preview/EbruPreviewPage.tsx");
    expect(source).toMatch(/formatProviderLabel\(marketData\.currency\.source\)/);
    expect(source).toMatch(/formatProviderLabel\(gold\.source\)/);
  });
});

describe("provider names remain visible where intended", () => {
  it("currency source is still TCMB and is surfaced via formatProviderLabel", () => {
    const handlersSource = readSource("supabase/functions/market-data/handlers.ts");
    expect(handlersSource).toMatch(/source:\s*"TCMB"/);
  });

  it("formatProviderLabel maps the raw metalpriceapi.com source to a friendly, provider-only label", () => {
    const source = readSource("src/features/market-data/format.ts");
    expect(source).toMatch(/"metalpriceapi\.com":\s*"MetalPriceAPI"/);
  });
});

describe("the main dashboard greeting date/time is unchanged", () => {
  it("the greeting still renders {today} · {time} beneath the welcome heading", () => {
    const source = readSource("src/features/ebru-preview/EbruPreviewPage.tsx");
    expect(source).toMatch(/className="ebru-date"[^>]*>\s*\{today\}\s*·\s*\{time\}/);
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
