import { createHash } from "node:crypto";
import type {
  JsonApiResource,
  JsonObject,
  MirrorDatabase,
  MirrorResourceDefinition,
  MirrorResourceRow,
  UpsertResult,
} from "./types.ts";
import { PARASUT_MIRROR_SCHEMA } from "./types.ts";
import { deriveOfflineRow } from "./offline-mapper.ts";
import { shouldUseTypedMapping } from "./typed-mapping-gate.ts";

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

const CANONICAL_DECIMAL_STRING = /^-?\d+(\.\d+)?$/;

/**
 * Mirrors the same field into its own typed numeric column, verbatim as the
 * canonical decimal Paraşüt sent (never Turkish-locale-reinterpreted — see
 * hashResource's docstring on why "." must never be treated as a thousands
 * separator here). Null/absent/non-canonical values become a null column,
 * never a silently coerced 0 or NaN.
 */
function numericAttributeValue(attributes: JsonObject, key: string): number | null {
  const value = attributes[key];
  if (typeof value === "number") return value;
  if (typeof value === "string" && CANONICAL_DECIMAL_STRING.test(value)) return Number(value);
  return null;
}

function numericColumns(
  definition: MirrorResourceDefinition,
  attributes: JsonObject,
): Record<string, number | null> {
  const fields = definition.numericAttributeFields ?? [];
  const columns: Record<string, number | null> = {};
  for (const field of fields) {
    columns[field] = numericAttributeValue(attributes, field);
  }
  return columns;
}

/**
 * Phase 2B: typed-column values driven by the canonical field-mapping
 * registry (server/parasut/field-mapping-registry.ts), via the same pure
 * deriveOfflineRow() already used and tested in Phase 2A — no new
 * conversion logic is introduced here, only wiring.
 *
 * Gated by shouldUseTypedMapping(): disabled by default (§ typed-mapping-gate.ts),
 * and even when enabled, scope-confined to TYPED_MAPPING_SCOPED_RESOURCES —
 * both the resource allowlist and the column set come only from static,
 * compile-time-constant sources (the registry), never from any dynamic or
 * request-supplied identifier, so no unknown property can reach a SQL
 * column/table name.
 *
 * When disabled or out of scope, returns {} — the row falls back to
 * exactly the legacy numericColumns()-only behavior, byte-for-byte
 * unchanged from before this function existed.
 */
function typedRegistryColumns(
  resource: JsonApiResource,
  env?: Record<string, string | undefined>,
): Record<string, unknown> {
  if (!shouldUseTypedMapping(resource.type, env)) return {};
  return { ...deriveOfflineRow(resource).values };
}

function relationshipId(relationships: JsonObject, key: string): string | null {
  const relation = relationships[key] as { data?: { id?: unknown } | null } | undefined;
  const id = relation?.data?.id;
  return typeof id === "string" && id ? id : null;
}

function authoritativeStatementColumns(resource: JsonApiResource): Record<string, unknown> {
  const attributes = resource.attributes ?? {};
  const relationships = resource.relationships ?? {};
  if (resource.type === "transactions") {
    return {
      description: attributes.description ?? null,
      transaction_type: attributes.transaction_type ?? null,
      date: attributes.date ?? null,
      debit_currency: attributes.debit_currency ?? null,
      credit_currency: attributes.credit_currency ?? null,
      contact_parasut_id: relationshipId(relationships, "contact"),
      check_parasut_id: relationshipId(relationships, "check"),
      sales_invoice_parasut_id: relationshipId(relationships, "sales_invoice"),
      purchase_bill_parasut_id: relationshipId(relationships, "purchase_bill"),
      reimbursement_purchase_bill_parasut_id: relationshipId(relationships, "reimbursement_purchase_bill"),
      opening_balance_parasut_id: relationshipId(relationships, "opening_balance"),
      contact_transfer_parasut_id: relationshipId(relationships, "contact_transfer"),
      unmatched_debit_amount: numericAttributeValue(attributes, "unmatched_debit_amount"),
      unmatched_credit_amount: numericAttributeValue(attributes, "unmatched_credit_amount"),
    };
  }
  if (resource.type === "transaction_history_items") {
    const order = numericAttributeValue(attributes, "order") ?? numericAttributeValue(attributes, "position") ?? Number(resource.id);
    return {
      contact_parasut_id: relationshipId(relationships, "contact"),
      transaction_parasut_id: relationshipId(relationships, "transaction"),
      statement_order: Number.isFinite(order) ? order : 0,
      transaction_date: attributes.date ?? attributes.transaction_date ?? null,
    };
  }
  if (resource.type === "opening_balances") {
    return {
      contact_parasut_id: relationshipId(relationships, "contact"),
      currency: attributes.currency ?? null,
      description: attributes.description ?? null,
      issue_date: attributes.issue_date ?? null,
      debit_credit_type: attributes.debit_credit_type ?? attributes.balance_type ?? null,
    };
  }
  if (resource.type === "payments") {
    return {
      payable_parasut_id: relationshipId(relationships, "payable"),
      transaction_parasut_id: relationshipId(relationships, "transaction"),
    };
  }
  return {};
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
    /** Injectable for tests; defaults to process.env. See typed-mapping-gate.ts. */
    typedMappingEnv?: Record<string, string | undefined>;
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
  const mirrorDb = database.schema(PARASUT_MIRROR_SCHEMA);

  const existing = await mirrorDb
    .from<{ id: string; payload_hash: string }>(definition.table)
    .select("id,payload_hash")
    .eq("parasut_company_id", context.parasutCompanyId)
    .eq("resource_type", resource.type)
    .eq("parasut_id", resource.id)
    .maybeSingle();
  if (existing.error) throw new Error(existing.error.message ?? "Mirror lookup failed");

  if (existing.data?.payload_hash === payloadHash) {
    const result = await mirrorDb
      .from(definition.table)
      .update({ last_seen_at: now })
      .eq("id", existing.data.id);
    if (result.error) throw new Error(result.error.message ?? "Mirror touch failed");
    return { outcome: "unchanged", payloadHash };
  }

  // Typed-column source of truth for this write: the registry-driven
  // mapper when Phase 2B's gate is enabled AND this resource is in scope;
  // otherwise (the default) the original numeric-only mapping, unchanged.
  // Never both — deriveOfflineRow's column set is already a strict
  // superset of numericColumns() for every scoped resource, so merging
  // would only risk divergent values from two independent code paths.
  const typedColumns = typedRegistryColumns(resource, context.typedMappingEnv);
  const mappedColumns = Object.keys(typedColumns).length > 0 ? typedColumns : numericColumns(definition, attributes);

  const row: MirrorResourceRow & Record<string, unknown> = {
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
    ...mappedColumns,
    ...authoritativeStatementColumns(resource),
  };

  if (existing.data) {
    const result = await mirrorDb
      .from(definition.table)
      .update(row)
      .eq("id", existing.data.id);
    if (result.error) throw new Error(result.error.message ?? "Mirror update failed");
    return { outcome: "updated", payloadHash };
  }

  const result = await mirrorDb.from(definition.table).insert(row);
  if (result.error) throw new Error(result.error.message ?? "Mirror insert failed");
  return { outcome: "inserted", payloadHash };
}
