/**
 * PHASE 10: THE canonical Paraşüt sync resource order. This is the single
 * source of truth — the production cron loop
 * (supabase/functions/parasut-sync-run/index.ts), every CLI runner, and this
 * plan module MUST agree; a static divergence guard test pins them together.
 *
 * Order rationale (production-verified 2026-08-23): accounts first (cheap,
 * warms token + validates API health), then contacts/products (entities),
 * then sales_invoices/purchase_bills (documents that reference both), and
 * checks LAST because cheques are the highest-volume include-expanded
 * resource and benefit from everything else having already succeeded.
 * "checks" was missing from this file's earlier list — drift between the CLI
 * composition and the cron composition; the cron order is authoritative.
 */
export const DEFAULT_RESOURCE_ORDER = [
  "accounts",
  "contacts",
  "products",
  "sales_invoices",
  "purchase_bills",
  "checks",
] as const;

export type SupportedSyncResource = (typeof DEFAULT_RESOURCE_ORDER)[number];

export interface SyncExecutionPlan {
  mode: "default" | "custom";
  count: number;
  resources: SupportedSyncResource[];
}

const SUPPORTED_RESOURCES = new Set<string>(DEFAULT_RESOURCE_ORDER);

export function isSupportedResource(
  resource: string,
): resource is SupportedSyncResource {
  return SUPPORTED_RESOURCES.has(resource);
}

export function validateResourceSelection(
  requested: readonly string[],
): SupportedSyncResource[] {
  const seen = new Set<string>();
  const validated: SupportedSyncResource[] = [];

  for (const resource of requested) {
    if (!isSupportedResource(resource)) {
      throw new Error(`Unsupported sync resource: ${resource}`);
    }
    if (seen.has(resource)) {
      throw new Error(`Duplicate sync resource: ${resource}`);
    }
    seen.add(resource);
    validated.push(resource);
  }

  return validated;
}

export function createExecutionPlan(
  requested: readonly string[] = [],
): SyncExecutionPlan {
  const mode = requested.length === 0 ? "default" : "custom";
  const resources =
    mode === "default"
      ? [...DEFAULT_RESOURCE_ORDER]
      : validateResourceSelection(requested);

  return {
    mode,
    count: resources.length,
    resources,
  };
}
