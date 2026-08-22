import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/20260822125055_add_authoritative_statement_included_envelopes.sql"), "utf8").toLowerCase();

describe("authoritative statement included envelopes", () => {
  it("adds only the shared json api included envelope", () => {
    expect(sql).toContain("alter table parasut.transaction_history_items");
    expect(sql).toContain("alter table parasut.opening_balances");
    expect(sql.match(/included jsonb not null default '\[\]'::jsonb/g)).toHaveLength(2);
    expect(sql).not.toMatch(/\b(delete|update|truncate|drop)\b/);
  });
});
