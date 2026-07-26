import { describe, expect, it } from "vitest";
import { FIELD_MAPPING_REGISTRY } from "./field-mapping-registry.ts";
import { ALL_CASES, buildFieldLedger, type CoverageStatus } from "./field-coverage-ledger.ts";

describe("field-coverage-ledger — TASK 4 mechanical proof for all 401 fields", () => {
  const ledger = buildFieldLedger(FIELD_MAPPING_REGISTRY as unknown as Array<{ resource: string; attribute: string; expectedPgType: string; sourceLocation: string; expectedColumn: string }>);

  it("produces exactly one ledger row per registry field", () => {
    expect(ledger.length).toBe(401);
  });

  it("leaves no applicable case BLOCKED for any of the 401 fields", () => {
    const blocked: string[] = [];
    for (const row of ledger) {
      for (const c of ALL_CASES) {
        if (row.cases[c] === "BLOCKED") blocked.push(`${row.resource}.${row.attribute}:${c}`);
      }
    }
    expect(blocked, `blocked cases: ${blocked.slice(0, 20).join(", ")}${blocked.length > 20 ? "..." : ""}`).toEqual([]);
  });

  it("every case for every field is exactly one of TESTED or NOT_APPLICABLE (never undefined, never any other value)", () => {
    const valid = new Set<CoverageStatus>(["TESTED", "NOT_APPLICABLE"]);
    for (const row of ledger) {
      for (const c of ALL_CASES) {
        expect(valid.has(row.cases[c]), `${row.resource}.${row.attribute}:${c} = ${row.cases[c]}`).toBe(true);
      }
    }
  });

  it("input_immutability and deterministic_repeat are TESTED for all 401 fields (global properties, proven once generically and here confirmed applicable everywhere)", () => {
    for (const row of ledger) {
      expect(row.cases.input_immutability).toBe("TESTED");
      expect(row.cases.deterministic_repeat).toBe("TESTED");
    }
  });

  it("valid_value is TESTED for all 401 fields (directly, by the full per-resource pass in offline-mapper.test.ts)", () => {
    for (const row of ledger) {
      expect(row.cases.valid_value).toBe("TESTED");
    }
  });

  it("relationship_extraction and malformed_relationship apply only to relationship-location fields, and are TESTED there", () => {
    for (const field of FIELD_MAPPING_REGISTRY) {
      const row = ledger.find((r) => r.resource === field.resource && r.attribute === field.attribute)!;
      if (field.sourceLocation === "relationships") {
        expect(row.cases.relationship_extraction).toBe("TESTED");
        expect(row.cases.malformed_relationship).toBe("TESTED");
      } else {
        expect(row.cases.relationship_extraction).toBe("NOT_APPLICABLE");
        expect(row.cases.malformed_relationship).toBe("NOT_APPLICABLE");
      }
    }
  });

  it("produces a summary tally with zero BLOCKED across all 401 fields x applicable cases", () => {
    const tally = { TESTED: 0, NOT_APPLICABLE: 0, BLOCKED: 0 };
    for (const row of ledger) {
      for (const c of ALL_CASES) tally[row.cases[c]]++;
    }
    // eslint-disable-next-line no-console
    console.log(JSON.stringify({ totalFields: ledger.length, casesPerField: ALL_CASES.length, ...tally }));
    expect(tally.BLOCKED).toBe(0);
    expect(tally.TESTED + tally.NOT_APPLICABLE).toBe(ledger.length * ALL_CASES.length);
  });
});
