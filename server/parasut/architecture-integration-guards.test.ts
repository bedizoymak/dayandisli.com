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

describe("architecture: execution-source separation on parasut-sync-run", () => {
  const syncRunSource = readFileSync(
    join(ROOT, "supabase", "functions", "parasut-sync-run", "index.ts"),
    "utf-8",
  );

  it("the fail-closed invocation gate is imported and consulted", () => {
    expect(syncRunSource).toContain("sync-invocation-gate");
    expect(syncRunSource).toContain("gateScheduledInvocation");
  });

  it("source classification precedes ANY credential or engine work", () => {
    // The gate must run before TokenManager is even constructed — an
    // unproven caller must never push the function past the front door.
    const gateIndex = syncRunSource.indexOf("gateScheduledInvocation({");
    const tokenIndex = syncRunSource.indexOf("new TokenManager");
    expect(gateIndex).toBeGreaterThan(-1);
    expect(tokenIndex).toBeGreaterThan(-1);
    expect(gateIndex).toBeLessThan(tokenIndex);
  });

  it("the paused response shape is preserved for proven-scheduled callers", () => {
    expect(syncRunSource).toContain('status: "paused"');
    expect(syncRunSource).toContain('reason: "emergency_pause_active"');
  });
});

describe("architecture: manual Paraşüt sync stays on the single authorized path", () => {
  const manualSyncSource = readFileSync(
    join(ROOT, "src", "features", "crm", "parasutManualSync.ts"),
    "utf-8",
  );

  it("the ERP manual-sync button calls ONLY parasut-write-api's explicit full-resync action", () => {
    expect(manualSyncSource).toContain('functions.invoke("parasut-write-api"');
    expect(manualSyncSource).toContain('action: "full-resync"');
    // No second sync surface may appear client-side — parasut-sync-run is
    // scheduled-only and rejects every other execution source server-side.
    expect(manualSyncSource).not.toContain('"parasut-sync-run"');
  });
});

describe("architecture: cheque deletion reconciliation stays enabled", () => {
  it("syncChecks opts into absence-based reconciliation (PARENT-DELETED-BUT-STILL-MIRRORED fix)", () => {
    // The three ghost cheques (1001339640/1001340292/1001340293) existed
    // only because this resource ran WITHOUT reconciliation. Reverting
    // `reconcile: true` would reopen that contamination and must fail CI.
    const source = readFileSync(join(ROOT, "server", "parasut", "sync-checks.ts"), "utf-8");
    expect(source).toMatch(/reconcile:\s*true/);
  });
});

describe("architecture: no customer-allowlist in sync correctness logic", () => {
  it("no production source references the removed RECONCILIATION_TARGET_CONTACT_IDS", () => {
    for (const dir of SCAN_DIRS.map((d) => join(ROOT, d))) {
      for (const file of listFiles(dir)) {
        const rel = file.replace(/\\/g, "/").split("/dayandisli.com/")[1];
        if (!rel || rel.endsWith(".test.ts")) continue;
        const text = readFileSync(file, "utf-8");
        expect(text.includes("RECONCILIATION_TARGET_CONTACT_IDS"), `${rel} reintroduces the customer allowlist`).toBe(false);
      }
    }
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
