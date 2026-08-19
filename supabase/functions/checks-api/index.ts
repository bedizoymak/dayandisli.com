import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { resolveCompanyScope, type ErpUserAuthzRow } from "../_shared/company-scope.ts";
import {
  ChecksApiError,
  handleChecksDetail,
  handleChecksList,
  handleCreateCheck,
  handleLinkParty,
  handleSetCheckStatus,
  handleUnlinkParty,
  handleUpdateCheck,
  type CheckListFilters,
  type CheckListParams,
  type ChecksRepository,
  type MirrorCheckRow,
  type MirrorContactRow,
  type PaymentInstrumentEventRow,
  type PaymentInstrumentRow,
} from "./handlers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function env(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function dbError(error: { message?: string } | null, fallback: string): never {
  throw new Error(error?.message || fallback);
}

class SupabaseChecksRepository implements ChecksRepository {
  constructor(
    private readonly caller: SupabaseClient,
    private readonly service: SupabaseClient,
  ) {}

  async listMirrorChecks(companyId: string): Promise<MirrorCheckRow[]> {
    const { data, error } = await this.service
      .schema("parasut")
      .from("checks")
      .select("*")
      .eq("company_id", companyId)
      .or("source_archived.eq.false,source_archived.is.null");
    if (error) dbError(error, "Paraşüt çekleri okunamadı.");
    return (data ?? []) as MirrorCheckRow[];
  }

  async listLocalInstruments(companyId: string): Promise<PaymentInstrumentRow[]> {
    const { data, error } = await this.caller
      .from("payment_instruments")
      .select("*")
      .eq("company_id", companyId);
    if (error) dbError(error, "ERP çekleri okunamadı.");
    return (data ?? []) as PaymentInstrumentRow[];
  }

  async getMirrorCheck(companyId: string, parasutId: string): Promise<MirrorCheckRow | null> {
    const { data, error } = await this.service
      .schema("parasut")
      .from("checks")
      .select("*")
      .eq("company_id", companyId)
      .eq("parasut_id", parasutId)
      .or("source_archived.eq.false,source_archived.is.null")
      .limit(1)
      .maybeSingle();
    if (error) dbError(error, "Paraşüt çeki okunamadı.");
    return data as MirrorCheckRow | null;
  }

  async getLocalInstrument(companyId: string, id: string): Promise<PaymentInstrumentRow | null> {
    const { data, error } = await this.caller
      .from("payment_instruments")
      .select("*")
      .eq("company_id", companyId)
      .eq("id", id)
      .limit(1)
      .maybeSingle();
    if (error) dbError(error, "ERP çeki okunamadı.");
    return data as PaymentInstrumentRow | null;
  }

  async getMirrorOverlay(companyId: string, parasutId: string): Promise<PaymentInstrumentRow | null> {
    const { data, error } = await this.caller
      .from("payment_instruments")
      .select("*")
      .eq("company_id", companyId)
      .eq("source", "parasut_mirror")
      .eq("external_parasut_id", parasutId)
      .limit(1)
      .maybeSingle();
    if (error) dbError(error, "Çek ilişki bilgisi okunamadı.");
    return data as PaymentInstrumentRow | null;
  }

  async listMirrorContacts(companyId: string, parasutIds: string[]): Promise<MirrorContactRow[]> {
    const rows: MirrorContactRow[] = [];
    for (let offset = 0; offset < parasutIds.length; offset += 100) {
      const ids = parasutIds.slice(offset, offset + 100);
      const { data, error } = await this.service
        .schema("parasut")
        .from("contacts")
        .select("parasut_id, company_id, attributes, source_archived")
        .eq("company_id", companyId)
        .in("parasut_id", ids)
        .or("source_archived.eq.false,source_archived.is.null");
      if (error) dbError(error, "Paraşüt çek tarafları okunamadı.");
      rows.push(...((data ?? []) as MirrorContactRow[]));
    }
    return rows;
  }

