// Guards against reintroducing the PostgREST silent-truncation class of bug
// (see sync-statement-staleness.ts's fix comment and the P0 incident it
// describes): an unbounded, unordered `.select()` against a table that can
// exceed PostgREST's default ~1000-row response cap does not error — it
// silently returns a truncated, arbitrarily-ordered subset. The failure
// mode does not exist until the table crosses the cap, then appears
// spontaneously in code nobody touched.
//
// This is a static-source scan, not a live-database test: it looks for
// `.from("table")` chains that also contain `.select(` before the
// statement's closing semicolon, with no `.limit(`, `.range(`, `.single(`,
// or `.maybeSingle(` anywhere in that same statement. Every currently-known
// instance (found in a full repo audit, 2026-08-23) is in
// KNOWN_UNBOUNDED_QUERIES below, keyed by "file:line:table", with the
// reasoning for why it's accepted as currently safe or tracked as a
// follow-up — NOT because it's provably safe forever, but because it's a
// reviewed, intentional, monitored exception. Any newly-introduced
// unbounded query fails this test until it's either bounded or added here
// with the same justification.
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..");
const SCAN_DIRS = ["server/parasut", "supabase/functions", "scripts"];

/**
 * "file:line:table" keyed to the line the `.from("table")` call starts on.
 * Update the line number if the surrounding code shifts; that's the point
 * — a mismatch means the query moved or changed shape and needs re-review,
 * not a silent pass-through.
 */
const KNOWN_UNBOUNDED_QUERIES: Record<string, string> = {
  "server/parasut/sync-base.ts:256:sync_runs": "Bounded (fixed 2026-08-23): findLatestResumableRun now scopes by gt(created_at, 48h-ago) in addition to company/resource/status — a resume candidate older than that is never useful anyway. (Lines re-anchored 2026-08-25 by Phase 1A retry-governance additions above.)",
  "server/parasut/sync-base.ts:257:sync_runs": "Same fix/reasoning as line 256 (partial-status branch of the same three-way query).",
  "server/parasut/sync-base.ts:258:sync_runs": "Same fix/reasoning as line 256 (completed-status branch of the same three-way query).",
  "server/parasut/sync-run-recovery.ts:119:sync_runs": "Bounded: status='running' AND completed_at is null AND updated_at older than the 10-minute stale cutoff (recoverStaleRuns) — by definition only anomalous stuck runs; healthy state is 0 rows.",
  "server/parasut/sync-statement-staleness.ts:68:contacts": "TRACKED, not yet fixed: 441 active contacts today (confirmed live 2026-08-23), no natural per-key scoping possible since this IS the outer loop variable in computeContactStaleness. Monitor as the business grows past ~1000 contacts.",
  "server/parasut/sync-statement-staleness.ts:94:transaction_history_items": "Bounded (fixed 2026-08-23): scoped per-contact via .eq('contact_parasut_id', contact.parasut_id) inside the Promise.all(contacts.map(...)) loop — every query returns at most one contact's own row set, never company-wide.",
  "server/parasut/sync-statement-staleness.ts:101:sync_runs": "Bounded (fixed 2026-08-23): scoped via .eq('request_metadata->>endpoint', historyEndpoint(...)) to one specific contact's sync history — same per-contact scoping as line 94 above.",
  "supabase/functions/checks-api/index.ts:54:checks": "TRACKED: listMirrorChecks, 41 active checks company-wide today (confirmed live 2026-08-23) — same class, low near-term risk.",
  "supabase/functions/checks-api/index.ts:64:payment_instruments": "Bounded: listLocalInstruments, a company's own payment instruments (bank accounts/cards), inherently small by the nature of the resource.",
  "supabase/functions/checks-api/index.ts:116:contacts": "Bounded: listMirrorContacts explicitly paginates the caller-supplied parasutIds in chunks of 100 (for loop, offset += 100) before this .in() call — each individual query is bounded to at most 100 ids/rows.",
  "supabase/functions/checks-api/index.ts:159:payment_instrument_events": "Bounded: listEvents, scoped to one payment_instrument_id's own lifecycle events — realistic ceiling is small.",
  "supabase/functions/commerce-checkout/index.ts:86:commerce_checkout_events": "Not a row-fetch risk: { count: 'exact', head: true } returns only a count, no rows, so PostgREST's response-row cap does not apply.",
  "supabase/functions/commerce-checkout/index.ts:133:products": "Bounded: .in('id', productIds) where productIds.length is rejected above 50 (payload.items.length > 50 check) before this query runs.",
  "supabase/functions/commerce-checkout/index.ts:257:shop_inventory_reservations": "Bounded: scoped to one order_id + status='reserved' — reservations for a single order, inherently small.",
  "scripts/run-parasut-history-company-backfill.ts:65:contacts": "TRACKED, same 441-contact bound as sync-statement-staleness.ts:58 above (fetchActiveContactIds) — manual/on-demand tool, not part of the automatic cron path.",
  "scripts/run-parasut-history-company-backfill.ts:89:sync_runs": "TRACKED, NOT YET FIXED: fetchLatestStatusByContact fetches ALL sync_runs for resource_type='transaction_history_items' company-wide, unscoped by contact — the exact same bug class just fixed in sync-statement-staleness.ts, present here too. Lower urgency because this script is manual/on-demand (the company-wide backfill CLI runner), not the automatic 1-minute cron, but should get the identical per-contact-scoping fix before its next use.",
};

