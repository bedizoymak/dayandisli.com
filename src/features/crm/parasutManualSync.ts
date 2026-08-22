// Manual, one-way (Paraşüt → Supabase) synchronization trigger for the
// account-statement-relevant resources. Calls the admin-gated "full-resync"
// action on the parasut-write-api edge function ONCE — that action itself
// resumes each resource (contacts → sales_invoices → purchase_bills →
// checks) to completion within its own safety limits, reusing the existing
// server/parasut/sync-*.ts engine (see handleFullResync in
// supabase/functions/parasut-write-api/handlers.ts). No new sync engine, no
// write path back to Paraşüt, and no client-side loop — a single click
// triggers a single request; the server decides how many resume chunks
// each resource needs.
import { supabase } from "@/integrations/supabase/client";

export type ManualSyncResourceKey = "customers" | "sales_invoices" | "purchase_bills" | "checks";

export const MANUAL_SYNC_RESOURCE_LABELS: Record<ManualSyncResourceKey, string> = {
  customers: "Cariler",
  sales_invoices: "Satış Faturaları",
  purchase_bills: "Alış Faturaları",
  checks: "Çekler",
};

export type ManualSyncResourceStatus = "completed" | "partial" | "failed";

export interface ManualSyncResourceOutcome {
  resource: ManualSyncResourceKey;
  label: string;
  status: ManualSyncResourceStatus;
  /** How many resumed sync chunks this resource took to reach this status — a full multi-invocation resume, not just one bounded page batch. */
  chunks: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: number;
  /** true when the resource's own page budget across this run's chunks still wasn't enough — the next manual click (or the scheduled cron) continues it; never presented as complete. */
  hasMore: boolean;
}

export interface ManualSyncSummary {
  overallStatus: ManualSyncResourceStatus | "conflict";
  startedAt: string;
  completedAt: string;
  resources: ManualSyncResourceOutcome[];
  /** Set only when overallStatus === "conflict" — a sync (scheduled or another manual run) was already in progress for this resource, so this run stopped immediately rather than racing it. */
  conflictResource: ManualSyncResourceKey | null;
}

interface FullResyncResponseBody {
  status?: unknown;
  startedAt?: unknown;
  completedAt?: unknown;
  resources?: unknown;
  conflictResource?: unknown;
  error?: unknown;
}

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toResourceKey(value: unknown): ManualSyncResourceKey | null {
  return value === "customers" || value === "sales_invoices" || value === "purchase_bills" || value === "checks" ? value : null;
}

function toStatus(value: unknown): ManualSyncResourceStatus {
  return value === "completed" || value === "failed" ? value : "partial";
}

function parseResources(raw: unknown): ManualSyncResourceOutcome[] {
  if (!Array.isArray(raw)) return [];
  const resources: ManualSyncResourceOutcome[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const resource = toResourceKey(record.resource);
    if (!resource) continue;
    resources.push({
      resource,
      label: MANUAL_SYNC_RESOURCE_LABELS[resource],
      status: toStatus(record.status),
      chunks: toCount(record.chunks),
      inserted: toCount(record.inserted),
      updated: toCount(record.updated),
      unchanged: toCount(record.unchanged),
      errors: toCount(record.errors),
      hasMore: record.hasMore === true,
    });
  }
  return resources;
}

function isEdgeFunctionError(error: unknown): error is { context?: { status?: number } } {
  return typeof error === "object" && error !== null;
}

/** Triggers one complete, one-way full-resync run. Never loops or retries
 * client-side — a single edge-function invocation already resumes every
 * resource to completion (or a safety limit) server-side; see
 * handleFullResync's own doc comment for exactly how. */
export async function runManualParasutSync(now: () => Date = () => new Date()): Promise<ManualSyncSummary> {
  const { data, error } = await supabase.functions.invoke("parasut-write-api", { body: { action: "full-resync" } });
  const body = (data ?? null) as FullResyncResponseBody | null;

  if (error || !body || typeof body.status !== "string") {
    const nowIso = now().toISOString();
    const status = isEdgeFunctionError(error) && error.context?.status === 409 ? "conflict" : "failed";
    return { overallStatus: status, startedAt: nowIso, completedAt: nowIso, resources: [], conflictResource: null };
  }

  const overallStatus: ManualSyncSummary["overallStatus"] =
    body.status === "completed" || body.status === "partial" || body.status === "failed" || body.status === "conflict" ? body.status : "failed";

  return {
    overallStatus,
    startedAt: typeof body.startedAt === "string" ? body.startedAt : now().toISOString(),
    completedAt: typeof body.completedAt === "string" ? body.completedAt : now().toISOString(),
    resources: parseResources(body.resources),
    conflictResource: toResourceKey(body.conflictResource),
  };
}
