// PHASE 15 architecture guards — frontend data boundaries. Static-source
// scans over src/** (no DB access). Each rule encodes a decision from the
// 2026-08 architecture remediation; violating them fails CI.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function listSourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...listSourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) files.push(full);
  }
  return files;
}

const SRC = join(__dirname);
const SELF = "architecture-data-boundaries.test.ts";

function allSources() {
  return listSourceFiles(SRC).map((file) => ({
    rel: file.replace(/\\/g, "/").split("/src/")[1],
    text: readFileSync(file, "utf-8"),
  }));
}

describe("architecture: authoritative Paraşüt boundary", () => {
  it("browser code never reads the parasut schema directly", () => {
    const violations = allSources()
      .filter(({ rel }) => rel !== SELF)
      .filter(({ text }) => /\.from[<(]\s*[`"']parasut/.test(text));
    expect(violations.map((v) => v.rel)).toEqual([]);
  });

  it("statement rows are only named by their own contract test — ledger data flows through parasut-api", () => {
    // transaction_history_items is the authoritative statement table; the
    // browser consumes it exclusively via the parasut-api edge function's
    // fetchAuthoritativeStatement response shape (AuthoritativeStatement),
    // never as a table name.
    const allowed = new Set(["features/crm/customerLedger.test.ts", SELF]);
    const violations = allSources()
      .filter(({ rel }) => !allowed.has(rel))
      .filter(({ text }) => /transaction_history_items/.test(text));
    expect(violations.map((v) => v.rel)).toEqual([]);
  });
});

describe("architecture: legacy table generations cannot gain new callers", () => {
  it("no .from() against any retired-generation table anywhere in src", () => {
    const legacyTables = [
      "stakeholders",
      "customer_full",
      "customers_full",
      "customer_profile",
      "quotations",
      "erp_quotation_links",
    ];
    const violations = [];
    for (const { rel, text } of allSources()) {
      if (rel === SELF) continue;
      for (const table of legacyTables) {
        const pattern = new RegExp(`\\.from[<(][^)]*["'\`]${table}["'\`]`);
        if (pattern.test(text)) violations.push(`${rel} -> ${table}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
