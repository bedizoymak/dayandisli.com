// Phase 1 permanent verification tooling: pure, deterministic extraction of
// official Paraşüt API attributes/relationships from a parsed OpenAPI
// (Swagger 2.0) document. No database access, no HTTP calls, no file I/O —
// callers supply the already-parsed spec object. This is the authoritative
// replacement for the ad-hoc scratchpad extraction scripts used in earlier
// audit passes; those scripts are retired, not reused.

export type JsonSchema = Record<string, unknown>;
export type OpenApiDoc = { definitions: Record<string, JsonSchema>; paths: Record<string, Record<string, unknown>> };

export interface ResolvedField {
  name: string;
  openApiType: string;
  format: string | null;
  enumValues: readonly string[] | null;
  nullable: boolean;
  required: boolean;
  itemType: string | null;
  jsonPointer: string;
  provenance: string;
  insufficientSemantics: boolean;
}

export class CircularReferenceError extends Error {
  readonly cycle: string[];
  constructor(cycle: string[]) {
    super(`Circular $ref detected: ${cycle.join(" -> ")}`);
    this.name = "CircularReferenceError";
    this.cycle = cycle;
  }
}

function resolveRef(doc: OpenApiDoc, ref: string): JsonSchema {
  const parts = ref.replace(/^#\//, "").split("/");
  let node: unknown = doc;
  for (const p of parts) {
    node = (node as Record<string, unknown>)?.[p];
  }
  if (!node || typeof node !== "object") {
    throw new Error(`Unresolvable $ref: ${ref}`);
  }
  return node as JsonSchema;
}

/**
 * Resolves $ref and allOf, with cycle detection via an explicit visited-ref
 * stack (thrown as CircularReferenceError, never an infinite loop / stack
 * overflow). One level of allOf-of-allOf is supported (recursive merge).
 */
export function resolveSchema(
  doc: OpenApiDoc,
  schema: JsonSchema | undefined,
  pointer: string,
  visitedRefs: readonly string[] = [],
): { schema: JsonSchema; provenance: string } {
  if (!schema) return { schema: {}, provenance: pointer };

  if (typeof schema.$ref === "string") {
    const ref = schema.$ref;
    if (visitedRefs.includes(ref)) {
      throw new CircularReferenceError([...visitedRefs, ref]);
    }
    const target = resolveRef(doc, ref);
    const resolved = resolveSchema(doc, target, ref, [...visitedRefs, ref]);
    return { schema: resolved.schema, provenance: `${pointer} -> $ref ${ref}` };
  }

  if (Array.isArray(schema.allOf)) {
    const merged: JsonSchema = { type: "object", properties: {} };
    const requiredSet = new Set<string>();
    let branchIndex = 0;
    for (const branch of schema.allOf as JsonSchema[]) {
      const resolvedBranch = resolveSchema(doc, branch, `${pointer}/allOf/${branchIndex}`, visitedRefs);
      const branchProps = (resolvedBranch.schema.properties as JsonSchema) || {};
      Object.assign(merged.properties as JsonSchema, branchProps);
      for (const r of (resolvedBranch.schema.required as string[]) || []) requiredSet.add(r);
      branchIndex++;
    }
    if (requiredSet.size > 0) merged.required = [...requiredSet];
    return { schema: merged, provenance: `${pointer} -> allOf(${(schema.allOf as unknown[]).length})` };
  }

  return { schema, provenance: pointer };
}

function fieldsFromSchema(doc: OpenApiDoc, schema: JsonSchema, basePointer: string): ResolvedField[] {
  const { schema: resolved } = resolveSchema(doc, schema, basePointer);
  const properties = (resolved.properties as Record<string, JsonSchema>) || {};
  const required = new Set((resolved.required as string[]) || []);

  return Object.entries(properties).map(([name, propSchema]) => {
    const pointer = `${basePointer}/properties/${name}`;
    const { schema: fieldSchema, provenance } = resolveSchema(doc, propSchema, pointer);
    const itemsSchema = fieldSchema.items as JsonSchema | undefined;
    const itemType = itemsSchema
      ? (resolveSchema(doc, itemsSchema, `${pointer}/items`).schema.type as string) || null
      : null;
    const hasType = typeof fieldSchema.type === "string";
    const hasProps = Boolean(fieldSchema.properties);
    return {
      name,
      openApiType: hasType ? (fieldSchema.type as string) : hasProps ? "object" : "unknown",
      format: (fieldSchema.format as string) || null,
      enumValues: (fieldSchema.enum as string[]) || null,
      nullable: fieldSchema.nullable === true,
      required: required.has(name),
      itemType,
      jsonPointer: pointer,
      provenance,
      insufficientSemantics: !hasType && !hasProps,
    };
  });
}

export interface ResolvedRelationship {
  key: string;
  targetType: string | null;
  isArray: boolean;
  jsonPointer: string;
  insufficientSemantics: boolean;
}

function relationshipsFromWrapper(doc: OpenApiDoc, wrapperSchema: JsonSchema, basePointer: string): ResolvedRelationship[] {
  const relSchema = (wrapperSchema.properties as JsonSchema)?.relationships as JsonSchema | undefined;
  if (!relSchema) return [];
  const relProps = (relSchema.properties as Record<string, JsonSchema>) || {};
  return Object.entries(relProps).map(([key, def]) => {
    const pointer = `${basePointer}/properties/relationships/properties/${key}`;
    const dataSchema = (def.properties as JsonSchema)?.data as JsonSchema | undefined;
    const isArray = dataSchema?.type === "array";
    const targetSchema = isArray ? (dataSchema?.items as JsonSchema)?.properties : dataSchema?.properties;
    const targetTypeEnum = (targetSchema as JsonSchema)?.type as JsonSchema | undefined;
    const targetType = (targetTypeEnum?.enum as string[])?.[0] || null;
    return { key, targetType, isArray: Boolean(isArray), jsonPointer: pointer, insufficientSemantics: !targetType };
  });
}

export interface PaginationEvidence {
  path: string;
  operationId: string | null;
  hasPageNumberParam: boolean;
  hasPageSizeParam: boolean;
  responseHasMeta: boolean;
  responseHasDataArray: boolean;
}

/** Extracts response-wrapper/pagination evidence directly from OpenAPI
 * paths/responses — never inferred from the database. */
export function extractPaginationEvidence(doc: OpenApiDoc, path: string, method = "get"): PaginationEvidence | null {
  const pathItem = doc.paths[path];
  if (!pathItem) return null;
  const op = pathItem[method] as JsonSchema | undefined;
  if (!op) return null;
  const params = (op.parameters as JsonSchema[]) || [];
  const hasPageNumberParam = params.some((p) => p.name === "page[number]");
  const hasPageSizeParam = params.some((p) => p.name === "page[size]");
  const responses = (op.responses as Record<string, JsonSchema>) || {};
  const okResponse = responses["200"];
  const responseSchema = (okResponse?.schema as JsonSchema)?.properties as JsonSchema | undefined;
  return {
    path,
    operationId: (op.operationId as string) || null,
    hasPageNumberParam,
    hasPageSizeParam,
    responseHasMeta: Boolean(responseSchema?.meta),
    responseHasDataArray: (responseSchema?.data as JsonSchema)?.type === "array",
  };
}

export interface ResourceExtraction {
  resource: string;
  attributesComponent: string;
  wrapperComponent: string;
  attributes: ResolvedField[];
  relationships: ResolvedRelationship[];
}

export function extractResource(
  doc: OpenApiDoc,
  resource: string,
  attributesSchemaName: string,
  wrapperSchemaName: string,
): ResourceExtraction {
  const attrsPointer = `#/definitions/${attributesSchemaName}`;
  const attrsSchema = doc.definitions[attributesSchemaName];
  const attributes = attrsSchema ? fieldsFromSchema(doc, attrsSchema, attrsPointer) : [];

  const wrapperPointer = `#/definitions/${wrapperSchemaName}`;
  const wrapperSchema = doc.definitions[wrapperSchemaName];
  const relationships = wrapperSchema ? relationshipsFromWrapper(doc, wrapperSchema, wrapperPointer) : [];

  return { resource, attributesComponent: attrsPointer, wrapperComponent: wrapperPointer, attributes, relationships };
}
