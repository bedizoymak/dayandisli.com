import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const FILES = [
  "supabase/functions/checks-api/handlers.ts",
  "supabase/functions/checks-api/index.ts",
];

describe("checks-api provider-write boundary", () => {
  it.each(FILES)("%s contains no Paraşüt HTTP/write client path", (path) => {
    const source = readFileSync(path, "utf8");
    expect(source).not.toMatch(/api\.parasut\.com/i);
    expect(source).not.toMatch(/ParaşütClient|ParasutContactWriteHttpClient|write-client\.ts|sync-checks\.ts|TokenManager/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/method\s*:\s*["'](?:PATCH|DELETE|PUT)["']/i);
  });

  it("writes only the ERP-owned payment_instruments table and transition RPC", () => {
    const source = readFileSync("supabase/functions/checks-api/index.ts", "utf8");
    const mutationTargets = Array.from(source.matchAll(/\.from\("([^"]+)"\)\s*\n\s*\.(?:insert|update|delete|upsert)\(/g), (match) => match[1]);
    expect(new Set(mutationTargets)).toEqual(new Set(["payment_instruments"]));
    expect(source).toContain('rpc("transition_payment_instrument"');
    expect(source).not.toMatch(/\.schema\("parasut"\)[\s\S]{0,160}\.(?:insert|update|delete|upsert)\(/);
  });
});
