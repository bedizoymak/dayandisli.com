// Platform-agnostic handler logic for the parasut-api Edge Function.
// Deliberately has NO Deno-specific imports (no `Deno.env`, no `serve`, no
// esm.sh URL imports) so this file can be imported directly by Vitest for
// handler/query-layer tests — the exact code that runs in production is
// what's under test, not a reimplementation. `index.ts` is the thin Deno
// entrypoint that wires environment/auth/routing around these handlers.
//
// TENANT ISOLATION: every exported handler takes an `activeCompanyId:
// string` (already resolved and validated by `resolveCompanyScope` in
// ../_shared/company-scope.ts before any handler runs) and reaches the
// database ONLY through `scopedParasutTable`/`scopedSyncTable` below, which
// apply `.eq("company_id", activeCompanyId)` at construction time. No other
// function in this file is allowed to call `admin.schema(...).from(...)`
// directly — that is enforced by convention (see the two helpers) and by
// the isolation tests in handlers.test.ts.
import {
  buildMonthlyTrend,
  buildUpcomingTimeline,
  computeAgingReport,
  computeMonthlyVatEstimate,
  computeOpenDocumentSummary,
  computeUnsentSummary,
  sumDecimalStrings,
  type CurrencyTotal,
  type MirrorRow,
} from "../_shared/parasut-metrics.ts";

// ---------------------------------------------------------------------
// Minimal structural Supabase/PostgREST client shape. The real Deno
// supabase-js client satisfies this structurally (it has every one of these
// methods, plus more), so no Deno-specific import is needed here — only
// index.ts imports the real `createClient`.
// ---------------------------------------------------------------------
export interface QueryResult<T> {
  data: T[] | null;
  error: { message: string } | null;
  count?: number | null;
}
export interface SingleResult<T> {
  data: T | null;
  error: { message: string } | null;
}

/** What a real PostgREST `.select()` call returns — filter/sort/pagination methods live here, NOT on the raw `.from(table)` result. */
export interface ScopedQuery<T> extends PromiseLike<QueryResult<T>> {
  eq(column: string, value: unknown): ScopedQuery<T>;
  is(column: string, value: null | boolean): ScopedQuery<T>;
  in(column: string, values: unknown[]): ScopedQuery<T>;
  gt(column: string, value: unknown): ScopedQuery<T>;
  gte(column: string, value: unknown): ScopedQuery<T>;
  lte(column: string, value: unknown): ScopedQuery<T>;
  not(column: string, operator: string, value: unknown): ScopedQuery<T>;
  or(expression: string): ScopedQuery<T>;
  ilike(column: string, pattern: string): ScopedQuery<T>;
  filter(column: string, operator: string, value: unknown): ScopedQuery<T>;
  order(column: string, options?: { ascending?: boolean }): ScopedQuery<T>;
  range(from: number, to: number): ScopedQuery<T>;
  limit(count: number): ScopedQuery<T>;
  maybeSingle(): PromiseLike<SingleResult<T>>;
}

/** What a real PostgREST `.from(table)` call returns, before any filter can be applied: only `.select()`. This module is read-only, so `.insert()`/`.update()`/`.delete()`/`.upsert()` are deliberately not modeled here at all — there is nothing to accidentally call. */
export interface SelectableTable {
  select<T = Record<string, unknown>>(columns?: string, options?: { count?: "exact" }): ScopedQuery<T>;
}

export interface SupabaseAdminLike {
  schema(name: string): { from(table: string): SelectableTable };
  from(table: string): SelectableTable;
}

// ---------------------------------------------------------------------
// The ONLY two ways handler code may reach `parasut.*` —
// both require columns up front and immediately apply an exact `company_id`
// filter as the very next call, before any other filter/sort/pagination.
// There is no exported helper that returns an unscoped table reference.
//
// NOTE on call order: the real PostgREST/supabase-js query builder only
// exposes filter methods (`.eq()`, `.in()`, etc.) on the object returned by
// `.select()` (or `.insert()`/`.update()`/`.delete()`) — `.from(table)`
// itself has no `.eq()`. That's why `columns` is a required parameter here
// instead of letting each handler call `.select()` whenever it likes: it
// lets these two helpers call `.select(columns, options).eq("company_id", ...)`
// in the one order the real API actually supports, while still guaranteeing
// company scoping happens immediately and cannot be forgotten by a handler.
// ---------------------------------------------------------------------
export function scopedParasutTable<T = Record<string, unknown>>(
  admin: SupabaseAdminLike,
  table: string,
  activeCompanyId: string,
  columns = "*",
  options?: { count?: "exact" },
): ScopedQuery<T> {
  return admin.schema("parasut").from(table).select<T>(columns, options).eq("company_id", activeCompanyId);
}