function listSourceFiles(dir: string): string[] {
  const entries = readdirSync(dir);
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      if (entry === "node_modules" || entry === "dist") continue;
      files.push(...listSourceFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

interface Finding { key: string; file: string; line: number; snippet: string }

/** Statement-scoped: from the `.from(` call to the next top-level `;`
 * (or a hard cap), not a fixed character window — avoids bleeding into an
 * unrelated later statement, which produced false positives (e.g. flagging
 * a bare `.insert()` because an unrelated `.select()` happened to follow
 * later in the same file within a fixed-size window). */
function statementSlice(source: string, start: number): string {
  const HARD_CAP = 1200;
  const capped = source.slice(start, start + HARD_CAP);
  const semi = capped.indexOf(";");
  return semi === -1 ? capped : capped.slice(0, semi + 1);
}

function lineNumberAt(source: string, index: number): number {
  return source.slice(0, index).split("\n").length;
}

function findUnboundedSelects(): Finding[] {
  const findings: Finding[] = [];
  for (const dir of SCAN_DIRS) {
    let files: string[];
    try {
      files = listSourceFiles(join(REPO_ROOT, dir));
    } catch {
      continue; // directory doesn't exist in this checkout — nothing to scan.
    }
    for (const file of files) {
      const source = readFileSync(file, "utf-8");
      const fromPattern = /\.from(?:<[^>]*>)?\(\s*["'`]([\w.]+)["'`]\s*\)/g;
      let match: RegExpExecArray | null;
      while ((match = fromPattern.exec(source))) {
        const table = match[1];
        const statement = statementSlice(source, match.index);
        const selectIndex = statement.indexOf(".select(");
        if (selectIndex === -1) continue; // not a read (pure insert/update/upsert) — not this class of bug.
        const writeIndex = Math.min(
          ...[".insert(", ".update(", ".upsert("].map((t) => { const i = statement.indexOf(t); return i === -1 ? Infinity : i; }),
        );
        if (writeIndex < selectIndex) continue; // a write statement — any .select( appearing later in the window belongs to unrelated, later code, not this statement.
        const hasTerminator = [".limit(", ".range(", ".single(", ".maybeSingle("].some((t) => statement.includes(t));
        if (hasTerminator) continue; // explicitly bounded.
        const relFile = relative(REPO_ROOT, file).replace(/\\/g, "/");
        const line = lineNumberAt(source, match.index);
        findings.push({ key: `${relFile}:${line}:${table}`, file: relFile, line, snippet: statement.slice(0, 140).replace(/\s+/g, " ") });
      }
    }
  }
  return findings;
}

describe("no unbounded PostgREST select queries (reintroduction guard)", () => {
  it("every .from(table)...select(...) statement with no .limit()/.range()/.single()/.maybeSingle() is a reviewed, known exception", () => {
    const findings = findUnboundedSelects();
    const unexpected = findings.filter((f) => !(f.key in KNOWN_UNBOUNDED_QUERIES));
    if (unexpected.length > 0) {
      const details = unexpected.map((f) => `  ${f.key}\n    ${f.snippet}`).join("\n");
      throw new Error(
        `Found ${unexpected.length} unbounded select statement(s) not in KNOWN_UNBOUNDED_QUERIES ` +
          `(server/parasut/no-unbounded-select.test.ts). A query with no .limit()/.range()/.single()/` +
          `.maybeSingle() silently truncates instead of erroring once the table crosses PostgREST's ` +
          `~1000-row response cap. Either bound the new query, or — if it's genuinely reviewed and safe ` +
          `— add it to KNOWN_UNBOUNDED_QUERIES with the reasoning (a provable bound, or a tracked ` +
          `follow-up with the current measured row count):\n${details}`,
      );
    }
    expect(unexpected).toHaveLength(0);
  });

  it("does not silently accumulate stale allowlist entries for queries that no longer exist at that location", () => {
    const findings = new Set(findUnboundedSelects().map((f) => f.key));
    const stale = Object.keys(KNOWN_UNBOUNDED_QUERIES).filter((key) => !findings.has(key));
    if (stale.length > 0) {
      throw new Error(
        `KNOWN_UNBOUNDED_QUERIES has entries that no longer match any query at that file:line — ` +
          `either the query was fixed (remove the entry) or moved (update the line number):\n` +
          stale.map((k) => `  ${k}`).join("\n"),
      );
    }
  });
});
