// Phase 1 permanent verification runner. Orchestrates:
//   1. Load cached official OpenAPI spec (repo-committed, not scratchpad).
//   2. Load authoritative migration SQL (comparison side A).
//   3. Capture ONE fresh read-only production information_schema snapshot
//      (comparison side B) — SELECT-only, field-selective, no credentials.
//   4. Process all 28 resources SEQUENTIALLY, writing a durable checkpoint
//      after every single resource (resumable — re-running this script
//      skips resources already marked COMPLETE).
//   5. Write authoritative artifacts under docs/parasut/work/.
//
// Read-only: never calls a Paraşüt endpoint, never writes to production,
// never runs a migration. The only external process invoked is the
// Supabase CLI's read-only `db query` against information_schema.
//
// Run: node scripts/parasut/run-phase1-verification.ts

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import * as YAML from "yaml";

import { extractPaginationEvidence, extractResource, type OpenApiDoc } from "../../server/parasut/verification/openapi-extractor.ts";
import { parseMigrationColumns, columnsByTable, type MigrationColumn } from "../../server/parasut/verification/migration-parser.ts";
import {
  classifyAttribute,
  classifyRelationship,
  computeGenuineExtras,
  type ColumnInfo,
} from "../../server/parasut/verification/three-way-comparator.ts";
import { recordResourceCheckpoint, resourcesRemaining, loadCheckpoint, type CheckpointEntry } from "../../server/parasut/verification/checkpoint-store.ts";
import { RESOURCE_MAP, RESOURCE_ORDER, ENVELOPE_COLUMNS } from "../../server/parasut/verification/resource-map.ts";

const WORK_DIR = "docs/parasut/work";
const SPEC_PATH = `${WORK_DIR}/parasut-openapi-spec-cache.yaml`;
const MIGRATION_PATH = "supabase/migrations/20260723103525_parasut_full_apidocs_schema_expansion.sql";
const CHECKPOINT_PATH = `${WORK_DIR}/phase1-verification-checkpoint.json`;
const PRODUCTION_SNAPSHOT_PATH = `${WORK_DIR}/phase1-production-schema-snapshot.json`;
const FIELD_REPORT_PATH = `${WORK_DIR}/phase1-field-comparison-report.json`;
const SUMMARY_PATH = `${WORK_DIR}/PHASE1_AUTHORITATIVE_VERIFICATION_SUMMARY.md`;
const MANIFEST_PATH = `${WORK_DIR}/phase1-validation-manifest.json`;

function sha256(content: string): string {
  return createHash("sha256").update(content).digest("hex");
}

function captureFreshProductionSnapshot(): { columns: ColumnInfo[]; byTable: Map<string, ColumnInfo[]>; capturedAt: string; hash: string; blocked: string | null } {
  const capturedAt = new Date().toISOString();
  try {
    const sql = "select table_name, column_name, data_type from information_schema.columns where table_schema='parasut' and table_name not in ('sync_runs','sync_errors') order by table_name, ordinal_position;";
    const raw = execFileSync("supabase", ["db", "query", "--linked", sql, "-o", "json"], { encoding: "utf8", timeout: 60000 });
    const jsonStart = raw.indexOf("{");
    const parsed = JSON.parse(raw.slice(jsonStart)) as { rows: Array<{ table_name: string; column_name: string; data_type: string }> };
    const columns: ColumnInfo[] = [];
    const byTable = new Map<string, ColumnInfo[]>();
    for (const row of parsed.rows) {
      const col = { name: row.column_name, pgType: row.data_type };
      columns.push(col);
      const list = byTable.get(row.table_name) ?? [];
      list.push(col);
      byTable.set(row.table_name, list);
    }
    // Field-selective, non-secret content only — safe to hash and persist.
    const contentForHash = JSON.stringify(parsed.rows);
    return { columns, byTable, capturedAt, hash: sha256(contentForHash), blocked: null };
  } catch (error) {
    return { columns: [], byTable: new Map(), capturedAt, hash: "", blocked: (error as Error).message.split("\n")[0] };
  }
}