export function scopedSyncTable<T = Record<string, unknown>>(
  admin: SupabaseAdminLike,
  table: string,
  activeCompanyId: string,
  columns = "*",
  options?: { count?: "exact" },
): ScopedQuery<T> {
  return admin.schema("parasut").from(table).select<T>(columns, options).eq("company_id", activeCompanyId);
}

// ---------------------------------------------------------------------
// Minimal row/relationship shapes for values coming back from Supabase.
// ---------------------------------------------------------------------
interface RelationshipRef {
  id: string;
  type: string;
}

interface Relationships {
  [key: string]: { data?: RelationshipRef | RelationshipRef[] | null } | undefined;
}

/** Column list matching `MirrorRow`'s shape exactly (from ../_shared/parasut-metrics.ts), so its query results can be typed as `MirrorRow[]` directly with no cast. */
const MIRROR_ROW_COLUMNS = "parasut_id, attributes, relationships, source_archived, synced_at, last_seen_at";

interface MirrorRecord {
  id?: string;
  parasut_id: string;
  company_id?: string;
  attributes: Record<string, unknown>;
  relationships: Relationships;
  source_created_at?: string | null;
  source_updated_at?: string | null;
  source_archived?: boolean | null;
  synced_at?: string;
  last_seen_at?: string;
}

interface TypedMirrorRecord extends Omit<MirrorRecord, "attributes" | "relationships"> {
  attributes?: Record<string, unknown>;
  relationships?: Relationships;
  raw_payload?: Record<string, unknown>;
  [key: string]: unknown;
}

function relationshipId(relationships: Relationships, key: string): string | undefined {
  const ref = relationships[key]?.data;
  if (!ref || Array.isArray(ref)) return undefined;
  return ref.id;
}

function relationshipIds(relationships: Relationships, key: string): string[] {
  const ref = relationships[key]?.data;
  if (!ref) return [];
  return Array.isArray(ref) ? ref.map((item) => item.id) : [ref.id];
}

// ---------------------------------------------------------------------
// Resource allowlist
// ---------------------------------------------------------------------
export const LIST_RESOURCES = [
  "customers",
  "suppliers",
  "products",
  "sales_invoices",
  "purchase_bills",
  "accounts",
  "payments",
  "sales_offers",
  "bank_fees",
  "taxes",
  "transactions",
  "inventory_levels",
  "stock_movements",
  "stock_updates",
  "shipment_documents",
  "item_categories",
  "employees",
  "salaries",
  "e_invoices",
  "e_invoice_inboxes",
  "e_archives",
  "e_smms",
  "trackable_jobs",
] as const;
export type ListResource = (typeof LIST_RESOURCES)[number];

