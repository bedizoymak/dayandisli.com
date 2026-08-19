import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260817090000_payment_instruments_local_operations.sql";
const obsoleteGeneratedPath =
  "supabase/migrations/20260814234746_payment_instruments_local_operations.sql";
const migration = readFileSync(migrationPath, "utf8");

describe("payment instruments local operations migration", () => {
  it("uses the post-quote-history migration timestamp and leaves no stale empty migration", () => {
    expect(existsSync(migrationPath)).toBe(true);
    expect(existsSync(obsoleteGeneratedPath)).toBe(false);
  });

  it("uses the live ERP user company scope instead of a nonexistent companies FK", () => {
    expect(migration).toContain("erp_user.accessible_company_ids");
    expect(migration).toContain(
      "create or replace function private.erp_user_can_access_company",
    );
    expect(migration).not.toMatch(
      /company_id\s+uuid[^,]*references\s+public\.companies/i,
    );
    expect(migration).toContain(
      "target_company_id = any(\n        coalesce(erp_user.accessible_company_ids",
    );
  });

  it("keeps admin/planner permission bypass separate from tenant membership", () => {
    const helper = migration.match(
      /create or replace function private\.erp_user_can_access_company[\s\S]*?\$\$;/i,
    )?.[0];
    expect(helper).toBeTruthy();
    expect(helper).toContain("target_company_id = any");
    expect(helper).toContain("erp_user.role in ('admin', 'planner')");
    expect(helper).toContain("required_permission like 'finance.%'");
    expect(helper).toContain("'system.manage' = any");
  });

  it("models local cheques and validated mirror overlays without Paraşüt writes", () => {
    expect(migration).toContain("create table public.payment_instruments");
    expect(migration).toContain("source in ('erp_local', 'parasut_mirror')");
    expect(migration).toContain("mirror.source_archived is not true");
    expect(migration).toContain(
      "create unique index payment_instruments_mirror_external_unique_idx",
    );
    expect(migration).not.toMatch(
      /\b(?:insert\s+into|update|delete\s+from)\s+parasut\./i,
    );
    expect(migration).toContain(
      "nullif(mirror_row.attributes ->> 'bank_identifier', '')",
    );
    expect(migration).toContain("or new.notes is distinct from old.notes");
    expect(migration).toMatch(
      /if new\.source = 'parasut_mirror'[\s\S]*?new\.notes := coalesce\([\s\S]*?mirror_row\.description[\s\S]*?mirror_row\.attributes ->> 'description'/i,
    );
    expect(migration).not.toMatch(
      /if tg_op = 'INSERT' and new\.notes is null then/i,
    );
    expect(migration).toContain("mirror_row.relationships #>> '{issued_by,data,id}'");
    expect(migration).toContain("mirror_row.relationships #>> '{given_to,data,id}'");
    expect(migration).toContain("Kaynak Paraşüt taraf ilişkisi ERP içinde değiştirilemez.");
    expect(migration).not.toContain(
      "nullif(mirror_row.attributes ->> 'remaining', '')::numeric,\n      new.original_amount",
    );
  });

  it("derives party labels from validated source rows instead of trusting client snapshots", () => {
    expect(migration).toContain("new.contact_snapshot_name := contact_name");
    expect(migration).toContain(
      "new.contact_snapshot_name := local_quote_customer_name",
    );
    expect(migration).toContain("new.contact_snapshot_name := null");
  });

  it("documents the local quote customer FK as referential-only", () => {
    expect(migration).toContain(
      "references public.quote_customers(id) on delete restrict",
    );
    expect(migration).toContain(
      "Referential-only FK to quote_customers(id); quote_customers has no company_id",
    );
    expect(migration).toContain(
      "create index payment_instruments_local_quote_customer_fk_idx",
    );
  });

  it("makes history append-only and trigger-generated", () => {
    expect(migration).toContain("create table public.payment_instrument_events");
    expect(migration).toContain("private.log_payment_instrument_event()");
    expect(migration).toContain("payment_instrument_events_reject_mutation");
    expect(migration).toContain(
      "grant select on table public.payment_instrument_events to authenticated",
    );
    expect(migration).not.toMatch(
      /grant\s+(?:[^;]*,\s*)?(?:insert|update|delete)[^;]*payment_instrument_events\s+to\s+authenticated/i,
    );
  });

  it("exposes only the controlled local status transition RPC", () => {
    expect(migration).toContain(
      "create or replace function public.transition_payment_instrument",
    );
    expect(migration).toContain("current_instrument.source <> 'erp_local'");
    expect(migration).toContain(
      "current_instrument.settlement_status <> 'open'",
    );
    expect(migration).toContain(
      "target_status not in ('paid', 'cancelled', 'returned')",
    );
    expect(migration).toContain(
      "target_status in ('cancelled', 'returned') and operation_note is null",
    );
    expect(migration).toContain(
      "grant execute on function public.transition_payment_instrument(uuid, text, text) to authenticated",
    );
  });

  it("supports atomic and consistent open or paid local inserts", () => {
    expect(migration).toContain("if new.settlement_status = 'open' then");
    expect(migration).toContain("elsif new.settlement_status = 'paid' then");
    expect(migration).toContain(
      "new.paid_at := clock_timestamp()",
    );
    expect(migration).toContain(
      "constraint payment_instruments_local_paid_at_required",
    );
    expect(migration).toContain("settlement_status = 'paid'");
    expect(migration).toContain("Kapanmış çek düzenlenemez.");
  });

  it("omits tenant, source, mirror identity, and settlement columns from direct UPDATE grants", () => {
    const updateColumns = migration.match(
      /grant update \(([\s\S]*?)\) on public\.payment_instruments to authenticated;/i,
    )?.[1];
    expect(updateColumns).toBeTruthy();
    expect(updateColumns).not.toMatch(/\bcompany_id\b/);
    expect(updateColumns).not.toMatch(/\bsource\b/);
    expect(updateColumns).not.toMatch(/\bexternal_parasut_id\b/);
    expect(updateColumns).not.toMatch(/\bsettlement_status\b/);
    expect(updateColumns).not.toMatch(/\bremaining_amount\b/);
    expect(updateColumns).not.toMatch(/\bpaid_at\b/);
    expect(updateColumns).not.toMatch(/\blocal_quote_customer_id\b/);
    const insertColumns = migration.match(
      /grant insert \(([\s\S]*?)\) on public\.payment_instruments to authenticated;/i,
    )?.[1];
    expect(insertColumns).toBeTruthy();
    expect(insertColumns).not.toMatch(/\blocal_quote_customer_id\b/);
    expect(insertColumns).not.toMatch(/\bpaid_at\b/);
  });

  it("enables RLS, explicitly grants authenticated access, and grants no hard delete", () => {
    expect(migration).toContain(
      "alter table public.payment_instruments enable row level security",
    );
    expect(migration).toContain("payment_instruments_insert_local");
    expect(migration).toContain("payment_instruments_insert_mirror_overlay");
    expect(migration).toContain("payment_instruments_update_company");
    expect(migration).toContain(
      "revoke all on table public.payment_instruments from anon, authenticated, service_role",
    );
    expect(migration).not.toMatch(
      /grant\s+[^;]*delete[^;]*payment_instruments/i,
    );
    expect(migration).toContain("payment_instruments_reject_delete");
  });
});