  async getMirrorContact(companyId: string, parasutId: string): Promise<MirrorContactRow | null> {
    const { data, error } = await this.service
      .schema("parasut")
      .from("contacts")
      .select("parasut_id, company_id, attributes, source_archived")
      .eq("company_id", companyId)
      .eq("parasut_id", parasutId)
      .or("source_archived.eq.false,source_archived.is.null")
      .limit(1)
      .maybeSingle();
    if (error) dbError(error, "Paraşüt tarafı doğrulanamadı.");
    return data as MirrorContactRow | null;
  }

  async getLatestSuccessfulChecksSyncAt(companyId: string): Promise<string | null> {
    const { data, error } = await this.service
      .schema("parasut")
      .from("sync_runs")
      .select("completed_at")
      .eq("company_id", companyId)
      .eq("resource_type", "checks")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) dbError(error, "Çek senkronizasyon zamanı okunamadı.");
    const completedAt = data && typeof data.completed_at === "string" ? data.completed_at : null;
    return completedAt;
  }

  async listEvents(companyId: string, instrumentId: string): Promise<PaymentInstrumentEventRow[]> {
    const { data, error } = await this.caller
      .from("payment_instrument_events")
      .select("*")
      .eq("company_id", companyId)
      .eq("payment_instrument_id", instrumentId)
      .order("occurred_at", { ascending: false });
    if (error) dbError(error, "Çek geçmişi okunamadı.");
    return (data ?? []) as PaymentInstrumentEventRow[];
  }

  async insertInstrument(values: Record<string, unknown>): Promise<PaymentInstrumentRow> {
    const { data, error } = await this.caller
      .from("payment_instruments")
      .insert(values)
      .select("*")
      .single();
    if (error || !data) dbError(error, "Çek kaydedilemedi.");
    return data as PaymentInstrumentRow;
  }

  async updateInstrument(companyId: string, id: string, values: Record<string, unknown>): Promise<PaymentInstrumentRow> {
    const { data, error } = await this.caller
      .from("payment_instruments")
      .update(values)
      .eq("company_id", companyId)
      .eq("id", id)
      .select("*")
      .single();
    if (error || !data) dbError(error, "Çek güncellenemedi.");
    return data as PaymentInstrumentRow;
  }

  async transitionInstrument(
    id: string,
    targetStatus: "paid" | "cancelled" | "returned",
    note: string | null,
  ): Promise<PaymentInstrumentRow> {
    const { data, error } = await this.caller.rpc("transition_payment_instrument", {
      p_instrument_id: id,
      p_target_status: targetStatus,
      p_note: note,
    });
    if (error || !data) dbError(error, "Çek durumu değiştirilemedi.");
    return data as PaymentInstrumentRow;
  }
}

interface AccessContext {
  companyScope: ReturnType<typeof resolveCompanyScope>;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
}