export function isListResource(value: unknown): value is ListResource {
  return typeof value === "string" && (LIST_RESOURCES as readonly string[]).includes(value);
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

export function clampPage(page: unknown): number {
  const parsed = Number(page);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

export function clampPageSize(pageSize: unknown): number {
  const parsed = Number(pageSize);
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_PAGE_SIZE;
  return Math.min(Math.floor(parsed), MAX_PAGE_SIZE);
}

export interface ListParams {
  resource: ListResource;
  page?: number;
  pageSize?: number;
  search?: string;
  sort?: { field?: string; direction?: "asc" | "desc" };
  filters?: Record<string, unknown>;
}

const LIST_SELECT_COLUMNS = "id, parasut_id, company_id, attributes, relationships, source_created_at, source_updated_at, source_archived, synced_at, last_seen_at";

type TypedResourceConfig = {
  table: string;
  fields: readonly string[];
  search: readonly string[];
  defaultSort?: string;
  currencyField?: string;
  dateField?: string;
  statusField?: string;
};

const TYPED_RESOURCE_CONFIG: Partial<Record<ListResource, TypedResourceConfig>> = {
  sales_offers: { table: "sales_offers", fields: ["content", "status", "net_total", "gross_total", "description", "issue_date", "due_date", "currency", "contact_parasut_id"], search: ["content", "description", "status"], defaultSort: "issue_date", currencyField: "currency", dateField: "issue_date", statusField: "status" },
  bank_fees: { table: "bank_fees", fields: ["description", "currency", "issue_date", "due_date", "net_total", "total_paid", "remaining"], search: ["description"], defaultSort: "issue_date", currencyField: "currency", dateField: "issue_date" },
  taxes: { table: "taxes", fields: ["description", "issue_date", "due_date", "net_total", "total_paid", "remaining"], search: ["description"], defaultSort: "issue_date", dateField: "issue_date" },
  transactions: { table: "transactions", fields: ["description", "transaction_type", "date", "amount_in_trl", "debit_amount", "debit_currency", "credit_amount", "credit_currency", "debit_account_parasut_id", "credit_account_parasut_id"], search: ["description", "transaction_type"], defaultSort: "date", dateField: "date" },
  inventory_levels: { table: "inventory_levels", fields: ["stock_count", "initial_stock_count", "critical_stock_count", "product_parasut_id", "warehouse_parasut_id"], search: ["product_parasut_id", "warehouse_parasut_id"] },
  stock_movements: { table: "stock_movements", fields: ["detail_no", "date", "quantity", "warehouse_parasut_id", "product_parasut_id", "source_parasut_id", "contact_parasut_id"], search: ["product_parasut_id", "warehouse_parasut_id"], defaultSort: "date", dateField: "date" },
  stock_updates: { table: "stock_updates", fields: [], search: [] },
  shipment_documents: { table: "shipment_documents", fields: ["invoice_no", "description", "issue_date", "shipment_date", "inflow", "city", "district", "contact_parasut_id"], search: ["invoice_no", "description", "city"], defaultSort: "issue_date", dateField: "issue_date" },
  item_categories: { table: "item_categories", fields: ["name", "full_path", "category_type", "parent_category_parasut_id"], search: ["name", "full_path", "category_type"], defaultSort: "name" },
  employees: { table: "employees", fields: ["name", "email", "iban", "balance", "trl_balance", "usd_balance", "eur_balance", "gbp_balance"], search: ["name", "email", "iban"], defaultSort: "name" },
  salaries: { table: "salaries", fields: ["description", "currency", "issue_date", "due_date", "net_total", "total_paid", "remaining", "employee_parasut_id"], search: ["description", "employee_parasut_id"], defaultSort: "issue_date", currencyField: "currency", dateField: "issue_date" },
  e_invoices: { table: "e_invoices", fields: ["external_id", "direction", "contact_name", "status", "response_type", "issue_date", "net_total", "currency", "invoice_parasut_id"], search: ["external_id", "contact_name", "from_vkn", "to_vkn"], defaultSort: "issue_date", currencyField: "currency", dateField: "issue_date", statusField: "status" },
  e_invoice_inboxes: { table: "e_invoice_inboxes", fields: ["vkn", "e_invoice_address", "name", "inbox_type", "registered_at"], search: ["vkn", "e_invoice_address", "name"], defaultSort: "registered_at" },
  e_archives: { table: "e_archives", fields: ["vkn", "invoice_number", "note", "status", "printed_at", "is_printed", "is_signed", "sales_invoice_parasut_id"], search: ["vkn", "invoice_number", "note"], defaultSort: "printed_at", statusField: "status" },
  e_smms: { table: "e_smms", fields: ["printed_at", "vkn", "invoice_number", "is_printed", "sales_invoice_parasut_id"], search: ["vkn"], defaultSort: "printed_at" },
  trackable_jobs: { table: "trackable_jobs", fields: ["status"], search: ["status"], defaultSort: "last_seen_at", statusField: "status" },
};

function normalizeTypedRecord(row: TypedMirrorRecord, config: TypedResourceConfig): MirrorRecord {
  const fallback = row.raw_payload && typeof row.raw_payload === "object"
    ? ((row.raw_payload.attributes as Record<string, unknown> | undefined) ?? row.raw_payload)
    : {};
  const attributes = Object.fromEntries(config.fields.map((field) => [field, row[field] ?? fallback[field] ?? null]));
  return {
    id: row.id,
    parasut_id: row.parasut_id,
    company_id: row.company_id,
    attributes,
    relationships: row.relationships ?? {},
    source_created_at: row.source_created_at,
    source_updated_at: row.source_updated_at,
    source_archived: row.source_archived,
    synced_at: row.synced_at,
    last_seen_at: row.last_seen_at,
  };
}

export async function handleList(admin: SupabaseAdminLike, params: ListParams, activeCompanyId: string) {
  const page = clampPage(params.page);
  const pageSize = clampPageSize(params.pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let table: ScopedQuery<MirrorRecord> | null = null;
  let searchColumns: string[] = [];
  const sortField = params.sort?.field;
  const sortDirection = params.sort?.direction === "asc" ? "asc" : "desc";
  const typedConfig = TYPED_RESOURCE_CONFIG[params.resource];

  if (typedConfig) {
    const baseColumns = ["id", "parasut_id", "company_id", "source_created_at", "source_updated_at", "source_archived", "synced_at", "last_seen_at", "raw_payload"];
    let typedQuery = scopedParasutTable<TypedMirrorRecord>(
      admin,
      typedConfig.table,
      activeCompanyId,
      [...baseColumns, ...typedConfig.fields].join(", "),
      { count: "exact" },
    );
    const filters = params.filters ?? {};
    if (filters.archived === false) typedQuery = typedQuery.eq("source_archived", false);
    if (filters.currency && typedConfig.currencyField) typedQuery = typedQuery.eq(typedConfig.currencyField, filters.currency);
    if (filters.dueFrom && typedConfig.dateField) typedQuery = typedQuery.gte(typedConfig.dateField, filters.dueFrom);
    if (filters.dueTo && typedConfig.dateField) typedQuery = typedQuery.lte(typedConfig.dateField, filters.dueTo);
    if (filters.status && typedConfig.statusField && typeof filters.status === "string") typedQuery = typedQuery.eq(typedConfig.statusField, filters.status);
    const search = params.search?.trim().replace(/[%,]/g, "");
    if (search && typedConfig.search.length) typedQuery = typedQuery.or(typedConfig.search.map((column) => `${column}.ilike.%${search}%`).join(","));
    const allowedSort = sortField && typedConfig.fields.includes(sortField) ? sortField : typedConfig.defaultSort ?? "last_seen_at";
    const { data, error, count } = await typedQuery.order(allowedSort, { ascending: sortDirection === "asc" }).range(from, to);
    if (error) throw new Error(error.message);
    return { rows: (data ?? []).map((row) => normalizeTypedRecord(row, typedConfig)), total: count ?? 0, page, pageSize };
  }

  switch (params.resource) {
    case "customers":
    case "suppliers": {
      table = scopedParasutTable<MirrorRecord>(admin, "contacts", activeCompanyId, LIST_SELECT_COLUMNS, { count: "exact" }).eq(
        "attributes->>account_type",
        params.resource === "customers" ? "customer" : "supplier",
      );
      // Deletion-reconciliation default: a contact deleted in Paraşüt is
      // marked source_archived = true by the mirror sync (see
      // server/parasut/reconciliation.ts), never physically removed. Normal
      // customer/supplier lists must exclude those by default — only an
      // EXPLICIT filters.archived === true opts into seeing them (e.g. a
      // future "show archived" toggle). This differs from every other
      // resource below, whose existing default (show everything unless the
      // caller explicitly passes archived: false) is left untouched.
      //
      // Matches "false OR null" rather than eq("source_archived", false):
      // rows synced before this feature existed (or any contact Paraşüt
      // never reported an `archived` attribute for) have source_archived =
      // NULL, not false — an eq(..., false) filter would wrongly exclude
      // every one of those under normal SQL NULL semantics.
      if ((params.filters ?? {}).archived !== true) {
        table = table.or("source_archived.eq.false,source_archived.is.null");
      }
      searchColumns = ["attributes->>name", "attributes->>email", "attributes->>tax_number"];
      break;
    }
    case "products": {
      table = scopedParasutTable<MirrorRecord>(admin, "products", activeCompanyId, LIST_SELECT_COLUMNS, { count: "exact" });
      searchColumns = ["attributes->>name", "attributes->>code", "attributes->>barcode"];
      break;
    }
    case "sales_invoices": {
      table = scopedParasutTable<MirrorRecord>(admin, "sales_invoices", activeCompanyId, LIST_SELECT_COLUMNS, { count: "exact" });
      searchColumns = ["attributes->>invoice_no", "attributes->>description"];
      break;
    }
    case "purchase_bills": {
      table = scopedParasutTable<MirrorRecord>(admin, "purchase_bills", activeCompanyId, LIST_SELECT_COLUMNS, { count: "exact" });
      searchColumns = ["attributes->>invoice_no", "attributes->>description"];
      break;
    }
    case "accounts": {
      table = scopedParasutTable<MirrorRecord>(admin, "accounts", activeCompanyId, LIST_SELECT_COLUMNS, { count: "exact" });
      searchColumns = ["attributes->>name", "attributes->>bank_name", "attributes->>iban"];
      break;
    }
    case "payments": {
      table = scopedParasutTable<MirrorRecord>(admin, "payments", activeCompanyId, LIST_SELECT_COLUMNS, { count: "exact" });
      searchColumns = ["attributes->>notes"];
      break;
    }
  }

  if (!table) throw new Error("Desteklenmeyen Paraşüt liste kaynağı.");
  const filters = params.filters ?? {};
  if (filters.archived === false) table = table.eq("source_archived", false);
  if (filters.currency && typeof filters.currency === "string") table = table.eq("attributes->>currency", filters.currency);
  if (filters.dueFrom && typeof filters.dueFrom === "string") table = table.gte("attributes->>due_date", filters.dueFrom);
  if (filters.dueTo && typeof filters.dueTo === "string") table = table.lte("attributes->>due_date", filters.dueTo);
  if (filters.onlyOpen === true) table = table.gt("attributes->>remaining", "0");

  const search = params.search?.trim();
  if (search && searchColumns.length > 0) {
    table = table.or(searchColumns.map((column) => `${column}.ilike.%${search.replace(/[%,]/g, "")}%`).join(","));
  }

  const sortColumn = sortField ? `attributes->>${sortField}` : "last_seen_at";
  const { data, error, count } = await table.order(sortColumn, { ascending: sortDirection === "asc" }).range(from, to);

  if (error) throw new Error(error.message);
  const rows = data ?? [];

  if (params.resource === "sales_invoices" || params.resource === "purchase_bills") {
    const relationshipKey = params.resource === "sales_invoices" ? "contact" : "supplier";
    const partyIds = Array.from(new Set(rows.map((row) => relationshipId(row.relationships, relationshipKey)).filter((id): id is string => Boolean(id))));
    const partyNames = await resolveContactNames(admin, partyIds, activeCompanyId);
    return {
      rows: rows.map((row) => ({ ...row, partyName: partyNames.get(relationshipId(row.relationships, relationshipKey) ?? "") ?? null })),
      total: count ?? 0,
      page,
      pageSize,
    };
  }

  return { rows, total: count ?? 0, page, pageSize };
}

/**
 * Paraşüt's `payments` resource does not reliably carry a usable
 * `relationships.payable` back-reference in captured API responses, so
 * "is this a collection (from a sales invoice) or a payment (to a purchase
 * bill)?" cannot be answered from the payment row alone. Instead we
 * paginate from the PARENT side (sales_invoices/purchase_bills), whose
 * `relationships.payments.data` IS confirmed reliable, and resolve each
 * page's payment rows from there — both queries scoped to the same
 * activeCompanyId, so a payment can never be resolved from a different
 * company's parent document.
 */
export async function handlePaymentsList(admin: SupabaseAdminLike, kind: "collection" | "payment", page: number, pageSize: number, activeCompanyId: string, search?: string) {
  const parentTable = kind === "collection" ? "sales_invoices" : "purchase_bills";
  const relationshipKey = kind === "collection" ? "contact" : "supplier";
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = scopedParasutTable<MirrorRecord>(admin, parentTable, activeCompanyId, "parasut_id, attributes, relationships", { count: "exact" }).not(
    "relationships->payments->data",
    "eq",
    "[]",
  );
  if (search?.trim()) query = query.ilike("attributes->>invoice_no", `%${search.trim().replace(/[%,]/g, "")}%`);

  const { data: parents, count, error } = await query.order("last_seen_at", { ascending: false }).range(from, to);
  if (error) throw new Error(error.message);

  const paymentIds: string[] = [];
  const paymentParentContext = new Map<string, { documentNo: string | null; partyId: string | undefined }>();
  for (const parent of parents ?? []) {
    const ids = relationshipIds(parent.relationships, "payments");
    const partyId = relationshipId(parent.relationships, relationshipKey);
    for (const id of ids) {
      paymentParentContext.set(id, { documentNo: (parent.attributes?.invoice_no as string | null) ?? null, partyId });
    }
    paymentIds.push(...ids);
  }

  const { data: paymentRows, error: paymentsError } = paymentIds.length
    ? await scopedParasutTable<MirrorRecord>(
        admin,
        "payments",
        activeCompanyId,
        "id, parasut_id, attributes, relationships, source_created_at, source_updated_at, source_archived, synced_at, last_seen_at",
      ).in("parasut_id", paymentIds)
    : { data: [] as MirrorRecord[], error: null };
  if (paymentsError) throw new Error(paymentsError.message);

  const partyIds = Array.from(new Set(Array.from(paymentParentContext.values()).map((context) => context.partyId).filter((id): id is string => Boolean(id))));
  const partyNames = await resolveContactNames(admin, partyIds, activeCompanyId);

  const rows = (paymentRows ?? []).map((paymentRow) => {
    const context = paymentParentContext.get(paymentRow.parasut_id);
    return {
      ...paymentRow,
      documentNo: context?.documentNo ?? null,
      partyName: context?.partyId ? partyNames.get(context.partyId) ?? null : null,
      kind,
    };
  });

  return { rows, total: count ?? 0, page, pageSize };
}

/** Company-aware: only resolves contact names within the active company's own `parasut.contacts` rows. */
export async function resolveContactNames(admin: SupabaseAdminLike, ids: string[], activeCompanyId: string): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await scopedParasutTable<MirrorRecord>(admin, "contacts", activeCompanyId, "parasut_id, attributes").in("parasut_id", ids);
  return new Map((data ?? []).map((row) => [row.parasut_id, (row.attributes?.name as string) ?? row.parasut_id]));
}

export async function handleDetail(admin: SupabaseAdminLike, resource: ListResource | "sync_runs", parasutId: string, activeCompanyId: string) {
  if (resource === "sales_invoices" || resource === "purchase_bills") {
    const { data: header, error } = await scopedParasutTable<MirrorRecord>(admin, resource, activeCompanyId, "*").eq("parasut_id", parasutId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!header) return null;

    const detailsTable = resource === "sales_invoices" ? "sales_invoice_details" : "purchase_bill_details";
    const relationships = header.relationships;
    const detailIds = relationshipIds(relationships, "details");
    const paymentIds = relationshipIds(relationships, "payments");
    const contactRelKey = resource === "sales_invoices" ? "contact" : "supplier";
    const contactId = relationshipId(relationships, contactRelKey);

    const [{ data: details }, { data: payments }, contactRow] = await Promise.all([
      detailIds.length ? scopedParasutTable<MirrorRecord>(admin, detailsTable, activeCompanyId, "*").in("parasut_id", detailIds) : Promise.resolve({ data: [] as MirrorRecord[] }),
      paymentIds.length ? scopedParasutTable<MirrorRecord>(admin, "payments", activeCompanyId, "*").in("parasut_id", paymentIds) : Promise.resolve({ data: [] as MirrorRecord[] }),
      contactId ? scopedParasutTable<MirrorRecord>(admin, "contacts", activeCompanyId, "*").eq("parasut_id", contactId).maybeSingle() : Promise.resolve({ data: null as MirrorRecord | null }),
    ]);

    const detailRows = details ?? [];
    const productIds = Array.from(new Set(detailRows.map((detail) => relationshipId(detail.relationships, "product")).filter((id): id is string => Boolean(id))));
    const { data: products } = productIds.length
      ? await scopedParasutTable<MirrorRecord>(admin, "products", activeCompanyId, "parasut_id, attributes").in("parasut_id", productIds)
      : { data: [] as MirrorRecord[] };
    const productNameById = new Map((products ?? []).map((product) => [product.parasut_id, (product.attributes?.name as string | undefined) ?? product.parasut_id]));

    return {
      header,
      contact: contactRow.data,
      details: detailRows.map((detail) => ({ ...detail, productName: productNameById.get(relationshipId(detail.relationships, "product") ?? "") ?? null })),
      payments: payments ?? [],
    };
  }

  if (resource === "customers" || resource === "suppliers") {
    const { data: contact, error } = await scopedParasutTable<MirrorRecord>(admin, "contacts", activeCompanyId, "*").eq("parasut_id", parasutId).maybeSingle();
    if (error) throw new Error(error.message);
    if (!contact) return null;
    const relKey = resource === "customers" ? "contact" : "supplier";
    const table = resource === "customers" ? "sales_invoices" : "purchase_bills";
    const { data: recentDocuments } = await scopedParasutTable<MirrorRecord>(admin, table, activeCompanyId, "parasut_id, attributes")
      .filter("relationships", "cs", JSON.stringify({ [relKey]: { data: { id: parasutId } } }))
      .order("last_seen_at", { ascending: false })
      .limit(20);
    return { contact, recentDocuments: recentDocuments ?? [] };
  }

  if (resource === "products" || resource === "accounts" || resource === "payments") {
    const table = resource;
    const { data, error } = await scopedParasutTable<MirrorRecord>(admin, table, activeCompanyId, "*").eq("parasut_id", parasutId).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? { record: data } : null;
  }

  if (resource === "sync_runs") {
    const [{ data: run, error }, { data: errors }] = await Promise.all([
      scopedSyncTable<Record<string, unknown> & { id: string }>(admin, "sync_runs", activeCompanyId, "*").eq("id", parasutId).maybeSingle(),
      scopedSyncTable<Record<string, unknown>>(admin, "sync_errors", activeCompanyId, "*").eq("sync_run_id", parasutId).order("occurred_at", { ascending: false }).limit(100),
    ]);
    if (error) throw new Error(error.message);
    return run ? { run, errors: errors ?? [] } : null;
  }

  return null;
}

export const RESOURCE_TYPE_TABLES: Array<{ resourceType: string; table: string }> = [
  { resourceType: "contacts", table: "contacts" },
  { resourceType: "products", table: "products" },
  { resourceType: "sales_invoices", table: "sales_invoices" },
  { resourceType: "purchase_bills", table: "purchase_bills" },
  { resourceType: "accounts", table: "accounts" },
];

export async function handleDashboard(admin: SupabaseAdminLike, activeCompanyId: string) {
  const now = new Date();

  const [salesResult, purchaseResult, accountsResult, contactsResult] = await Promise.all([
    scopedParasutTable<MirrorRow>(admin, "sales_invoices", activeCompanyId, MIRROR_ROW_COLUMNS),
    scopedParasutTable<MirrorRow>(admin, "purchase_bills", activeCompanyId, MIRROR_ROW_COLUMNS),
    scopedParasutTable<MirrorRecord>(admin, "accounts", activeCompanyId, "*").order("attributes->>name", { ascending: true }),
    scopedParasutTable<MirrorRecord>(admin, "contacts", activeCompanyId, "parasut_id, attributes"),
  ]);
  if (salesResult.error) throw new Error(salesResult.error.message);
  if (purchaseResult.error) throw new Error(purchaseResult.error.message);
  if (accountsResult.error) throw new Error(accountsResult.error.message);
  if (contactsResult.error) throw new Error(contactsResult.error.message);

  const salesRows = salesResult.data ?? [];
  const purchaseRows = purchaseResult.data ?? [];
  const contactNamesById = new Map((contactsResult.data ?? []).map((row) => [row.parasut_id, (row.attributes?.name as string | undefined) ?? row.parasut_id]));

  const collectionsSummary = computeOpenDocumentSummary(salesRows, now);
  const paymentsSummary = computeOpenDocumentSummary(purchaseRows, now);
  const unsentSummary = computeUnsentSummary(salesRows);
  const vatEstimate = computeMonthlyVatEstimate(salesRows, purchaseRows, now);
  const timeline = buildUpcomingTimeline(salesRows, purchaseRows, contactNamesById, now, 20);

  const [recentInvoices, recentBills, recentSyncRuns, recentSyncErrors] = await Promise.all([
    scopedParasutTable<MirrorRecord>(admin, "sales_invoices", activeCompanyId, "parasut_id, attributes, synced_at").order("synced_at", { ascending: false }).limit(5),
    scopedParasutTable<MirrorRecord>(admin, "purchase_bills", activeCompanyId, "parasut_id, attributes, synced_at").order("synced_at", { ascending: false }).limit(5),
    scopedSyncTable<Record<string, unknown>>(admin, "sync_runs", activeCompanyId, "*").order("started_at", { ascending: false }).limit(5),
    scopedSyncTable<Record<string, unknown>>(admin, "sync_errors", activeCompanyId, "*").order("occurred_at", { ascending: false }).limit(5),
  ]);

  const latestRunPerResource = await Promise.all(
    RESOURCE_TYPE_TABLES.map(async ({ resourceType }) => {
      const { data } = await scopedSyncTable<Record<string, unknown>>(admin, "sync_runs", activeCompanyId, "*")
        .eq("resource_type", resourceType)
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return { resourceType, latestRun: data ?? null };
    }),
  );

  return {
    collectionsSummary,
    paymentsSummary,
    unsentSummary,
    vatEstimate,
    accounts: accountsResult.data ?? [],
    timeline,
    recentActivity: {
      invoices: recentInvoices.data ?? [],
      bills: recentBills.data ?? [],
      syncRuns: recentSyncRuns.data ?? [],
      syncErrors: recentSyncErrors.data ?? [],
    },
    resourceAvailability: latestRunPerResource,
  };
}

function summarizeDocuments(rows: MirrorRow[]): { currency: string; count: number; net: string; vat: string; gross: string }[] {
  const currencies = new Set(rows.map((row) => (row.attributes.currency as string | undefined) ?? "TRY"));
  return Array.from(currencies)
    .map((currency) => {
      const rowsInCurrency = rows.filter((row) => ((row.attributes.currency as string | undefined) ?? "TRY") === currency);
      return {
        currency,
        count: rowsInCurrency.length,
        net: sumDecimalStrings(rowsInCurrency.map((row) => row.attributes.net_total as string | undefined)),
        vat: sumDecimalStrings(rowsInCurrency.map((row) => row.attributes.total_vat as string | undefined)),
        gross: sumDecimalStrings(rowsInCurrency.map((row) => row.attributes.gross_total as string | undefined)),
      };
    })
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

async function summarizePayments(admin: SupabaseAdminLike, parentTable: "sales_invoices" | "purchase_bills", activeCompanyId: string): Promise<CurrencyTotal[]> {
  const { data: parents, error } = await scopedParasutTable<MirrorRecord>(admin, parentTable, activeCompanyId, "relationships")
    .eq("source_archived", false)
    .not("relationships->payments->data", "eq", "[]")
    .limit(2000);
  if (error) throw new Error(error.message);

  const paymentIds = Array.from(new Set((parents ?? []).flatMap((parent) => relationshipIds(parent.relationships, "payments"))));
  if (paymentIds.length === 0) return [];

  const { data: payments, error: paymentsError } = await scopedParasutTable<MirrorRecord>(admin, "payments", activeCompanyId, "attributes").in("parasut_id", paymentIds);
  if (paymentsError) throw new Error(paymentsError.message);

  const paymentRows = payments ?? [];
  const currencies = new Set(paymentRows.map((payment) => (payment.attributes?.currency as string | undefined) ?? "TRY"));
  return Array.from(currencies)
    .map((currency) => ({
      currency,
      total: sumDecimalStrings(
        paymentRows.filter((payment) => ((payment.attributes?.currency as string | undefined) ?? "TRY") === currency).map((payment) => payment.attributes?.amount as string | undefined),
      ),
    }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export async function handleReports(admin: SupabaseAdminLike, activeCompanyId: string) {
  const now = new Date();

  const [salesResult, purchaseResult, customersResult, suppliersResult] = await Promise.all([
    scopedParasutTable<MirrorRow>(admin, "sales_invoices", activeCompanyId, MIRROR_ROW_COLUMNS),
    scopedParasutTable<MirrorRow>(admin, "purchase_bills", activeCompanyId, MIRROR_ROW_COLUMNS),
    scopedParasutTable<MirrorRecord>(admin, "contacts", activeCompanyId, "parasut_id, attributes").eq("attributes->>account_type", "customer").order("attributes->>trl_balance", { ascending: false }).limit(20),
    scopedParasutTable<MirrorRecord>(admin, "contacts", activeCompanyId, "parasut_id, attributes").eq("attributes->>account_type", "supplier").order("attributes->>trl_balance", { ascending: false }).limit(20),
  ]);
  if (salesResult.error) throw new Error(salesResult.error.message);
  if (purchaseResult.error) throw new Error(purchaseResult.error.message);
  if (customersResult.error) throw new Error(customersResult.error.message);
  if (suppliersResult.error) throw new Error(suppliersResult.error.message);

  const salesRows = salesResult.data ?? [];
  const purchaseRows = purchaseResult.data ?? [];
  const nonArchivedSales = salesRows.filter((row) => !row.source_archived);
  const nonArchivedPurchases = purchaseRows.filter((row) => !row.source_archived);

  const [collectionSummary, paymentSummary] = await Promise.all([
    summarizePayments(admin, "sales_invoices", activeCompanyId),
    summarizePayments(admin, "purchase_bills", activeCompanyId),
  ]);

  const salesTrend = buildMonthlyTrend(salesRows, 12, now, "gross_total");
  const purchaseTrend = buildMonthlyTrend(purchaseRows, 12, now, "gross_total");

  return {
    salesSummary: summarizeDocuments(nonArchivedSales),
    collectionSummary,
    purchaseSummary: summarizeDocuments(nonArchivedPurchases),
    paymentSummary,
    incomeExpenseComparison: { sales: salesTrend, purchases: purchaseTrend },
    receivablesAging: computeAgingReport(salesRows, now),
    payablesAging: computeAgingReport(purchaseRows, now),
    customerBalances: customersResult.data ?? [],
    supplierBalances: suppliersResult.data ?? [],
    monthlyInvoiceTrend: salesTrend,
  };
}

export async function handleSyncStatus(admin: SupabaseAdminLike, params: { page?: number; pageSize?: number }, activeCompanyId: string) {
  const page = clampPage(params.page);
  const pageSize = clampPageSize(params.pageSize);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [{ data: runs, count: runCount, error: runError }, { data: errors, count: errorCount, error: errorError }, latestRuns] = await Promise.all([
    scopedSyncTable<Record<string, unknown>>(admin, "sync_runs", activeCompanyId, "*", { count: "exact" }).order("started_at", { ascending: false }).range(from, to),
    scopedSyncTable<Record<string, unknown>>(admin, "sync_errors", activeCompanyId, "*", { count: "exact" }).order("occurred_at", { ascending: false }).range(0, 24),
    Promise.all(
      RESOURCE_TYPE_TABLES.map(async ({ resourceType }) => {
        const { data } = await scopedSyncTable<Record<string, unknown>>(admin, "sync_runs", activeCompanyId, "*")
          .eq("resource_type", resourceType)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        return { resourceType, latestRun: data ?? null };
      }),
    ),
  ]);
  if (runError) throw new Error(runError.message);
  if (errorError) throw new Error(errorError.message);

  return {
    runs: runs ?? [],
    runTotal: runCount ?? 0,
    page,
    pageSize,
    errors: errors ?? [],
    errorTotal: errorCount ?? 0,
    latestRunPerResource: latestRuns,
  };
}
