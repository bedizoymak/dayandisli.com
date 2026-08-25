// PHASE 5A architecture guard (extended in later phases): source-layering
// rules enforced statically, same scan style as the Supabase-client guard.
// Rule 1: authentication code must not depend on erpApi.ts (the legacy
// god-module). Auth's live surface lives in shared/auth.ts + api/internal;
// erpApi.ts remains only until its last consumer (the unrouted admin
// feature) is removed.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const FORBIDDEN_ERPAPI_IMPORTERS = ["src/contexts/ERPAuthContext.tsx", "src/pages/Login.tsx"];

describe("architecture: auth layering", () => {
  it("authentication code does not import the erpApi god-module", () => {
    const violations: string[] = [];
    for (const rel of FORBIDDEN_ERPAPI_IMPORTERS) {
      const file = join(__dirname, "..", rel);
      let source = "";
      try {
        source = readFileSync(file, "utf-8");
      } catch {
        continue; // file removed in a later phase — rule vacuously holds
      }
      if (source.includes("@/features/erp/shared/erpApi")) violations.push(rel);
    }
    expect(violations).toEqual([]);
  });
});
