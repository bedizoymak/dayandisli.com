// Phase 1 permanent verification tooling: durable, atomic, incremental
// checkpoint persistence. Each completed resource is written to disk
// immediately (atomic temp-file + rename, never a partial/torn write) —
// this is what the earlier scratchpad scripts did not do (they held all 28
// results in memory and wrote once at the end).

import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type CheckpointStatus = "COMPLETE" | "BLOCKED";

export interface CheckpointEntry {
  resource: string;
  resourceNumber: number;
  totalResources: number;
  status: CheckpointStatus;
  openApiComponents: { attributesComponent: string; wrapperComponent: string };
  officialAttributeCount: number;
  officialRelationshipCount: number;
  paginationEvidence: unknown;
  migrationComparisonStatus: "COMPLETE" | "SKIPPED";
  productionComparisonStatus: "COMPLETE" | "SKIPPED";
  errors: string[];
  timestamp: string;
  openApiInputHash: string;
  migrationInputHash: string;
  productionSnapshotHash: string | null;
}

export interface CheckpointFile {
  version: 1;
  createdAt: string;
  updatedAt: string;
  entries: Record<string, CheckpointEntry>;
}

/** Atomic write: write to a sibling temp file, then rename over the target.
 * A crash mid-write leaves the temp file, never a truncated target file. */
function atomicWriteJson(path: string, data: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmpPath = `${path}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmpPath, path);
}

export function loadCheckpoint(path: string): CheckpointFile {
  if (!existsSync(path)) {
    const now = new Date().toISOString();
    return { version: 1, createdAt: now, updatedAt: now, entries: {} };
  }
  return JSON.parse(readFileSync(path, "utf8")) as CheckpointFile;
}

/** Writes one resource's completed entry immediately and durably — the
 * defining behavior that distinguishes this from a bulk end-of-run write.
 * Safe to call after every single resource in a loop. */
export function recordResourceCheckpoint(path: string, entry: CheckpointEntry): CheckpointFile {
  const current = loadCheckpoint(path);
  current.entries[entry.resource] = entry;
  current.updatedAt = new Date().toISOString();
  atomicWriteJson(path, current);
  return current;
}

/** Resume support: given the full ordered resource list, returns only the
 * ones NOT already marked COMPLETE in the checkpoint file. */
export function resourcesRemaining(path: string, allResources: readonly string[]): string[] {
  const checkpoint = loadCheckpoint(path);
  return allResources.filter((r) => checkpoint.entries[r]?.status !== "COMPLETE");
}

export function isFullyComplete(path: string, allResources: readonly string[]): boolean {
  return resourcesRemaining(path, allResources).length === 0;
}
