import { supabase } from "@/integrations/supabase/client";
import { calculateFinanceDashboardSummary } from "@/lib/finance/calculateBalance";
import type {
  FinanceDashboardSummary,
  FinanceFilters,
  FinancialTransaction,
  PaymentDocument,
  PaymentMethod,
} from "@/lib/finance/financeTypes";
import { type ServiceResult } from "./partiesService";
import { classifySupabaseError, getFriendlySupabaseError } from "./supabaseError";

function fail<T>(scope: string, error: unknown, fallback: T): ServiceResult<T> {
  if (import.meta.env.DEV) console.error(`[Finance] ${scope}:`, error);
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

export type FinancialTransactionPayload = Omit<
  Partial<FinancialTransaction>,
  "id" | "created_at" | "updated_at" | "created_by" | "party"
> & {
  party_id: string;
  party_type: "customer" | "supplier";
  amount: number;
  payment_method?: PaymentMethod | null;
};

export async function getFinancialTransactions(filters: FinanceFilters = {}): Promise<ServiceResult<FinancialTransaction[]>> {
  let query = supabase
    .from("financial_transactions" as never)
    .select("*, party:parties(title, party_type)")
    .order("transaction_date", { ascending: false });

  if (filters.partyId) query = query.eq("party_id", filters.partyId);
  if (filters.accountType && filters.accountType !== "all") query = query.eq("account_type", filters.accountType);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);

  const { data, error } = (await query) as unknown as { data: FinancialTransaction[] | null; error: unknown };
  if (error) return fail("getFinancialTransactions", error, []);
  return ok(data ?? []);
}

export async function getFinancialTransactionsByParty(partyId: string): Promise<ServiceResult<FinancialTransaction[]>> {
  return getFinancialTransactions({ partyId });
}

export async function getFinancialTransactionById(id: string): Promise<ServiceResult<FinancialTransaction | null>> {
  const { data, error } = (await supabase
    .from("financial_transactions" as never)
    .select("*, party:parties(title, party_type)")
    .eq("id", id)
    .maybeSingle()) as unknown as { data: FinancialTransaction | null; error: unknown };

  if (error) return fail("getFinancialTransactionById", error, null);
  return ok(data);
}

export async function createFinancialTransaction(payload: FinancialTransactionPayload): Promise<ServiceResult<FinancialTransaction | null>> {
  const { data: authData } = await supabase.auth.getUser();
  const { data, error } = (await supabase
    .from("financial_transactions" as never)
    .insert({
      party_id: payload.party_id,
      party_type: payload.party_type,
      account_type: payload.account_type || "official",
      transaction_type: payload.transaction_type || "debit",
      direction: payload.direction || "in",
      amount: Number(payload.amount),
      currency: payload.currency || "TRY",
      transaction_date: payload.transaction_date || new Date().toISOString().slice(0, 10),
      due_date: payload.due_date || null,
      payment_method: payload.payment_method || null,
      order_id: payload.order_id || null,
      quotation_id: payload.quotation_id || null,
      reference_no: payload.reference_no || null,
      description: payload.description || null,
      status: payload.status || "completed",
      created_by: authData.user?.id ?? null,
    } as never)
    .select("*, party:parties(title, party_type)")
    .single()) as unknown as { data: FinancialTransaction | null; error: unknown };

  if (error) return fail("createFinancialTransaction", error, null);
  return ok(data);
}

export async function updateFinancialTransaction(id: string, payload: Partial<FinancialTransactionPayload>): Promise<ServiceResult<FinancialTransaction | null>> {
  const { data, error } = (await supabase
    .from("financial_transactions" as never)
    .update({
      ...payload,
      amount: payload.amount !== undefined ? Number(payload.amount) : undefined,
    } as never)
    .eq("id", id)
    .select("*, party:parties(title, party_type)")
    .single()) as unknown as { data: FinancialTransaction | null; error: unknown };

  if (error) return fail("updateFinancialTransaction", error, null);
  return ok(data);
}

export async function getFinanceDashboardSummary(): Promise<ServiceResult<FinanceDashboardSummary>> {
  const transactions = await getFinancialTransactions();
  if (transactions.error) return { data: calculateFinanceDashboardSummary([]), error: transactions.error, missingTable: transactions.missingTable, errorKind: transactions.errorKind };
  return ok(calculateFinanceDashboardSummary(transactions.data));
}

export async function getPaymentDocuments(filters: { partyId?: string; status?: string } = {}): Promise<ServiceResult<PaymentDocument[]>> {
  let query = supabase
    .from("payment_documents" as never)
    .select("*, party:parties(title, party_type)")
    .order("due_date", { ascending: true });

  if (filters.partyId) query = query.eq("party_id", filters.partyId);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);

  const { data, error } = (await query) as unknown as { data: PaymentDocument[] | null; error: unknown };
  if (error) return fail("getPaymentDocuments", error, []);
  return ok(data ?? []);
}

export async function createPaymentDocument(payload: Partial<PaymentDocument> & { party_id: string; amount: number }): Promise<ServiceResult<PaymentDocument | null>> {
  const { data, error } = (await supabase
    .from("payment_documents" as never)
    .insert({
      party_id: payload.party_id,
      transaction_id: payload.transaction_id || null,
      document_type: payload.document_type || "cheque",
      document_no: payload.document_no || null,
      bank_name: payload.bank_name || null,
      branch_name: payload.branch_name || null,
      due_date: payload.due_date || null,
      amount: Number(payload.amount || 0),
      currency: payload.currency || "TRY",
      status: payload.status || "pending",
      notes: payload.notes || null,
    } as never)
    .select("*, party:parties(title, party_type)")
    .single()) as unknown as { data: PaymentDocument | null; error: unknown };

  if (error) return fail("createPaymentDocument", error, null);
  return ok(data);
}
