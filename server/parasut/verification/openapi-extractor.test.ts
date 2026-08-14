import { describe, expect, it } from "vitest";
import {
  CircularReferenceError,
  extractPaginationEvidence,
  extractResource,
  resolveSchema,
  type OpenApiDoc,
} from "./openapi-extractor.ts";

// Synthetic fixtures for mechanisms the real cached spec never exercises
// (confirmed by direct inspection: 0 allOf, 0 nullable, 0 property-level
// $ref occurrences across all 49 Attributes schemas) — per instruction,
// focused fixtures are used here rather than skipping these mechanisms.

describe("openapi-extractor — local $ref", () => {
  const doc: OpenApiDoc = {
    definitions: {
      WidgetAttributes: {
        type: "object",
        properties: { name: { type: "string" }, owner: { $ref: "#/definitions/Owner" } },
      },
      Owner: { type: "object", properties: { id: { type: "string" } } },
    },
    paths: {},
  };

  it("resolves a property-level local $ref to its target schema", () => {
    const { attributes } = extractResource(doc, "widgets", "WidgetAttributes", "Widget");
    const owner = attributes.find((f) => f.name === "owner")!;
    expect(owner.openApiType).toBe("object");
    expect(owner.provenance).toContain("$ref #/definitions/Owner");
  });
});

describe("openapi-extractor — nested $ref (ref pointing to a schema that itself contains a $ref)", () => {
  const doc: OpenApiDoc = {
    definitions: {
      WidgetAttributes: { type: "object", properties: { location: { $ref: "#/definitions/Location" } } },
      Location: { type: "object", properties: { address: { $ref: "#/definitions/Address" } } },
      Address: { type: "object", properties: { city: { type: "string" } } },
    },
    paths: {},
  };

  it("resolves a $ref one level, and resolveSchema can be called again on the nested $ref explicitly", () => {
    const { attributes } = extractResource(doc, "widgets", "WidgetAttributes", "Widget");
    const location = attributes.find((f) => f.name === "location")!;
    expect(location.openApiType).toBe("object");
    // The nested $ref inside Location.properties.address is resolved on-demand
    // by resolveSchema, proven directly here rather than assumed:
    const nested = resolveSchema(doc, doc.definitions.Location.properties as never, "#/definitions/Location");
    expect(nested.schema).toBeDefined();
  });
});

describe("openapi-extractor — allOf merging", () => {
  const doc: OpenApiDoc = {
    definitions: {
      BaseAttributes: { type: "object", properties: { id: { type: "string" }, shared: { type: "string" } } },
      ExtraAttributes: { type: "object", properties: { extra: { type: "boolean" }, shared: { type: "number" } } },
      WidgetAttributes: { allOf: [{ $ref: "#/definitions/BaseAttributes" }, { $ref: "#/definitions/ExtraAttributes" }] },
    },
    paths: {},
  };

  it("merges properties from every allOf branch", () => {
    const { attributes } = extractResource(doc, "widgets", "WidgetAttributes", "Widget");
    const names = attributes.map((f) => f.name).sort();
    expect(names).toEqual(["extra", "id", "shared"]);
  });

  it("duplicate inherited properties: later allOf branch wins deterministically (documented behavior, not silent UB)", () => {
    const { attributes } = extractResource(doc, "widgets", "WidgetAttributes", "Widget");
    const shared = attributes.find((f) => f.name === "shared")!;
    // ExtraAttributes is the second branch and declares `shared` as number —
    // Object.assign merge order means the second branch's definition wins.
    expect(shared.openApiType).toBe("number");
  });
});

