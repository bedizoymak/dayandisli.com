import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(moduleDir, "../../../../..");

function readSource(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

describe("the read-only Paraşüt mirror path (parasut-api) has no write capability", () => {
  it("the frontend read api client only exposes a single read (callParasutApi) function", () => {
    const source = readSource("src/features/erp/parasut/api/client.ts");
    expect(source).toMatch(/export async function callParasutApi/);
    expect(source).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  });

  it("the parasut-api edge function performs no insert/update/upsert/delete against the parasut or integration schema", () => {
    const source = readSource("supabase/functions/parasut-api/index.ts");
    expect(source).not.toMatch(/\.insert\(|\.update\(|\.upsert\(|\.delete\(/);
  });

  it("the read-only edge function never imports or calls the Paraşüt write client", () => {
    const source = readSource("supabase/functions/parasut-api/index.ts");
    expect(source).not.toMatch(/write-client|ParasutContactWriteHttpClient|CustomerWriteProvider/i);
  });
});

// The bidirectional customer-creation write path (Phase 007,
// DAYANDISLI_PHASE_SYSTEM_V3.md §8) is a deliberate, narrowly-scoped
// exception to the rule above — confined entirely to its own
// parasut-write-api function/write-client.ts, never merged into the
// read-only path. These assertions prove the confinement, not its absence.
describe("the write path (parasut-write-api) is confined to its own dedicated files", () => {
  it("the frontend write client only exposes callParasutWriteApi, and calls the write-api function, never parasut-api", () => {
    const source = readSource("src/features/erp/parasut/api/write-client.ts");
    expect(source).toMatch(/export async function callParasutWriteApi/);
    expect(source).toMatch(/"parasut-write-api"/);
    expect(source).not.toMatch(/"parasut-api"/);
  });

  it("the dedicated Paraşüt write client only ever POSTs to the confirmed /contacts endpoint, never an arbitrary path", () => {
    const source = readSource("server/parasut/write-client.ts");
    expect(source).toMatch(/\/v4\/\$\{encodeURIComponent\(companyId\)\}\/contacts/);
    expect(source).not.toMatch(/method:\s*["'](PATCH|PUT|DELETE)["']/);
  });
});
