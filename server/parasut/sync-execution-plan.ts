export const DEFAULT_RESOURCE_ORDER = [
  "contacts",
  "products",
  "sales_invoices",
  "purchase_bills",
  "accounts",
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
