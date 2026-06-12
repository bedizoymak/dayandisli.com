import { supabase } from "@/integrations/supabase/client";
import type {
  ApiResult,
  CRMActivity,
  CRMActivityType,
  CRMLead,
  CRMLeadStatus,
  CRMOpportunity,
  CRMOpportunityStatus,
  CRMRelatedType,
  CRMTask,
  CRMTaskStatus,
  Stakeholder,
  StakeholderType,
} from "../types";
import {
  applyEnterpriseScope,
  createAuditLog,
  DbResult,
  EnterpriseQueryScope,
  failure,
  getNextERPNumber,
  normalizeSearch,
  resolveEnterpriseScope,
  success,
  withEnterpriseOwnership,
} from "./internal";

export async function listStakeholders(search = "", type?: StakeholderType | "all", scope?: EnterpriseQueryScope): Promise<ApiResult<Stakeholder[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  let query = applyEnterpriseScope(supabase
    .from("stakeholders" as never)
    .select("*")
    .order("company_name", { ascending: true }), enterpriseScope);

  const q = normalizeSearch(search);
  if (q) query = query.or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%`);
  if (type && type !== "all") query = query.eq("type", type);

  const { data, error } = (await query) as unknown as DbResult<Stakeholder[]>;
  if (error) return failure("listStakeholders", error, []);
  return success(data ?? []);
}

export async function createStakeholder(payload: Partial<Stakeholder> & { type: StakeholderType; company_name: string }) {
  const record = await withEnterpriseOwnership({
    type: payload.type,
    company_name: payload.company_name,
    contact_name: payload.contact_name ?? null,
    phone: payload.phone ?? null,
    email: payload.email ?? null,
    tax_office: payload.tax_office ?? null,
    tax_number: payload.tax_number ?? null,
    address: payload.address ?? null,
    city: payload.city ?? null,
    country: payload.country ?? "Türkiye",
    risk_limit: payload.risk_limit ?? 0,
    current_balance: payload.current_balance ?? 0,
    notes: payload.notes ?? null,
    is_active: payload.is_active ?? true,
    company_id: payload.company_id ?? null,
    branch_id: payload.branch_id ?? null,
  });
  const { data, error } = (await supabase.from("stakeholders" as never).insert(record as never).select("*").single()) as unknown as DbResult<Stakeholder>;
  if (error) return failure("createStakeholder", error, null);
  return success(data);
}

export async function updateStakeholder(id: string, payload: Partial<Stakeholder>) {
  const { data, error } = (await supabase.from("stakeholders" as never).update(payload as never).eq("id", id).select("*").single()) as unknown as DbResult<Stakeholder>;
  if (error) return failure("updateStakeholder", error, null);
  return success(data);
}

export async function getStakeholderById(id: string) {
  const { data, error } = (await supabase.from("stakeholders" as never).select("*").eq("id", id).single()) as unknown as DbResult<Stakeholder>;
  if (error) return failure("getStakeholderById", error, null);
  return success(data);
}

export async function listCRMLeads(search = "", status: CRMLeadStatus | "all" = "all", scope?: EnterpriseQueryScope): Promise<ApiResult<CRMLead[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  let query = applyEnterpriseScope(supabase.from("crm_leads" as never).select("*").order("created_at", { ascending: false }), enterpriseScope);
  if (status !== "all") query = query.eq("status" as never, status as never);
  const q = normalizeSearch(search);
  if (q) query = query.or(`company_name.ilike.%${q}%,contact_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,lead_no.ilike.%${q}%` as never);
  const { data, error } = (await query) as unknown as DbResult<CRMLead[]>;
  if (error) return failure("listCRMLeads", error, []);
  return success(data ?? []);
}

export async function createCRMLead(payload: Partial<CRMLead> & { company_name: string }) {
  const leadNo = await getNextERPNumber("CRM_LEAD");
  const record = await withEnterpriseOwnership({ ...payload, lead_no: leadNo.data });
  const { data, error } = (await supabase.from("crm_leads" as never).insert(record as never).select("*").single()) as unknown as DbResult<CRMLead>;
  if (error) return failure<CRMLead | null>("createCRMLead", error, null);
  await createAuditLog({ entity_type: "lead", entity_id: data?.id, action: "created", description: `${data?.lead_no} potansiyel müşteri oluşturuldu.` });
  return success(data);
}

export async function updateCRMLead(id: string, payload: Partial<CRMLead>) {
  const previous = (await supabase.from("crm_leads" as never).select("status").eq("id", id).maybeSingle()) as unknown as DbResult<{ status: CRMLeadStatus }>;
  const { data, error } = (await supabase.from("crm_leads" as never).update(payload as never).eq("id" as never, id as never).select("*").single()) as unknown as DbResult<CRMLead>;
  if (error) return failure<CRMLead | null>("updateCRMLead", error, null);
  if (payload.status && previous.data?.status !== payload.status) {
    await createAuditLog({ entity_type: "lead", entity_id: id, action: "status_changed", old_status: previous.data?.status, new_status: payload.status, description: "Potansiyel müşteri durumu güncellendi." });
  }
  return success(data);
}

export async function listCRMOpportunities(search = "", status: CRMOpportunityStatus | "all" = "all", scope?: EnterpriseQueryScope): Promise<ApiResult<CRMOpportunity[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  let query = applyEnterpriseScope(supabase.from("crm_opportunities" as never).select("*").order("created_at", { ascending: false }), enterpriseScope);
  if (status !== "all") query = query.eq("status" as never, status as never);
  const q = normalizeSearch(search);
  if (q) query = query.or(`title.ilike.%${q}%,opportunity_no.ilike.%${q}%` as never);
  const { data, error } = (await query) as unknown as DbResult<CRMOpportunity[]>;
  if (error) return failure("listCRMOpportunities", error, []);
  return success(data ?? []);
}

export async function createCRMOpportunity(payload: Partial<CRMOpportunity> & { title: string }) {
  const opportunityNo = await getNextERPNumber("CRM_OPPORTUNITY");
  const record = await withEnterpriseOwnership({ ...payload, opportunity_no: opportunityNo.data });
  const { data, error } = (await supabase.from("crm_opportunities" as never).insert(record as never).select("*").single()) as unknown as DbResult<CRMOpportunity>;
  if (error) return failure<CRMOpportunity | null>("createCRMOpportunity", error, null);
  await createAuditLog({ entity_type: "opportunity", entity_id: data?.id, action: "created", description: `${data?.opportunity_no} fırsat oluşturuldu.` });
  return success(data);
}

export async function updateCRMOpportunity(id: string, payload: Partial<CRMOpportunity>) {
  const previous = (await supabase.from("crm_opportunities" as never).select("status").eq("id", id).maybeSingle()) as unknown as DbResult<{ status: CRMOpportunityStatus }>;
  const { data, error } = (await supabase.from("crm_opportunities" as never).update(payload as never).eq("id" as never, id as never).select("*").single()) as unknown as DbResult<CRMOpportunity>;
  if (error) return failure<CRMOpportunity | null>("updateCRMOpportunity", error, null);
  if (payload.status && previous.data?.status !== payload.status) {
    await createAuditLog({ entity_type: "opportunity", entity_id: id, action: "status_changed", old_status: previous.data?.status, new_status: payload.status, description: "Fırsat durumu güncellendi." });
  }
  return success(data);
}

export async function convertLeadToOpportunity(lead: CRMLead) {
  const opportunity = await createCRMOpportunity({
    title: `${lead.company_name} fırsatı`,
    lead_id: lead.id,
    stakeholder_id: lead.stakeholder_id,
    notes: lead.notes,
  });
  if (opportunity.data) await updateCRMLead(lead.id, { status: "converted" });
  return opportunity;
}

export async function listCRMTasks(search = "", status: CRMTaskStatus | "all" = "all", scope?: EnterpriseQueryScope): Promise<ApiResult<CRMTask[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  let query = applyEnterpriseScope(supabase.from("crm_tasks" as never).select("*").order("created_at", { ascending: false }), enterpriseScope);
  if (status !== "all") query = query.eq("status" as never, status as never);
  const q = normalizeSearch(search);
  if (q) query = query.ilike("title" as never, `%${q}%` as never);
  const { data, error } = (await query) as unknown as DbResult<CRMTask[]>;
  if (error) return failure("listCRMTasks", error, []);
  return success(data ?? []);
}

export async function createCRMTask(payload: Partial<CRMTask> & { title: string }) {
  const record = await withEnterpriseOwnership(payload);
  const { data, error } = (await supabase.from("crm_tasks" as never).insert(record as never).select("*").single()) as unknown as DbResult<CRMTask>;
  if (error) return failure<CRMTask | null>("createCRMTask", error, null);
  return success(data);
}

export async function updateCRMTask(id: string, payload: Partial<CRMTask>) {
  const { data, error } = (await supabase.from("crm_tasks" as never).update(payload as never).eq("id" as never, id as never).select("*").single()) as unknown as DbResult<CRMTask>;
  if (error) return failure<CRMTask | null>("updateCRMTask", error, null);
  return success(data);
}

export async function listCRMActivities(search = "", relatedType?: CRMRelatedType, relatedId?: string): Promise<ApiResult<CRMActivity[]>> {
  let query = supabase.from("crm_activities" as never).select("*").order("activity_date", { ascending: false }).limit(200);
  if (relatedType) query = query.eq("related_type" as never, relatedType as never);
  if (relatedId) query = query.eq("related_id" as never, relatedId as never);
  const q = normalizeSearch(search);
  if (q) query = query.or(`subject.ilike.%${q}%,notes.ilike.%${q}%` as never);
  const { data, error } = (await query) as unknown as DbResult<CRMActivity[]>;
  if (error) return failure("listCRMActivities", error, []);
  return success(data ?? []);
}

export async function createCRMActivity(payload: Partial<CRMActivity> & { subject: string; activity_type?: CRMActivityType }) {
  const { data, error } = (await supabase.from("crm_activities" as never).insert({ activity_type: "note", ...payload } as never).select("*").single()) as unknown as DbResult<CRMActivity>;
  if (error) return failure<CRMActivity | null>("createCRMActivity", error, null);
  return success(data);
}
