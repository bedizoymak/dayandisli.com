import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Mechanical, static guard (Phase 2A TASK 8): proves the Phase 2A offline
// mapper and shadow-comparison modules contain no call to any write-capable
// operation, no sync-runner invocation, no Paraşüt write request, and no
// Edge Function invocation. This is a source-text check, not a runtime
// mock — it cannot be defeated by a code path that merely isn't exercised
// by other tests, only by adding the forbidden pattern to the file at all.

const PHASE_2A_FILES = [
  "server/parasut/offline-mapper.ts",
  "server/parasut/shadow-comparison.ts",
  "server/parasut/field-mapping-registry.ts",
];

const FORBIDDEN_PATTERNS: Array<{ pattern: RegExp; reason: string }> = [
  { pattern: /\.insert\s*\(/, reason: "database insert call" },
  { pattern: /\.update\s*\(/, reason: "database update call" },
  { pattern: /\.delete\s*\(/, reason: "database delete call" },
  { pattern: /\.upsert\s*\(/, reason: "database upsert call" },
  { pattern: /\.merge\s*\(/, reason: "database merge call" },
  { pattern: /\btruncate\b/i, reason: "truncate operation" },
  { pattern: /upsertResource/, reason: "production upsert path import/call" },
  { pattern: /syncCollection|syncContacts|syncProducts|syncAccounts|syncSalesInvoices|syncPurchaseBills/, reason: "sync runner invocation" },
  { pattern: /ParaşütClient|parasut-write-api|POST\s+\/v4|method:\s*["']POST["']/, reason: "Paraşüt write request" },
  { pattern: /functions\.invoke|supabase\.functions/, reason: "Edge Function invocation" },
];

describe("Phase 2A write guard — static source check", () => {
  it.each(PHASE_2A_FILES)("%s contains no write-capable operation", (relativePath) => {
    const source = readFileSync(relativePath, "utf8");
    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
      expect(pattern.test(source), `${relativePath} unexpectedly matched forbidden pattern (${reason}): ${pattern}`).toBe(false);
    }
  });

  it("offline-mapper.ts does not import the production write path or the Paraşüt client", () => {
    const source = readFileSync("server/parasut/offline-mapper.ts", "utf8");
    expect(source).not.toMatch(/from ["']\.\/upsert-resource\.ts["']/);
    expect(source).not.toMatch(/from ["']\.\/client\.ts["']/);
    expect(source).not.toMatch(/from ["']\.\/sync-base\.ts["']/);
  });

  it("shadow-comparison.ts does not import the production write path or the Paraşüt client", () => {
    const source = readFileSync("server/parasut/shadow-comparison.ts", "utf8");
    expect(source).not.toMatch(/from ["']\.\/upsert-resource\.ts["']/);
    expect(source).not.toMatch(/from ["']\.\/client\.ts["']/);
    expect(source).not.toMatch(/from ["']\.\/sync-base\.ts["']/);
  });

  // Phase 2B (explicitly authorized) legitimately supersedes the Phase 2A-era
  // invariant that used to live here ("the write path must never import the
  // registry/mapper at all"). The correct current invariant is narrower and
  // stronger: the write path MAY import them, but only through the gated,
  // scope-confined typed-mapping-gate.ts — never unconditionally, and
  // sync-base.ts (which orchestrates every resource, including out-of-scope
  // ones) still must not import them directly, since scoping is enforced
  // inside upsert-resource.ts alone.
  it("upsert-resource.ts imports the registry/mapper only through the gated typed-mapping-gate.ts module, never unconditionally", () => {
    const upsertSource = readFileSync("server/parasut/upsert-resource.ts", "utf8");
    expect(upsertSource).toMatch(/from ["']\.\/typed-mapping-gate\.ts["']/);
    expect(upsertSource).toMatch(/shouldUseTypedMapping/);
  });

  it("sync-base.ts (the generic per-resource orchestrator) still does not import the registry/mapper directly — scoping stays confined to upsert-resource.ts alone", () => {
    const syncBaseSource = readFileSync("server/parasut/sync-base.ts", "utf8");
    expect(syncBaseSource).not.toMatch(/field-mapping-registry|offline-mapper|shadow-comparison|typed-mapping-gate/);
  });

  it("no sync-*.ts production wrapper imports the Phase 2A modules", () => {
    const wrappers = [
      "server/parasut/sync-contacts.ts",
      "server/parasut/sync-products.ts",
      "server/parasut/sync-accounts.ts",
      "server/parasut/sync-sales-invoices.ts",
      "server/parasut/sync-purchase-bills.ts",
    ];
    for (const wrapper of wrappers) {
      const source = readFileSync(wrapper, "utf8");
      expect(source, wrapper).not.toMatch(/field-mapping-registry|offline-mapper|shadow-comparison/);
    }
  });
});
