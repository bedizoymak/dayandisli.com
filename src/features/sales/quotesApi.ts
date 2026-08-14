import { supabase } from "@/integrations/supabase/client";
import type {
  QuoteCustomerSource,
  QuoteHistoryEntryRow,
  QuoteIssuerKey,
  QuoteLineDraft,
  QuoteLineRow,
  QuoteLocalCustomerRow,
  QuoteRow,
  QuoteStatus,
} from "./quoteTypes";
import { calculateLineTotal, calculateQuoteTotals } from "./quoteCalculations";

type DbResult<T> = { data: T | null; error: { message: string } | null };

export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string };

function ok<T>(data: T): ApiResult<T> {
  return { ok: true, data };
}
function fail<T>(message: string): ApiResult<T> {
  return { ok: false, message };
}

// Concurrency-safe, DB-generated (public.next_quote_number, see the
// 20260814120000 migration): a single atomic UPSERT per issuer+month, so two
// simultaneous quote creations can never receive the same number.
export async function generateQuoteNumber(issuer: QuoteIssuerKey): Promise<ApiResult<string>> {
  const { data, error } = (await supabase.rpc("next_quote_number" as never, {
    p_issuer: issuer,
  } as never)) as unknown as DbResult<string>;
  if (error || !data) return fail(error?.message ?? "Teklif numarası üretilemedi.");
  return ok(data);
}