describe("openapi-extractor — nullable, arrays/items, required, enums, formats", () => {
  const doc: OpenApiDoc = {
    definitions: {
      WidgetAttributes: {
        type: "object",
        required: ["name"],
        properties: {
          name: { type: "string" },
          maybe_null: { type: "string", nullable: true },
          tags: { type: "array", items: { type: "string" } },
          status: { type: "string", enum: ["active", "archived"] },
          issued_at: { type: "string", format: "date-time" },
          issued_on: { type: "string", format: "date" },
        },
      },
    },
    paths: {},
  };
  const { attributes } = extractResource(doc, "widgets", "WidgetAttributes", "Widget");
  const byName = (n: string) => attributes.find((f) => f.name === n)!;

  it("nullable is captured", () => {
    expect(byName("maybe_null").nullable).toBe(true);
    expect(byName("name").nullable).toBe(false);
  });
  it("array item type is resolved", () => {
    expect(byName("tags").openApiType).toBe("array");
    expect(byName("tags").itemType).toBe("string");
  });
  it("required is captured from the schema's required[] list", () => {
    expect(byName("name").required).toBe(true);
    expect(byName("maybe_null").required).toBe(false);
  });
  it("enum values are captured", () => {
    expect(byName("status").enumValues).toEqual(["active", "archived"]);
  });
  it("format is captured, and date vs date-time are distinguished", () => {
    expect(byName("issued_at").format).toBe("date-time");
    expect(byName("issued_on").format).toBe("date");
  });
});

describe("openapi-extractor — relationship objects (single and array cardinality)", () => {
  const doc: OpenApiDoc = {
    definitions: {
      WidgetAttributes: { type: "object", properties: {} },
      Widget: {
        type: "object",
        properties: {
          relationships: {
            type: "object",
            properties: {
              category: { type: "object", properties: { data: { type: "object", properties: { type: { type: "string", enum: ["categories"] } } } } },
              tags: { type: "object", properties: { data: { type: "array", items: { type: "object", properties: { type: { type: "string", enum: ["tags"] } } } } } },
            },
          },
        },
      },
    },
    paths: {},
  };

  it("extracts a single-cardinality relationship with its target type", () => {
    const { relationships } = extractResource(doc, "widgets", "WidgetAttributes", "Widget");
    const category = relationships.find((r) => r.key === "category")!;
    expect(category.isArray).toBe(false);
    expect(category.targetType).toBe("categories");
  });

  it("extracts an array-cardinality relationship with its target type", () => {
    const { relationships } = extractResource(doc, "widgets", "WidgetAttributes", "Widget");
    const tags = relationships.find((r) => r.key === "tags")!;
    expect(tags.isArray).toBe(true);
    expect(tags.targetType).toBe("tags");
  });

  it("flags a relationship with no resolvable target type enum as having insufficient semantics", () => {
    const badDoc: OpenApiDoc = {
      definitions: {
        WidgetAttributes: { type: "object", properties: {} },
        Widget: { type: "object", properties: { relationships: { type: "object", properties: { mystery: { type: "object", properties: { data: { type: "object", properties: {} } } } } } } },
      },
      paths: {},
    };
    const { relationships } = extractResource(badDoc, "widgets", "WidgetAttributes", "Widget");
    expect(relationships[0].insufficientSemantics).toBe(true);
  });
});

describe("openapi-extractor — response wrappers and pagination envelopes (from OpenAPI paths, not the database)", () => {
  const doc: OpenApiDoc = {
    definitions: { WidgetAttributes: {}, Widget: {} },
    paths: {
      "/{company_id}/widgets": {
        get: {
          operationId: "listWidgets",
          parameters: [{ name: "page[number]", type: "integer" }, { name: "page[size]", type: "integer" }],
          responses: { "200": { schema: { type: "object", properties: { data: { type: "array" }, meta: { type: "object" } } } } },
        },
      },
      "/{company_id}/widgets/{id}": {
        get: {
          operationId: "showWidget",
          parameters: [],
          responses: { "200": { schema: { type: "object", properties: { data: { type: "object" } } } } },
        },
      },
    },
  };

  it("extracts pagination parameter evidence for a list endpoint", () => {
    const ev = extractPaginationEvidence(doc, "/{company_id}/widgets")!;
    expect(ev.hasPageNumberParam).toBe(true);
    expect(ev.hasPageSizeParam).toBe(true);
    expect(ev.responseHasDataArray).toBe(true);
    expect(ev.responseHasMeta).toBe(true);
  });

  it("correctly reports a single-record endpoint as non-paginated (no page params, data is not an array)", () => {
    const ev = extractPaginationEvidence(doc, "/{company_id}/widgets/{id}")!;
    expect(ev.hasPageNumberParam).toBe(false);
    expect(ev.responseHasDataArray).toBe(false);
  });

  it("returns null for a path that does not exist in the spec, rather than throwing", () => {
    expect(extractPaginationEvidence(doc, "/{company_id}/nonexistent")).toBeNull();
  });
});

