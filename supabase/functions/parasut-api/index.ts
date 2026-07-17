// Read-only API for the Paraşüt ERP module. This function is the ONLY way the
// frontend reaches the `parasut` Postgres schema: that schema
// are not in Supabase's exposed PostgREST schema list and RLS revokes all
// access from `anon`/`authenticated`, so only this service-role-backed
// function (or another server-side process) can read them. See
// PARASUT_ERP_MODULE_IMPLEMENTATION_REPORT.md for the full architecture.
//
// This function performs SELECT-only operations. It has no insert/update/
// delete/upsert code path, and it never calls the Paraşüt API itself.
//
// This is a thin Deno entrypoint: environment/auth/routing only. All actual
// query logic lives in ./handlers.ts, which has no Deno-specific imports so
// it can be unit-tested directly with Vitest (see handlers.test.ts) — the
// exact code that runs here is the exact code under test there.
//
// TENANT ISOLATION: `resolveAccess` below is the ONLY place in this function
// that queries `public.erp_users` without a company filter — that's the
// explicitly-allowed exception (it IS the authentication/authorization
// lookup that determines company access in the first place). Every other
// query goes through handlers.ts's `scopedParasutTable`/`scopedSyncTable`,
// which require and immediately apply an exact, validated `company_id`.
// There is no "unrestricted" scope for any role, including admin — admin's
// permission bypass (checked via `canViewParasut`/`canViewSync` below) is a
// separate concern from company/tenant isolation (`resolveCompanyScope`).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { resolveCompanyScope, type ErpUserAuthzRow } from "../_shared/company-scope.ts";
import {
  handleDashboard,
  handleDetail,
  handleList,
  handlePaymentsList,
  handleReports,
  handleSyncStatus,
  isListResource,
  clampPage,
  clampPageSize,
  type ListParams,
  type ListResource,
  type SupabaseAdminLike,
} from "./handlers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

interface AccessContext {
  canViewParasut: boolean;
  canViewSync: boolean;
  companyScope: ReturnType<typeof resolveCompanyScope>;
}

/**
 * Resolves both the caller's Paraşüt permissions AND their exact,
 * validated, single active company — one `erp_users` lookup, the only
 * unscoped table read in this whole function.
 *
 * Permission rules (must match src/features/erp/shared/permissions.ts):
 * - `parasut.view`: admin, OR `finance` role, OR the explicit `parasut.view`
 *   permission, OR `system.manage`.
 * - `parasut.sync.view`: admin, OR `system.manage`, OR the explicit
 *   `parasut.sync.view` permission — the `finance` role does NOT grant this.
 *
 * Company scope rules: see resolveCompanyScope in ../_shared/company-scope.ts.
 * Admin gets the exact same membership validation as every other role —
 * permission bypass and tenant isolation are independent checks.
 */
async function resolveAccess(admin: SupabaseAdminLike, authUserId: string, email: string, requestedCompanyId: string | null): Promise<AccessContext | null> {
  const linked = await admin.from("erp_users").select("id, role, roles, permissions, accessible_company_ids").eq("auth_user_id", authUserId).eq("is_active", true).limit(1).maybeSingle();
  const bootstrap = linked.data
    ? { data: null }
    : await admin.from("erp_users").select("id, role, roles, permissions, accessible_company_ids").is("auth_user_id", null).ilike("email", email).eq("is_active", true).limit(1).maybeSingle();
  const erpUser = linked.data ?? bootstrap.data;
  if (!erpUser) return null;

  const record = erpUser as Record<string, unknown>;
  const role = (record.role as string | null) ?? null;
  const roles = (record.roles as string[] | null) ?? [];
  const roleSet = new Set<string>([role, ...roles].filter((value): value is string => Boolean(value)));
  const permissions = new Set<string>((record.permissions as string[] | null) ?? []);
  const isAdmin = roleSet.has("admin");
  const canViewParasut = isAdmin || roleSet.has("finance") || permissions.has("parasut.view") || permissions.has("system.manage");
  const canViewSync = isAdmin || permissions.has("parasut.sync.view") || permissions.has("system.manage");

  const authzRow: ErpUserAuthzRow = {
    role,
    roles,
    accessible_company_ids: (record.accessible_company_ids as string[] | null) ?? [],
  };
  const companyScope = resolveCompanyScope(authzRow, requestedCompanyId ?? undefined);

  return { canViewParasut, canViewSync, companyScope };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, 400);
  }

  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const admin: SupabaseAdminLike = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
  const email = userData.user?.email;
  if (!email || !userData.user) return json({ error: "Yetkili kullanıcı gerekli." }, 401);

  const requestedCompanyId = typeof body.companyId === "string" && body.companyId ? body.companyId : null;
  const access = await resolveAccess(admin, userData.user.id, email, requestedCompanyId);
  if (!access || !access.canViewParasut) return json({ error: "Bu işlem için Paraşüt yetkisi gerekli." }, 403);
  if (!access.companyScope.ok) return json({ error: access.companyScope.reason }, 403);
  const activeCompanyId = access.companyScope.companyId;

  try {
    const action = body.action;
    if (action === "dashboard") return json(await handleDashboard(admin, activeCompanyId));
    if (action === "reports") return json(await handleReports(admin, activeCompanyId));

    if (action === "list") {
      if (!isListResource(body.resource)) return json({ error: "Geçersiz kaynak." }, 400);
      const filters = (body.filters as Record<string, unknown> | undefined) ?? {};
      if (body.resource === "payments" && (filters.kind === "collection" || filters.kind === "payment")) {
        return json(await handlePaymentsList(admin, filters.kind, clampPage(body.page), clampPageSize(body.pageSize), activeCompanyId, body.search as string | undefined));
      }
      return json(
        await handleList(
          admin,
          {
            resource: body.resource,
            page: body.page as number | undefined,
            pageSize: body.pageSize as number | undefined,
            search: body.search as string | undefined,
            sort: body.sort as ListParams["sort"],
            filters: body.filters as Record<string, unknown> | undefined,
          },
          activeCompanyId,
        ),
      );
    }

    if (action === "detail") {
      const resource = body.resource;
      const parasutId = body.parasutId;
      if (typeof parasutId !== "string" || !parasutId) return json({ error: "Kayıt kimliği gerekli." }, 400);
      if (resource !== "sync_runs" && !isListResource(resource)) return json({ error: "Geçersiz kaynak." }, 400);
      if (resource === "sync_runs" && !access.canViewSync) return json({ error: "Bu işlem için senkronizasyon yetkisi gerekli." }, 403);
      const result = await handleDetail(admin, resource as ListResource | "sync_runs", parasutId, activeCompanyId);
      if (!result) return json({ error: "Kayıt bulunamadı." }, 404);
      return json(result);
    }

    if (action === "sync-status") {
      if (!access.canViewSync) return json({ error: "Bu işlem için senkronizasyon yetkisi gerekli." }, 403);
      return json(await handleSyncStatus(admin, { page: body.page as number | undefined, pageSize: body.pageSize as number | undefined }, activeCompanyId));
    }

    return json({ error: "Bilinmeyen işlem." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return json({ error: message }, 500);
  }
});