async function resolveAccess(
  admin: SupabaseClient,
  authUserId: string,
  email: string,
  requestedCompanyId: string | null,
): Promise<AccessContext | null> {
  const linked = await admin
    .from("erp_users")
    .select("id, role, roles, permissions, accessible_company_ids")
    .eq("auth_user_id", authUserId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  const bootstrap = linked.data
    ? { data: null }
    : await admin
        .from("erp_users")
        .select("id, role, roles, permissions, accessible_company_ids")
        .is("auth_user_id", null)
        .eq("email", email.trim().toLowerCase())
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
  const erpUser = linked.data ?? bootstrap.data;
  if (!erpUser) return null;

  const record = erpUser as Record<string, unknown>;
  const role = typeof record.role === "string" ? record.role : null;
  const roles = Array.isArray(record.roles) ? record.roles.filter((value): value is string => typeof value === "string") : [];
  const permissions = new Set(
    Array.isArray(record.permissions)
      ? record.permissions.filter((value): value is string => typeof value === "string")
      : [],
  );
  const roleSet = new Set([role, ...roles].filter((value): value is string => Boolean(value)));
  const broadFinanceRole = roleSet.has("finance") || roleSet.has("planner");
  const isAdmin = roleSet.has("admin");
  const systemManage = permissions.has("system.manage");
  const authzRow: ErpUserAuthzRow = {
    role,
    roles,
    accessible_company_ids: Array.isArray(record.accessible_company_ids)
      ? record.accessible_company_ids.filter((value): value is string => typeof value === "string")
      : [],
  };

  return {
    companyScope: resolveCompanyScope(authzRow, requestedCompanyId ?? undefined),
    canView: isAdmin || broadFinanceRole || systemManage || permissions.has("finance.view"),
    canCreate: isAdmin || broadFinanceRole || systemManage || permissions.has("finance.create"),
    canEdit: isAdmin || broadFinanceRole || systemManage || permissions.has("finance.edit"),
  };
}

function listParams(body: Record<string, unknown>): CheckListParams {
  return {
    page: body.page,
    pageSize: body.pageSize,
    search: body.search,
    filters: (body.filters && typeof body.filters === "object" ? body.filters : {}) as CheckListFilters,
    sort: (body.sort && typeof body.sort === "object" ? body.sort : undefined) as CheckListParams["sort"],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "Geçersiz istek gövdesi." }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, 400);
  }

  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  const caller = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const service = createClient(supabaseUrl, serviceRoleKey);
  const token = authHeader.replace("Bearer ", "");
  const { data: userData, error: userError } = await caller.auth.getUser(token);
  const user = userData.user;
  if (userError || !user?.id || !user.email) return json({ error: "Yetkili kullanıcı gerekli." }, 401);

  const requestedCompanyId = typeof body.companyId === "string" && body.companyId ? body.companyId : null;
  const access = await resolveAccess(service, user.id, user.email, requestedCompanyId);
  if (!access) return json({ error: "Yetkili ERP kullanıcısı bulunamadı." }, 403);
  if (!access.companyScope.ok) return json({ error: access.companyScope.reason }, 403);
  const companyId = access.companyScope.companyId;
  const repository = new SupabaseChecksRepository(caller, service);

  try {
    const action = body.action;
    if (action === "list") {
      if (!access.canView) return json({ error: "Bu işlem için finans görüntüleme yetkisi gerekli." }, 403);
      return json(await handleChecksList(repository, companyId, listParams(body)));
    }
    if (action === "detail") {
      if (!access.canView) return json({ error: "Bu işlem için finans görüntüleme yetkisi gerekli." }, 403);
      return json(await handleChecksDetail(repository, companyId, body.id));
    }
    if (action === "create") {
      if (!access.canCreate) return json({ error: "Bu işlem için finans oluşturma yetkisi gerekli." }, 403);
      return json(await handleCreateCheck(repository, companyId, body.input), 201);
    }
    if (action === "update") {
      if (!access.canEdit) return json({ error: "Bu işlem için finans düzenleme yetkisi gerekli." }, 403);
      return json(await handleUpdateCheck(repository, companyId, body.id, body.input));
    }
    if (action === "set-status") {
      if (!access.canEdit) return json({ error: "Bu işlem için finans düzenleme yetkisi gerekli." }, 403);
      return json(await handleSetCheckStatus(repository, companyId, body.id, body.status, body.note));
    }
    if (action === "link-party") {
      if (!access.canEdit) return json({ error: "Bu işlem için finans düzenleme yetkisi gerekli." }, 403);
      return json(await handleLinkParty(repository, companyId, body.id, body.contactParasutId));
    }
    if (action === "unlink-party") {
      if (!access.canEdit) return json({ error: "Bu işlem için finans düzenleme yetkisi gerekli." }, 403);
      return json(await handleUnlinkParty(repository, companyId, body.id));
    }
    return json({ error: "Bilinmeyen işlem." }, 400);
  } catch (error) {
    if (error instanceof ChecksApiError) return json({ error: error.message }, error.httpStatus);
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return json({ error: message }, 500);
  }
});