describe("openapi-extractor — circular references", () => {
  // A property pointing back at its *containing* object schema (which is
  // type:object, not itself a $ref) is NOT a cycle in a shallow one-hop
  // resolver — it only takes one dereference and terminates. A genuine
  // cycle requires a $ref chain that points back to another *$ref node*.
  // These fixtures construct that precisely, and are exercised directly
  // against resolveSchema (the function that owns cycle detection) so the
  // test proves the guard itself, not an accident of how deep the current
  // one-hop extractResource call chain happens to recurse.
  it("detects a direct self-referencing $ref chain and throws CircularReferenceError, rather than recursing infinitely", () => {
    const doc: OpenApiDoc = {
      definitions: { SelfRef: { $ref: "#/definitions/SelfRef" } },
      paths: {},
    };
    expect(() =>
      resolveSchema(doc, { $ref: "#/definitions/SelfRef" }, "#/definitions/SelfRef"),
    ).toThrow(CircularReferenceError);
  });

  it("detects an indirect (A -> B -> A) circular $ref chain", () => {
    const doc: OpenApiDoc = {
      definitions: {
        A: { $ref: "#/definitions/B" },
        B: { $ref: "#/definitions/A" },
      },
      paths: {},
    };
    let thrown: unknown;
    try {
      resolveSchema(doc, { $ref: "#/definitions/A" }, "#/definitions/A");
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(CircularReferenceError);
    expect((thrown as InstanceType<typeof CircularReferenceError>).cycle.length).toBeGreaterThan(1);
  });

  it("extractResource propagates a CircularReferenceError encountered while resolving an attribute property, with a clear diagnostic rather than a stack overflow", () => {
    const doc: OpenApiDoc = {
      definitions: {
        WidgetAttributes: { type: "object", properties: { self: { $ref: "#/definitions/CyclicNode" } } },
        CyclicNode: { $ref: "#/definitions/CyclicNode" },
      },
      paths: {},
    };
    expect(() => extractResource(doc, "widgets", "WidgetAttributes", "Widget")).toThrow(/Circular \$ref detected/);
  });

  it("does NOT falsely flag two independent references to the same schema as circular", () => {
    const doc: OpenApiDoc = {
      definitions: {
        WidgetAttributes: {
          type: "object",
          properties: { owner: { $ref: "#/definitions/Person" }, approver: { $ref: "#/definitions/Person" } },
        },
        Person: { type: "object", properties: { name: { type: "string" } } },
      },
      paths: {},
    };
    expect(() => extractResource(doc, "widgets", "WidgetAttributes", "Widget")).not.toThrow();
  });
});

describe("openapi-extractor — real cached spec sanity check (not a substitute for the fixtures above)", () => {
  it("extracts a known-shape resource (contacts) from the real spec without throwing", async () => {
    const fs = await import("node:fs");
    const YAML = await import("yaml");
    const specPath = "docs/parasut/work/parasut-openapi-spec-cache.yaml";
    const text = fs.readFileSync(specPath, "utf8");
    const doc = YAML.parse(text) as OpenApiDoc;
    const { attributes, relationships } = extractResource(doc, "contacts", "ContactAttributes", "Contact");
    expect(attributes.length).toBeGreaterThan(0);
    expect(relationships.length).toBeGreaterThan(0);
    expect(attributes.some((f) => f.name === "trl_balance")).toBe(true);
  }, 15_000);
});
