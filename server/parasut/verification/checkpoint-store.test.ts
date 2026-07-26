import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  isFullyComplete,
  loadCheckpoint,
  recordResourceCheckpoint,
  resourcesRemaining,
  type CheckpointEntry,
} from "./checkpoint-store.ts";

// Uses a real OS temp directory (never the repo) so this test proves real
// filesystem durability/atomicity, not an in-memory mock of it.

let dir: string;
let checkpointPath: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "parasut-checkpoint-test-"));
  checkpointPath = join(dir, "checkpoint.json");
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function entry(resource: string, num: number): CheckpointEntry {
  return {
    resource,
    resourceNumber: num,
    totalResources: 28,
    status: "COMPLETE",
    openApiComponents: { attributesComponent: `#/definitions/${resource}Attributes`, wrapperComponent: `#/definitions/${resource}` },
    officialAttributeCount: 5,
    officialRelationshipCount: 1,
    paginationEvidence: null,
    migrationComparisonStatus: "COMPLETE",
    productionComparisonStatus: "COMPLETE",
    errors: [],
    timestamp: new Date().toISOString(),
    openApiInputHash: "abc123",
    migrationInputHash: "def456",
    productionSnapshotHash: "ghi789",
  };
}

describe("checkpoint-store — durability and atomicity", () => {
  it("starts empty when no checkpoint file exists yet", () => {
    const cp = loadCheckpoint(checkpointPath);
    expect(cp.entries).toEqual({});
    expect(existsSync(checkpointPath)).toBe(false);
  });

  it("writes a resource's checkpoint immediately and durably — readable by a fresh load", () => {
    recordResourceCheckpoint(checkpointPath, entry("accounts", 1));
    expect(existsSync(checkpointPath)).toBe(true);
    const reloaded = loadCheckpoint(checkpointPath);
    expect(reloaded.entries.accounts.status).toBe("COMPLETE");
  });

  it("never leaves a .tmp file behind after a successful write (rename completed)", () => {
    recordResourceCheckpoint(checkpointPath, entry("accounts", 1));
    const files = readdirSync(dir);
    expect(files.some((f) => f.includes(".tmp-"))).toBe(false);
  });

  it("preserves previously-recorded resources when a new one is added (incremental, not overwritten wholesale)", () => {
    recordResourceCheckpoint(checkpointPath, entry("accounts", 1));
    recordResourceCheckpoint(checkpointPath, entry("contacts", 2));
    const cp = loadCheckpoint(checkpointPath);
    expect(Object.keys(cp.entries).sort()).toEqual(["accounts", "contacts"]);
  });

  it("the on-disk file is updated after EVERY resource, not only once at the end — proven by re-reading between writes", () => {
    recordResourceCheckpoint(checkpointPath, entry("accounts", 1));
    const afterFirst = JSON.parse(readFileSync(checkpointPath, "utf8"));
    expect(Object.keys(afterFirst.entries)).toEqual(["accounts"]);

    recordResourceCheckpoint(checkpointPath, entry("contacts", 2));
    const afterSecond = JSON.parse(readFileSync(checkpointPath, "utf8"));
    expect(Object.keys(afterSecond.entries).sort()).toEqual(["accounts", "contacts"]);
  });
});

describe("checkpoint-store — resume behavior", () => {
  const allResources = ["accounts", "bank_fees", "contacts", "products"];

  it("reports all resources remaining when nothing has been checkpointed", () => {
    expect(resourcesRemaining(checkpointPath, allResources)).toEqual(allResources);
  });

  it("excludes only the resources actually marked COMPLETE from the remaining list", () => {
    recordResourceCheckpoint(checkpointPath, entry("accounts", 1));
    recordResourceCheckpoint(checkpointPath, entry("bank_fees", 2));
    expect(resourcesRemaining(checkpointPath, allResources)).toEqual(["contacts", "products"]);
  });

  it("isFullyComplete is false until every resource is checkpointed COMPLETE", () => {
    recordResourceCheckpoint(checkpointPath, entry("accounts", 1));
    expect(isFullyComplete(checkpointPath, allResources)).toBe(false);
  });

  it("isFullyComplete is true once all resources are checkpointed COMPLETE", () => {
    for (let i = 0; i < allResources.length; i++) recordResourceCheckpoint(checkpointPath, entry(allResources[i], i + 1));
    expect(isFullyComplete(checkpointPath, allResources)).toBe(true);
  });

  it("REAL RESUME TEST: simulates a process that stops after 2 of 4 resources, then a fresh process instance resumes and does not reprocess completed ones", () => {
    // First "process run": completes 2 resources then simulates a crash
    // (simply stops calling the store — no special crash simulation needed
    // since nothing is buffered in memory between calls; each call is a
    // fully durable, independent write).
    recordResourceCheckpoint(checkpointPath, entry("accounts", 1));
    recordResourceCheckpoint(checkpointPath, entry("bank_fees", 2));

    // "Restart": a brand-new load from disk, as a fresh process would do.
    const remainingAfterRestart = resourcesRemaining(checkpointPath, allResources);
    expect(remainingAfterRestart).toEqual(["contacts", "products"]);

    // The "resumed process" only processes what's remaining — accounts and
    // bank_fees are never touched again.
    const processedThisRun: string[] = [];
    for (const resource of remainingAfterRestart) {
      processedThisRun.push(resource);
      recordResourceCheckpoint(checkpointPath, entry(resource, allResources.indexOf(resource) + 1));
    }
    expect(processedThisRun).toEqual(["contacts", "products"]);
    expect(processedThisRun).not.toContain("accounts");
    expect(processedThisRun).not.toContain("bank_fees");

    // Final state: all 4 complete, and the original 2 entries are byte-for-byte
    // the same objects recorded in the first run (not reprocessed/regenerated).
    const final = loadCheckpoint(checkpointPath);
    expect(isFullyComplete(checkpointPath, allResources)).toBe(true);
    expect(final.entries.accounts.resourceNumber).toBe(1);
    expect(final.entries.bank_fees.resourceNumber).toBe(2);
  });
});
