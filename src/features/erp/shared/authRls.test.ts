import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  "supabase/migrations/20260614061645_unified_erp_user_authorization.sql",
  "utf8",
);

describe("unified ERP user authorization migration", () => {
  it("limits browser self-read to active linked or transitional email rows", () => {
    expect(migration).toContain("create policy erp_users_select_own_active");
    expect(migration).toContain("auth_user_id = (select auth.uid())");
    expect(migration).toContain("auth_user_id is null");
    expect(migration).toContain("lower(email) = lower((select auth.jwt() ->> 'email'))");
    expect(migration).toContain("is_active");
  });

  it("does not expose ERP users to anonymous clients or browser writes", () => {
    expect(migration).toContain("revoke all on table public.erp_users from anon");
    expect(migration).toContain("revoke insert, update, delete on table public.erp_users from authenticated");
    expect(migration).toContain("grant select on table public.erp_users to authenticated");
  });

  it("keeps legacy tables and removes their runtime policy dependencies", () => {
    expect(migration).not.toMatch(/drop table\s+(if exists\s+)?public\.(admin_users|allowed_emails)/i);
    expect(migration).toContain("admin_users|allowed_emails|is_email_allowed");
    expect(migration).toContain("revoke all on function public.is_email_allowed(text) from authenticated");
  });
});
