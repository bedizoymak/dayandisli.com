// PHASE 15 architecture guards — Paraşüt integration safety. Static-source
// scans over server/, supabase/functions and scripts.
//
// 1) WRITE-PATH GUARD: business writes to api.parasut.com may exist in
//    exactly two places — the OAuth token exchange (auth.ts) and the single
//    authorized write client (write-client.ts, wrapped by the outbound-
//    command handler). The OAuth callback function also exchanges tokens.
//    Any other POST/PATCH/PUT/DELETE toward Paraşüt fails here.
// 2) SMTP RELAY GUARD: send-quotation-email must keep its Phase 1C
//    protections (gateway JWT + erp_users authorization + validator import);
//    silently reverting them would reopen the relay closed in commit
//    f7ee036.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const SCAN_DIRS = ["server/parasut", "supabase/functions", "scripts"];
const ALLOWED_WRITE_SOURCES = new Set([
  "server/parasut/auth.ts", // OAuth password-grant token POST (no business data)
  "server/parasut/write-client.ts", // THE authorized business-write client
  "supabase/functions/parasut-sync/index.ts", // OAuth callback token exchange
]);

function listFiles(dir: string): string[] {
  const files: string[] = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return files;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist") continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...listFiles(full));
    else if (/\.(ts|mjs)$/.test(entry)) files.push(full);
  }
  return files;
}

describe("architecture: Paraşüt write path is singular", () => {
  it("only allowlisted sources issue non-GET HTTP methods toward api.parasut.com", () => {
    const violations = [];
    for (const dir of SCAN_DIRS.map((d) => join(ROOT, d))) {
      for (const file of listFiles(dir)) {
        const rel = file.replace(/\\/g, "/").split("/dayandisli.com/")[1];
        if (!rel || rel.endsWith(".test.ts")) continue;
        const text = readFileSync(file, "utf-8");
        if (!text.includes("api.parasut.com")) continue;
        const mutating = ["POST", "PATCH", "PUT", "DELETE"].filter((method) =>
          new RegExp(`method:\\s*["']${method}["']`).test(text),
        );
        if (mutating.length > 0 && !ALLOWED_WRITE_SOURCES.has(rel)) {
          violations.push(`${rel} -> ${mutating.join(",")}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("the emergency-pause gate still defaults to PAUSED in parasut-sync-run", () => {
    const source = readFileSync(
      join(ROOT, "supabase", "functions", "parasut-sync-run", "index.ts"),
      "utf-8",
    );
    expect(source).toMatch(/PARASUT_SYNC_EMERGENCY_PAUSE"\)\s*\?\?\s*"true"/);
  });
});

describe("architecture: quotation email relay stays closed (Phase 1C)", () => {
  const fnSource = readFileSync(
    join(ROOT, "supabase", "functions", "send-quotation-email", "index.ts"),
    "utf-8",
  );
  const config = readFileSync(join(ROOT, "supabase", "config.toml"), "utf-8");

  it("gateway requires a JWT for send-quotation-email", () => {
    const section = config.split("[functions.send-quotation-email]")[1] ?? "";
    expect(section).toMatch(/verify_jwt\s*=\s*true/);
  });

  it("the function still authorizes an active ERP user before sending", () => {
    expect(fnSource).toContain('from("erp_users")');
    expect(fnSource).toContain('"is_active"');
  });

  it("payload validation module is still imported and enforced", () => {
    expect(fnSource).toContain("validateQuotationEmailRequest");
    expect(fnSource).toContain("checkRateLimit");
  });
});
