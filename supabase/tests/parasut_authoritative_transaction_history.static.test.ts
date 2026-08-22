import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/20260822114826_parasut_authoritative_transaction_history.sql"),
  "utf8",
).toLowerCase();

describe("authoritative Paraşüt statement migration", () => {
  it("extends transactions and creates stable statement/opening-balance mirrors", () => {
    expect(sql).toContain("alter table parasut.transactions");
    expect(sql).toContain("contact_parasut_id text");
    expect(sql).toContain("create table parasut.transaction_history_items");
    expect(sql).toContain("unique (parasut_company_id, contact_parasut_id, transaction_parasut_id)");
    expect(sql).toContain("create table parasut.opening_balances");
  });

  it("indexes statement ordering and locks new tables to service role", () => {
    expect(sql).toContain("transaction_history_items_contact_order_idx");
    expect(sql).toContain("alter table parasut.transaction_history_items enable row level security");
    expect(sql).toContain("revoke all on table parasut.transaction_history_items from anon, authenticated");
    expect(sql).toContain("grant all on table parasut.opening_balances to service_role");
  });

  it("contains no destructive financial rewrite", () => {
    expect(sql).not.toMatch(/\b(delete|truncate|drop\s+table)\b/);
    expect(sql).not.toMatch(/update\s+parasut\./);
  });
});
