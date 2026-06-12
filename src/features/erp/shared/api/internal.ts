import { supabase } from "@/integrations/supabase/client";
import { demoFallbackForScope } from "../demoFallback";
import type { ApiResult, ERPAuditLog, ERPUser } from "../types";

export type DbResult<T> = { data: T | null; error: unknown; count?: number | null };

export type EnterpriseQueryScope = {
  companyId?: string | null;
  branchId?: string | null;
  consolidated?: boolean;
};

export function toErrorMessage(error: unknown) {
  if (!error) return "Bilinmeyen hata";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message: unknown }).message);
  }

  try {
    return JSON.stringify(error);
  } catch {
    return "Bilinmeyen hata";
  }
}

export function isMissingTableError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string; details?: string };
  const message = `${err.message ?? ""} ${err.details ?? ""}`.toLowerCase();

  return (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    message.includes("does not exist") ||
    message.includes("could not find the table") ||
    message.includes("schema cache")
  );
}

export function logError(scope: string, error: unknown) {
  console.error(`[ERP API] ${scope}:`, error);
}

export function failure<T>(scope: string, error: unknown, fallback: T): ApiResult<T> {
  logError(scope, error);
  const missingTable = isMissingTableError(error);
  if (missingTable) {
    return {
      data: demoFallbackForScope(scope, fallback),
      error: null,
      missingTable: true,
      demoFallback: true,
    };
  }

  return {
    data: fallback,
    error: toErrorMessage(error),
    missingTable,
  };
}

export function success<T>(data: T): ApiResult<T> {
  return { data, error: null };
}

export function normalizeSearch(value: string) {
  return value.trim().replaceAll(",", " ");
}

function sequencePrefix(sequenceKey: string) {
  const prefixes: Record<string, string> = {
    SALES_ORDER: "SO",
    WORK_ORDER: "WO",
    SHIPMENT: "SHP",
    QUALITY_REPORT: "QC",
    SUBCONTRACTING: "FSN",
    PURCHASE_ORDER: "PO",
  };

  return prefixes[sequenceKey] ?? "ERP";
}

export async function getNextERPNumber(sequenceKey: string): Promise<ApiResult<string>> {
  const prefix = sequencePrefix(sequenceKey);

  try {
    const { data, error } = (await supabase.rpc("next_erp_number" as never, {
      p_sequence_key: sequenceKey,
    } as never)) as unknown as DbResult<string>;

    if (error || !data) {
      const fallbackNo = `${prefix}-TEMP-${Date.now()}`;
      return { data: fallbackNo, error: error ? toErrorMessage(error) : null, missingTable: isMissingTableError(error) };
    }

    return success(data);
  } catch (error) {
    logError("getNextERPNumber", error);
    return { data: `${prefix}-TEMP-${Date.now()}`, error: toErrorMessage(error), missingTable: isMissingTableError(error) };
  }
}

export async function createAuditLog(payload: {
  company_id?: string | null;
  branch_id?: string | null;
  entity_type: string;
  entity_id?: string | null;
  action: string;
  old_status?: string | null;
  new_status?: string | null;
  description?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const { data: authData } = await supabase.auth.getUser();
  const { data, error } = (await supabase
    .from("erp_audit_logs" as never)
    .insert({
      actor_user_id: authData.user?.id ?? null,
      actor_email: authData.user?.email ?? null,
      company_id: payload.company_id ?? null,
      branch_id: payload.branch_id ?? null,
      entity_type: payload.entity_type,
      entity_id: payload.entity_id ?? null,
      action: payload.action,
      old_status: payload.old_status ?? null,
      new_status: payload.new_status ?? null,
      description: payload.description ?? null,
      metadata: payload.metadata ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<ERPAuditLog>;

  if (error) return failure("createAuditLog", error, null);
  return success(data);
}

async function getDefaultEnterpriseScope(): Promise<EnterpriseQueryScope> {
  const { data: authData } = await supabase.auth.getUser();
  const email = authData.user?.email;
  if (!email) return { consolidated: true };

  const { data, error } = (await supabase
    .from("erp_users" as never)
    .select("default_company_id, default_branch_id, role")
    .eq("email", email)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle()) as unknown as DbResult<Pick<ERPUser, "default_company_id" | "default_branch_id" | "role">>;

  if (error || !data) return { consolidated: true };
  if (data.role === "admin" && !data.default_company_id) return { consolidated: true };
  return {
    companyId: data.default_company_id ?? null,
    branchId: data.default_branch_id ?? null,
    consolidated: !data.default_company_id,
  };
}

export async function resolveEnterpriseScope(scope?: EnterpriseQueryScope): Promise<EnterpriseQueryScope> {
  if (scope?.consolidated) return scope;
  if (scope?.companyId || scope?.branchId) return scope;
  return getDefaultEnterpriseScope();
}

export function applyEnterpriseScope<T>(query: T, scope: EnterpriseQueryScope): T {
  if (scope.consolidated) return query;
  let scopedQuery = query as { eq: (column: string, value: string) => unknown };
  if (scope.companyId) scopedQuery = scopedQuery.eq("company_id", scope.companyId) as typeof scopedQuery;
  if (scope.branchId) scopedQuery = scopedQuery.eq("branch_id", scope.branchId) as typeof scopedQuery;
  return scopedQuery as T;
}

export async function withEnterpriseOwnership<T extends { company_id?: string | null; branch_id?: string | null }>(
  payload: T,
  scope?: EnterpriseQueryScope,
): Promise<T> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  return {
    ...payload,
    company_id: payload.company_id ?? enterpriseScope.companyId ?? null,
    branch_id: payload.branch_id ?? enterpriseScope.branchId ?? null,
  };
}
