import { createHash } from "node:crypto";
import type {
  JsonApiResource,
  JsonObject,
  MirrorDatabase,
  MirrorResourceDefinition,
  MirrorResourceRow,
  UpsertResult,
} from "./types.ts";

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, canonicalValue(item)]),
    );
  }
  return value;
}

export function canonicalResource(resource: JsonApiResource): string {
  return JSON.stringify(
    canonicalValue({
      type: resource.type,
      id: resource.id,
      attributes: resource.attributes ?? {},
      relationships: resource.relationships ?? {},
    }),
  );
}

export function hashResource(resource: JsonApiResource): string {
  return createHash("sha256").update(canonicalResource(resource)).digest("hex");
}

function sourceTimestamp(attributes: JsonObject, key: string): string | null {
  const value = attributes[key];
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) return null;
  return new Date(value).toISOString();
}

export async function upsertResource(
  database: MirrorDatabase,
  definition: MirrorResourceDefinition,
  resource: JsonApiResource,
  context: {
    companyId: string;
    parasutCompanyId: string;
    included?: JsonApiResource[];
    now?: Date;
  },
): Promise<UpsertResult> {
  if (!resource.id || resource.type !== definition.resourceType) {
    throw new Error(
      `Resource type mismatch: expected ${definition.resourceType}, received ${resource.type}`,
    );
  }

  const now = (context.now ?? new Date()).toISOString();
  const payloadHash = hashResource(resource);
  const attributes = resource.attributes ?? {};
  const relationships = resource.relationships ?? {};
  const included = context.included ?? [];

  const existing = await database
    .from<{ id: string; payload_hash: string }>(definition.table)
    .select("id,payload_hash")
    .eq("parasut_company_id", context.parasutCompanyId)
    .eq("resource_type", resource.type)
    .eq("parasut_id", resource.id)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message ?? "Mirror lookup failed");

  if (existing.data?.payload_hash === payloadHash) {
    const result = await database
      .from(definition.table)
      .update({ last_seen_at: now })
      .eq("id", existing.data.id);
    if (result.error) throw new Error(result.error.message ?? "Mirror touch failed");
    return { outcome: "unchanged", payloadHash };
  }

  const row: MirrorResourceRow = {
    company_id: context.companyId,
    parasut_id: resource.id,
    parasut_company_id: context.parasutCompanyId,
    resource_type: resource.type,
    attributes,
    relationships,
    included,
    raw_payload: resource,
    source_created_at: sourceTimestamp(attributes, "created_at"),
    source_updated_at: sourceTimestamp(attributes, "updated_at"),
    source_archived:
      typeof attributes.archived === "boolean" ? attributes.archived : null,
    last_seen_at: now,
    synced_at: now,
    payload_hash: payloadHash,
  };

  if (existing.data) {
    const result = await database
      .from(definition.table)
      .update(row)
      .eq("id", existing.data.id);
    if (result.error) throw new Error(result.error.message ?? "Mirror update failed");
    return { outcome: "updated", payloadHash };
  }

  const result = await database.from(definition.table).insert(row);
  if (result.error) throw new Error(result.error.message ?? "Mirror insert failed");
  return { outcome: "inserted", payloadHash };
}
