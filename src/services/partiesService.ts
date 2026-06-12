import { supabase } from "@/integrations/supabase/client";
import { calculatePartyFinancialSummary } from "@/lib/finance/calculateBalance";
import type {
  FinancialTransaction,
  Party,
  PartyFilters,
  PartyFinancialSummary,
  PartyNote,
  PartyType,
} from "@/lib/finance/financeTypes";
import { classifySupabaseError, getFriendlySupabaseError, type SupabaseErrorKind } from "./supabaseError";

export type ServiceResult<T> = {
  data: T;
  error: string | null;
  missingTable?: boolean;
  errorKind?: SupabaseErrorKind;
};

function fail<T>(scope: string, error: unknown, fallback: T): ServiceResult<T> {
  if (import.meta.env.DEV) console.error(`[Parties] ${scope}:`, error);
  const errorKind = classifySupabaseError(error);
  if (errorKind === "missing_table") {
    return {
      data: fallback,
      error: null,
      missingTable: true,
      errorKind,
    };
  }

  return {
    data: fallback,
    error: getFriendlySupabaseError(error),
    missingTable: false,
    errorKind,
  };
}

function ok<T>(data: T): ServiceResult<T> {
  return { data, error: null };
}

export function isMissingTableError(error: unknown) {
  return classifySupabaseError(error) === "missing_table";
}

function sourceLabel(source?: string | null): Party["source_label"] {
  if (source === "customer_full") return "customer_full";
  if (source === "customers_full") return "customers_full";
  return "ERP";
}

function normalizeParty(row: Party): Party {
  return {
    ...row,
    source_label: sourceLabel(row.external_source),
    is_legacy_readonly: false,
  };
}

function sanitizeSearch(value: string) {
  return value.trim().replaceAll(",", " ");
}

export type PartyPayload = Omit<Partial<Party>, "id" | "created_at" | "updated_at" | "created_by"> & {
  party_type: PartyType;
  title: string;
};

export async function checkPartiesTable(): Promise<ServiceResult<boolean>> {
  const { error } = (await supabase.from("parties" as never).select("id").limit(1)) as unknown as {
    error: unknown;
  };

  if (error) return fail("checkPartiesTable", error, false);
  return ok(true);
}

export async function getParties(filters: PartyFilters = {}): Promise<ServiceResult<Party[]>> {
  let query = supabase.from("parties" as never).select("*").order("title", { ascending: true });

  if (filters.type && filters.type !== "all") {
    query =
      filters.type === "customer"
        ? query.in("party_type", ["customer", "both"] as never)
        : filters.type === "supplier"
          ? query.in("party_type", ["supplier", "both"] as never)
          : query.eq("party_type", filters.type);
  }

  if (filters.active === "active") query = query.eq("is_active", true);
  if (filters.active === "passive") query = query.eq("is_active", false);
  if (filters.accountType && filters.accountType !== "all") query = query.eq("default_account_type", filters.accountType);

  const q = filters.search ? sanitizeSearch(filters.search) : "";
  if (q) {
    query = query.or(`title.ilike.%${q}%,contact_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,tax_or_identity_no.ilike.%${q}%`);
  }

  const { data, error } = (await query) as unknown as { data: Party[] | null; error: unknown };
  if (error) return fail("getParties", error, []);

  return ok((data ?? []).map(normalizeParty));
}

export async function searchParties(query: string, partyType?: PartyType): Promise<ServiceResult<Party[]>> {
  return getParties({ type: partyType || "all", search: query });
}

export async function getPartyById(id: string): Promise<ServiceResult<Party | null>> {
  const { data, error } = (await supabase
    .from("parties" as never)
    .select("*")
    .eq("id", id)
    .maybeSingle()) as unknown as { data: Party | null; error: unknown };

  if (error) return fail("getPartyById", error, null);
  return ok(data ? normalizeParty(data) : null);
}

export async function createParty(payload: PartyPayload): Promise<ServiceResult<Party | null>> {
  const { data: authData } = await supabase.auth.getUser();
  const insertPayload = {
    party_type: payload.party_type,
    entity_type: payload.entity_type || "company",
    title: payload.title.trim(),
    contact_name: payload.contact_name || null,
    tax_or_identity_no: payload.tax_or_identity_no || null,
    tax_office: payload.tax_office || null,
    phone: payload.phone || null,
    email: payload.email || null,
    website: payload.website || null,
    address: payload.address || null,
    city: payload.city || null,
    district: payload.district || null,
    default_account_type: payload.default_account_type || "official",
    currency: payload.currency || "TRY",
    payment_term_days: Number(payload.payment_term_days || 0),
    risk_limit: Number(payload.risk_limit || 0),
    category: payload.category || null,
    tags: payload.tags || [],
    notes: payload.notes || null,
    is_active: payload.is_active ?? true,
    created_by: authData.user?.id ?? null,
    ...(payload.external_source !== undefined ? { external_source: payload.external_source } : {}),
    ...(payload.external_id !== undefined ? { external_id: payload.external_id } : {}),
  };

  const { data, error } = (await supabase
    .from("parties" as never)
    .insert(insertPayload as never)
    .select("*")
    .single()) as unknown as { data: Party | null; error: unknown };

  if (error) return fail("createParty", error, null);
  return ok(data ? normalizeParty(data) : null);
}

export async function updateParty(id: string, payload: Partial<PartyPayload>): Promise<ServiceResult<Party | null>> {
  const updatePayload = {
    ...payload,
    title: payload.title?.trim(),
    payment_term_days: payload.payment_term_days !== undefined ? Number(payload.payment_term_days) : undefined,
    risk_limit: payload.risk_limit !== undefined ? Number(payload.risk_limit) : undefined,
  };

  const { data, error } = (await supabase
    .from("parties" as never)
    .update(updatePayload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as { data: Party | null; error: unknown };

  if (error) return fail("updateParty", error, null);
  return ok(data ? normalizeParty(data) : null);
}

export async function getPartyTransactions(partyId: string): Promise<ServiceResult<FinancialTransaction[]>> {
  const { data, error } = (await supabase
    .from("financial_transactions" as never)
    .select("*, party:parties(title, party_type)")
    .eq("party_id", partyId)
    .order("transaction_date", { ascending: false })) as unknown as { data: FinancialTransaction[] | null; error: unknown };

  if (error) return fail("getPartyTransactions", error, []);
  return ok(data ?? []);
}

export async function getPartyFinancialSummary(partyId: string): Promise<ServiceResult<PartyFinancialSummary>> {
  const transactions = await getPartyTransactions(partyId);
  if (transactions.error) return { data: calculatePartyFinancialSummary([]), error: transactions.error, missingTable: transactions.missingTable, errorKind: transactions.errorKind };
  return ok(calculatePartyFinancialSummary(transactions.data));
}

export async function getPartyNotes(partyId: string): Promise<ServiceResult<PartyNote[]>> {
  const { data, error } = (await supabase
    .from("party_notes" as never)
    .select("*")
    .eq("party_id", partyId)
    .order("created_at", { ascending: false })) as unknown as { data: PartyNote[] | null; error: unknown };

  if (error) return fail("getPartyNotes", error, []);
  return ok(data ?? []);
}