export async function fetchQuotes(): Promise<ApiResult<QuoteRow[]>> {
  const { data, error } = (await supabase
    .from("quotes" as never)
    .select("*")
    .order("created_at", { ascending: false })) as unknown as DbResult<QuoteRow[]>;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function fetchQuoteWithLines(
  quoteId: string,
): Promise<ApiResult<{ quote: QuoteRow; lines: QuoteLineRow[] }>> {
  const [quoteResult, linesResult] = await Promise.all([
    supabase.from("quotes" as never).select("*").eq("id", quoteId).maybeSingle() as unknown as Promise<
      DbResult<QuoteRow>
    >,
    supabase
      .from("quote_lines" as never)
      .select("*")
      .eq("quote_id", quoteId)
      .order("position", { ascending: true }) as unknown as Promise<DbResult<QuoteLineRow[]>>,
  ]);
  if (quoteResult.error) return fail(quoteResult.error.message);
  if (!quoteResult.data) return fail("Teklif bulunamadı.");
  if (linesResult.error) return fail(linesResult.error.message);
  return ok({ quote: quoteResult.data, lines: linesResult.data ?? [] });
}

export type QuoteCustomerSnapshot = {
  source: QuoteCustomerSource;
  parasutCustomerId: string | null;
  localCustomerId: string | null;
  name: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  taxNo: string;
};

export type SaveQuoteInput = {
  id?: string;
  quoteNo: string;
  issuer: QuoteIssuerKey;
  status: QuoteStatus;
  currency: string;
  subject: string;
  customer: QuoteCustomerSnapshot;
  issueDate: string;
  validUntil: string | null;
  paymentTerms: string;
  deliveryTerms: string;
  deliveryTime: string;
  notes: string;
  lines: QuoteLineDraft[];
};

/**
 * Insert (or update, when `input.id` is set) the quote header, then fully
 * replace its lines. Two statements, not a single DB transaction (the
 * Supabase client here has no multi-statement transaction primitive) — an
 * interrupted save can leave a header with stale lines, but never a
 * dangling lines-without-header row (lines are deleted/inserted only after
 * the header write succeeds), and the header write is itself always safe to
 * retry (same id = update, not a duplicate insert).
 */
export async function saveQuote(input: SaveQuoteInput): Promise<ApiResult<QuoteRow>> {
  const totals = calculateQuoteTotals(input.lines);
  const header = {
    quote_no: input.quoteNo,
    issuer: input.issuer,
    status: input.status,
    currency: input.currency,
    subject: input.subject,
    customer_source: input.customer.source,
    parasut_customer_id: input.customer.source === "parasut" ? input.customer.parasutCustomerId : null,
    local_customer_id: input.customer.source === "local" ? input.customer.localCustomerId : null,
    customer_name: input.customer.name,
    customer_contact: input.customer.contact,
    customer_phone: input.customer.phone,
    customer_email: input.customer.email,
    customer_address: input.customer.address,
    customer_tax_no: input.customer.taxNo,
    issue_date: input.issueDate,
    valid_until: input.validUntil,
    payment_terms: input.paymentTerms,
    delivery_terms: input.deliveryTerms,
    delivery_time: input.deliveryTime,
    notes: input.notes,
    subtotal: totals.subtotal,
    discount_total: totals.discountTotal,
    vat_total: totals.vatTotal,
    grand_total: totals.grandTotal,
  };

  const headerResult = (input.id
    ? await supabase.from("quotes" as never).update(header as never).eq("id", input.id).select("*").single()
    : await supabase.from("quotes" as never).insert(header as never).select("*").single()) as unknown as DbResult<QuoteRow>;

  if (headerResult.error || !headerResult.data) {
    return fail(headerResult.error?.message ?? "Teklif kaydedilemedi.");
  }
  const quote = headerResult.data;

  const deleteResult = await supabase.from("quote_lines" as never).delete().eq("quote_id", quote.id);
  if (deleteResult.error) return fail(deleteResult.error.message);

  if (input.lines.length) {
    const lineRows = input.lines.map((line, index) => ({
      quote_id: quote.id,
      position: index,
      description: line.description,
      detail: line.detail || null,
      quantity: line.quantity,
      unit: line.unit,
      unit_price: line.unitPrice,
      discount_pct: line.discountPct,
      vat_pct: line.vatPct,
      line_total: calculateLineTotal(line),
    }));
    const insertResult = await supabase.from("quote_lines" as never).insert(lineRows as never);
    if (insertResult.error) return fail(insertResult.error.message);
  }

  return ok(quote);
}

export async function updateQuoteStatus(quoteId: string, status: QuoteStatus): Promise<ApiResult<null>> {
  const { error } = await supabase.from("quotes" as never).update({ status } as never).eq("id", quoteId);
  if (error) return fail(error.message);
  return ok(null);
}

export async function createLocalCustomer(input: {
  companyName: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  taxNo: string;
}): Promise<ApiResult<QuoteLocalCustomerRow>> {
  const { data, error } = (await supabase
    .from("quote_customers" as never)
    .insert({
      company_name: input.companyName,
      contact_name: input.contactName || null,
      phone: input.phone || null,
      email: input.email || null,
      address: input.address || null,
      tax_no: input.taxNo || null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<QuoteLocalCustomerRow>;
  if (error || !data) return fail(error?.message ?? "Yerel müşteri kaydedilemedi.");
  return ok(data);
}

export async function fetchLocalCustomer(id: string): Promise<ApiResult<QuoteLocalCustomerRow>> {
  const { data, error } = (await supabase
    .from("quote_customers" as never)
    .select("*")
    .eq("id", id)
    .maybeSingle()) as unknown as DbResult<QuoteLocalCustomerRow>;
  if (error) return fail(error.message);
  if (!data) return fail("Yerel müşteri bulunamadı.");
  return ok(data);
}

export async function fetchQuotesForCustomer(
  source: QuoteCustomerSource,
  id: string,
): Promise<ApiResult<QuoteRow[]>> {
  const column = source === "parasut" ? "parasut_customer_id" : "local_customer_id";
  const { data, error } = (await supabase
    .from("quotes" as never)
    .select("*")
    .eq(column, id)
    .order("created_at", { ascending: false })) as unknown as DbResult<QuoteRow[]>;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function fetchHistoryEntriesForCustomer(
  source: QuoteCustomerSource,
  id: string,
): Promise<ApiResult<QuoteHistoryEntryRow[]>> {
  const column = source === "parasut" ? "parasut_customer_id" : "local_customer_id";
  const { data, error } = (await supabase
    .from("quote_history_entries" as never)
    .select("*")
    .eq(column, id)
    .order("quote_date", { ascending: false })) as unknown as DbResult<QuoteHistoryEntryRow[]>;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function addHistoryEntry(input: {
  source: QuoteCustomerSource;
  parasutCustomerId: string | null;
  localCustomerId: string | null;
  quoteNo: string;
  quoteDate: string;
  amount: number | null;
  currency: string;
  note: string;
}): Promise<ApiResult<QuoteHistoryEntryRow>> {
  const { data, error } = (await supabase
    .from("quote_history_entries" as never)
    .insert({
      customer_source: input.source,
      parasut_customer_id: input.source === "parasut" ? input.parasutCustomerId : null,
      local_customer_id: input.source === "local" ? input.localCustomerId : null,
      quote_no: input.quoteNo || null,
      quote_date: input.quoteDate || null,
      amount: input.amount,
      currency: input.currency || null,
      note: input.note || null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<QuoteHistoryEntryRow>;
  if (error || !data) return fail(error?.message ?? "Geçmiş teklif kaydedilemedi.");
  return ok(data);
}