function main(): void {
  mkdirSync(WORK_DIR, { recursive: true });

  // ---- Inputs ----
  const specText = readFileSync(SPEC_PATH, "utf8");
  const specHash = sha256(specText);
  const doc = YAML.parse(specText) as OpenApiDoc;

  const migrationText = readFileSync(MIGRATION_PATH, "utf8");
  const migrationHash = sha256(migrationText);
  const migrationColumns = parseMigrationColumns(migrationText);
  const migrationByTable = columnsByTable(migrationColumns);

  // The bookkeeping envelope (source_created_at/source_updated_at/source_archived)
  // is declared identically for every mirror table, but by a shared dynamic-SQL
  // block in supabase/migrations/20260713120000_parasut_mirror_schema_foundation.sql
  // (lines 111-113: "source_created_at timestamptz, source_updated_at timestamptz,
  // source_archived boolean") — a `do $$ ... loop ... execute format(...)` block,
  // not a literal `create table` statement parseMigrationColumns's regex can match.
  // These are the redirect TARGETS for the 64 explicit redirects (TASK 4) — needed
  // here only to validate type compatibility, never counted among the 398 official
  // attributes (that count is unaffected, still parsed by parseMigrationColumns
  // exactly as before).
  const BOOKKEEPING_REDIRECT_TARGETS: ColumnInfo[] = [
    { name: "source_created_at", pgType: "timestamptz" },
    { name: "source_updated_at", pgType: "timestamptz" },
    { name: "source_archived", pgType: "boolean" },
  ];

  console.log("Capturing fresh read-only production schema snapshot...");
  const snapshot = captureFreshProductionSnapshot();
  if (snapshot.blocked) {
    console.log(`PRODUCTION SNAPSHOT BLOCKED: ${snapshot.blocked}`);
  } else {
    writeFileSync(PRODUCTION_SNAPSHOT_PATH, JSON.stringify({
      capturedAt: snapshot.capturedAt,
      contentHash: snapshot.hash,
      tableCount: snapshot.byTable.size,
      columnCount: snapshot.columns.length,
      note: "Field-selective metadata only (table_name/column_name/data_type). No credentials, tokens, connection strings, or business values.",
    }, null, 2));
    console.log(`Production snapshot captured at ${snapshot.capturedAt}, hash ${snapshot.hash.slice(0, 12)}...`);
  }

  // ---- Sequential, checkpointed resource processing ----
  const remaining = resourcesRemaining(CHECKPOINT_PATH, RESOURCE_ORDER);
  if (remaining.length === 0) {
    console.log("All 28 resources already checkpointed COMPLETE — nothing to do (resumable no-op).");
  }
  for (const resource of remaining) {
    const resourceNumber = RESOURCE_ORDER.indexOf(resource) + 1;
    const mapping = RESOURCE_MAP[resource];
    const errors: string[] = [];

    let extraction: ReturnType<typeof extractResource> | null = null;
    try {
      extraction = extractResource(doc, resource, mapping.attrs, mapping.wrapper);
    } catch (error) {
      errors.push((error as Error).message);
    }

    const migCols = [...(migrationByTable.get(resource) ?? []), ...BOOKKEEPING_REDIRECT_TARGETS];
    const prodCols = snapshot.byTable.get(resource) ?? []; // already includes bookkeeping columns — the live query is unfiltered by column name

    const attributeResults = extraction
      ? extraction.attributes.map((f) => classifyAttribute(f, migCols, prodCols))
      : [];
    const relationshipResults = extraction
      ? extraction.relationships.map((r) => classifyRelationship(r, migCols, prodCols))
      : [];

    const officialAttrNames = extraction ? extraction.attributes.map((f) => f.name) : [];
    const relExpectedCols = relationshipResults.map((r) => r.expectedInternalColumn);
    const genuineExtraMigration = computeGenuineExtras(officialAttrNames, relExpectedCols, ENVELOPE_COLUMNS, migCols);
    const genuineExtraProduction = computeGenuineExtras(officialAttrNames, relExpectedCols, ENVELOPE_COLUMNS, prodCols);

    const pagination = extractPaginationEvidence(doc, `/{company_id}/${resource}`) ??
      extractPaginationEvidence(doc, `/{company_id}/${resource.replace(/_/g, "")}`);

    const entry: CheckpointEntry = {
      resource,
      resourceNumber,
      totalResources: RESOURCE_ORDER.length,
      status: errors.length > 0 ? "BLOCKED" : "COMPLETE",
      openApiComponents: {
        attributesComponent: `#/definitions/${mapping.attrs}`,
        wrapperComponent: `#/definitions/${mapping.wrapper}`,
      },
      officialAttributeCount: extraction?.attributes.length ?? 0,
      officialRelationshipCount: extraction?.relationships.length ?? 0,
      paginationEvidence: pagination,
      migrationComparisonStatus: "COMPLETE",
      productionComparisonStatus: snapshot.blocked ? "SKIPPED" : "COMPLETE",
      errors,
      timestamp: new Date().toISOString(),
      openApiInputHash: specHash,
      migrationInputHash: migrationHash,
      productionSnapshotHash: snapshot.blocked ? null : snapshot.hash,
    };

    // Durable, atomic, IMMEDIATE write — this is the incremental checkpoint,
    // not a bulk end-of-run write.
    recordResourceCheckpoint(CHECKPOINT_PATH, entry);

    // Per-resource field-level detail, appended to the field report file.
    const fieldReport = existsSync(FIELD_REPORT_PATH) ? JSON.parse(readFileSync(FIELD_REPORT_PATH, "utf8")) : {};
    fieldReport[resource] = {
      resourceNumber,
      attributesComponent: entry.openApiComponents.attributesComponent,
      wrapperComponent: entry.openApiComponents.wrapperComponent,
      attributeResults,
      relationshipResults,
      genuineExtraMigrationColumns: genuineExtraMigration,
      genuineExtraProductionColumns: genuineExtraProduction,
    };
    writeFileSync(FIELD_REPORT_PATH, JSON.stringify(fieldReport, null, 2));

    console.log(`[${resourceNumber}/28] ${resource}: ${entry.status} (attrs=${entry.officialAttributeCount}, rels=${entry.officialRelationshipCount})`);
  }

  // ---- Final summary + manifest (only after full loop; safe to regenerate) ----
  const finalCheckpoint = loadCheckpoint(CHECKPOINT_PATH);
  const completed = Object.values(finalCheckpoint.entries).filter((e) => e.status === "COMPLETE").length;
  const blocked = Object.values(finalCheckpoint.entries).filter((e) => e.status === "BLOCKED").length;
  const fieldReport = JSON.parse(readFileSync(FIELD_REPORT_PATH, "utf8"));

  const totals = {
    officialAttributes: 0, officialRelationships: 0,
    exactMatch: 0, explicitCompatibleRedirect: 0, incompatibleRedirect: 0,
    missingMigration: 0, missingProduction: 0, migrationMismatch: 0, productionMismatch: 0,
    fullyVerifiedRel: 0, jsonOnlyRel: 0, missingMigrationRel: 0, missingProductionRel: 0, unverifiedRel: 0,
    genuineExtraMigration: 0, genuineExtraProduction: 0,
  };
  for (const resource of Object.keys(fieldReport)) {
    const r = fieldReport[resource];
    totals.officialAttributes += r.attributeResults.length;
    totals.officialRelationships += r.relationshipResults.length;
    totals.genuineExtraMigration += r.genuineExtraMigrationColumns.length;
    totals.genuineExtraProduction += r.genuineExtraProductionColumns.length;
    for (const a of r.attributeResults) {
      if (a.classification === "EXACT_MATCH") totals.exactMatch++;
      else if (a.classification === "EXPLICIT_COMPATIBLE_REDIRECT") totals.explicitCompatibleRedirect++;
      else if (a.classification === "INCOMPATIBLE_REDIRECT") totals.incompatibleRedirect++;
      else if (a.classification === "MISSING_MIGRATION_COLUMN") totals.missingMigration++;
      else if (a.classification === "MISSING_PRODUCTION_COLUMN") totals.missingProduction++;
      else if (a.classification === "MIGRATION_TYPE_MISMATCH") totals.migrationMismatch++;
      else if (a.classification === "PRODUCTION_TYPE_MISMATCH") totals.productionMismatch++;
    }
    for (const rel of r.relationshipResults) {
      if (rel.classification === "FULLY_VERIFIED_RELATIONSHIP_BACKED_COLUMN") totals.fullyVerifiedRel++;
      else if (rel.classification === "JSON_ONLY_RELATIONSHIP") totals.jsonOnlyRel++;
      else if (rel.classification === "MISSING_MIGRATION_MAPPING") totals.missingMigrationRel++;
      else if (rel.classification === "MISSING_PRODUCTION_MAPPING") totals.missingProductionRel++;
      else totals.unverifiedRel++;
    }
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify({
    generatedAt: new Date().toISOString(),
    inputs: { openApiSpecHash: specHash, migrationSqlHash: migrationHash, productionSnapshotHash: snapshot.blocked ? null : snapshot.hash, productionSnapshotCapturedAt: snapshot.blocked ? null : snapshot.capturedAt, productionAccessBlocked: snapshot.blocked },
    resourcesCompleted: completed, resourcesBlocked: blocked, resourcesTotal: RESOURCE_ORDER.length,
    totals,
    invariantChecks: {
      completedPlusBlockedEquals28: completed + blocked === 28,
      attributeSumMatches: totals.exactMatch + totals.explicitCompatibleRedirect + totals.incompatibleRedirect + totals.missingMigration + totals.missingProduction + totals.migrationMismatch + totals.productionMismatch === totals.officialAttributes,
      relationshipSumMatches: totals.fullyVerifiedRel + totals.jsonOnlyRel + totals.missingMigrationRel + totals.missingProductionRel + totals.unverifiedRel === totals.officialRelationships,
      freshProductionSnapshotUsed: !snapshot.blocked,
    },
  }, null, 2));

  writeFileSync(SUMMARY_PATH, [
    "# Phase 1 Authoritative Verification Summary (generated, permanent tooling)",
    "",
    `Generated: ${new Date().toISOString()}`,
    `Resources completed: ${completed}/28. Blocked: ${blocked}/28.`,
    `Production snapshot: ${snapshot.blocked ? `BLOCKED — ${snapshot.blocked}` : `fresh, captured ${snapshot.capturedAt}, hash ${snapshot.hash.slice(0, 16)}...`}`,
    "",
    "| Metric | Count |",
    "|---|---|",
    `| Official OpenAPI attributes | ${totals.officialAttributes} |`,
    `| Exact matches | ${totals.exactMatch} |`,
    `| Explicit compatible redirects | ${totals.explicitCompatibleRedirect} |`,
    `| Incompatible redirects | ${totals.incompatibleRedirect} |`,
    `| Missing migration columns | ${totals.missingMigration} |`,
    `| Missing production columns | ${totals.missingProduction} |`,
    `| Migration type mismatches | ${totals.migrationMismatch} |`,
    `| Production type mismatches | ${totals.productionMismatch} |`,
    `| Official OpenAPI relationships | ${totals.officialRelationships} |`,
    `| Fully verified relationship-backed columns | ${totals.fullyVerifiedRel} |`,
    `| JSON-only relationships | ${totals.jsonOnlyRel} |`,
    `| Missing migration relationship mappings | ${totals.missingMigrationRel} |`,
    `| Missing production relationship mappings | ${totals.missingProductionRel} |`,
    `| Structurally extracted, semantically unverified relationships | ${totals.unverifiedRel} |`,
    `| Genuine migration-only extras | ${totals.genuineExtraMigration} |`,
    `| Genuine production-only extras | ${totals.genuineExtraProduction} |`,
    "",
    "See `phase1-field-comparison-report.json` for full per-field detail and `phase1-validation-manifest.json` for input hashes and invariant checks.",
  ].join("\n"));

  console.log("\n=== SUMMARY ===");
  console.log(JSON.stringify({ completed, blocked, ...totals }, null, 2));
}

main();
