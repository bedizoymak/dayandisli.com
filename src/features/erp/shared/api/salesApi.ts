import { supabase } from "@/integrations/supabase/client";
import type {
  ApiResult,
  ERPQuotation,
  ERPQuotationConversionState,
  SalesOrder,
  SalesOrderItem,
  Stakeholder,
} from "../types";
import { createStakeholder } from "./crmApi";
import {
  applyEnterpriseScope,
  createAuditLog,
  DbResult,
  EnterpriseQueryScope,
  failure,
  getNextERPNumber,
  isMissingTableError,
  normalizeSearch,
  numberValue,
  resolveEnterpriseScope,
  success,
  withEnterpriseOwnership,
} from "./internal";

function validationFailure<T>(error: string, fallback: T): ApiResult<T> {
  return { data: fallback, error, missingTable: false };
}

export async function findOrCreateStakeholderByCompany(companyName: string) {
  const name = companyName.trim();
  if (!name) return validationFailure<Stakeholder | null>("Firma adı boş.", null);

  const { data: existing, error: selectError } = (await supabase
    .from("stakeholders" as never)
    .select("*")
    .ilike("company_name", name)
    .limit(1)
    .maybeSingle()) as unknown as DbResult<Stakeholder>;

  if (selectError && !isMissingTableError(selectError)) {
    return failure<Stakeholder | null>("findOrCreateStakeholderByCompany select", selectError, null);
  }

  if (existing) return success(existing);

  return createStakeholder({
    type: "customer",
    company_name: name,
    is_active: true,
  });
}

export async function listERPQuotationsFromExistingTable(limit = 100): Promise<ApiResult<ERPQuotation[]>> {
  const { data, error } = (await supabase
    .from("quotations" as never)
    .select("id, teklif_no, firma, ilgili_kisi, tel, email, konu, products, subtotal, kdv, total, active_currency, created_at")
    .order("created_at", { ascending: false })
    .limit(limit)) as unknown as DbResult<ERPQuotation[]>;

  if (error) return failure("listERPQuotationsFromExistingTable", error, []);
  return success(data ?? []);
}

export const listQuotations = listERPQuotationsFromExistingTable;

export async function getQuotationConversionState(quotationId: string): Promise<ApiResult<ERPQuotationConversionState>> {
  const defaultState: ERPQuotationConversionState = { converted: false, salesOrder: null, warning: null };

  const orderResult = (await supabase
    .from("sales_orders" as never)
    .select("*")
    .eq("source_quotation_id", quotationId)
    .limit(1)
    .maybeSingle()) as unknown as DbResult<SalesOrder>;

  if (orderResult.error && !isMissingTableError(orderResult.error)) {
    return failure("getQuotationConversionState sales_orders", orderResult.error, defaultState);
  }

  if (orderResult.data) {
    return success({
      converted: true,
      salesOrder: orderResult.data,
      warning: "Bu teklif daha önce siparişe dönüştürülmüş olabilir.",
    });
  }

  const linkResult = (await supabase
    .from("erp_quotation_links" as never)
    .select("id, status")
    .eq("quotation_id", quotationId)
    .eq("status", "converted_to_order")
    .limit(1)
    .maybeSingle()) as unknown as DbResult<{ id: string; status: string }>;

  if (linkResult.error && !isMissingTableError(linkResult.error)) {
    return failure("getQuotationConversionState erp_quotation_links", linkResult.error, defaultState);
  }

  if (linkResult.data) {
    return success({
      converted: true,
      salesOrder: null,
      warning: "Bu teklif daha önce siparişe dönüştürülmüş olabilir.",
    });
  }

  return success(defaultState);
}

export async function linkQuotationToStakeholder(quotationId: string, stakeholderId: string, status = "converted_to_order") {
  const { data, error } = (await supabase
    .from("erp_quotation_links" as never)
    .insert({ quotation_id: quotationId, stakeholder_id: stakeholderId, status } as never)
    .select("*")
    .single()) as unknown as DbResult<{ id: string }>;

  if (error) return failure("linkQuotationToStakeholder", error, null);
  return success(data);
}

function parseQuotationProducts(products: ERPQuotation["products"]) {
  if (!products) return [];
  if (Array.isArray(products)) return products as Record<string, unknown>[];

  try {
    const parsed = JSON.parse(String(products));
    return Array.isArray(parsed) ? (parsed as Record<string, unknown>[]) : [];
  } catch {
    return [];
  }
}

function quotationProductToItem(product: Record<string, unknown>, fallbackCurrency: string): Omit<SalesOrderItem, "id" | "sales_order_id" | "created_at"> {
  const quantity = numberValue(product.miktar ?? product.quantity, 1);
  const unitPrice = numberValue(product.birimFiyat ?? product.unit_price, 0);
  const descriptionParts = [product.cins, product.malzeme].filter(Boolean).map(String);

  return {
    item_code: product.kod ? String(product.kod) : null,
    description: descriptionParts.join(" - ") || "Teklif kalemi",
    quantity,
    unit: product.birim ? String(product.birim) : "adet",
    unit_price: unitPrice,
    total: quantity * unitPrice,
    technical_drawing_id: null,
  };
}

export async function listSalesOrders(search = "", scope?: EnterpriseQueryScope): Promise<ApiResult<SalesOrder[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  let query = applyEnterpriseScope(supabase
    .from("sales_orders" as never)
    .select("*")
    .order("created_at", { ascending: false }), enterpriseScope);

  const q = normalizeSearch(search);
  if (q) query = query.or(`order_no.ilike.%${q}%,title.ilike.%${q}%`);

  const { data, error } = (await query) as unknown as DbResult<SalesOrder[]>;
  if (error) return failure("listSalesOrders", error, []);
  return success(data ?? []);
}

export async function getSalesOrder(id: string) {
  const { data, error } = (await supabase
    .from("sales_orders" as never)
    .select("*")
    .eq("id", id)
    .single()) as unknown as DbResult<SalesOrder>;

  if (error) return failure("getSalesOrder", error, null);
  return success(data);
}

export const getSalesOrderById = getSalesOrder;

export async function createSalesOrder(payload: Partial<SalesOrder> & { title: string }) {
  const generated = payload.order_no ? success(payload.order_no) : await getNextERPNumber("SALES_ORDER");
  const orderNo = generated.data;
  const record = await withEnterpriseOwnership({
    order_no: orderNo,
    stakeholder_id: payload.stakeholder_id ?? null,
    source_quotation_id: payload.source_quotation_id ?? null,
    title: payload.title,
    description: payload.description ?? null,
    status: payload.status ?? "new",
    priority: payload.priority ?? "normal",
    order_date: payload.order_date ?? new Date().toISOString().slice(0, 10),
    due_date: payload.due_date ?? null,
    currency: payload.currency ?? "TRY",
    subtotal: payload.subtotal ?? 0,
    tax_total: payload.tax_total ?? 0,
    grand_total: payload.grand_total ?? 0,
    notes: payload.notes ?? null,
    company_id: payload.company_id ?? null,
    branch_id: payload.branch_id ?? null,
  });

  const { data, error } = (await supabase
    .from("sales_orders" as never)
    .insert(record as never)
    .select("*")
    .single()) as unknown as DbResult<SalesOrder>;

  if (error) return failure("createSalesOrder", error, null);
  return { data, error: null, missingTable: generated.missingTable };
}

export async function updateSalesOrder(id: string, payload: Partial<SalesOrder>) {
  const { data, error } = (await supabase
    .from("sales_orders" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<SalesOrder>;

  if (error) return failure("updateSalesOrder", error, null);
  return success(data);
}

export async function createSalesOrderItem(payload: Partial<SalesOrderItem> & { sales_order_id: string; description: string }) {
  const quantity = payload.quantity ?? 1;
  const unitPrice = payload.unit_price ?? 0;
  const total = payload.total ?? quantity * unitPrice;

  const { data, error } = (await supabase
    .from("sales_order_items" as never)
    .insert({
      sales_order_id: payload.sales_order_id,
      item_code: payload.item_code ?? null,
      description: payload.description,
      quantity,
      unit: payload.unit ?? "adet",
      unit_price: unitPrice,
      total,
      technical_drawing_id: payload.technical_drawing_id ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<SalesOrderItem>;

  if (error) return failure("createSalesOrderItem", error, null);
  return success(data);
}

export async function listSalesOrderItems(salesOrderId: string): Promise<ApiResult<SalesOrderItem[]>> {
  const { data, error } = (await supabase
    .from("sales_order_items" as never)
    .select("*")
    .eq("sales_order_id", salesOrderId)
    .order("created_at", { ascending: true })) as unknown as DbResult<SalesOrderItem[]>;

  if (error) return failure("listSalesOrderItems", error, []);
  return success(data ?? []);
}

export async function convertQuotationToSalesOrder(quotation: ERPQuotation) {
  const conversionState = await getQuotationConversionState(quotation.id);
  if (conversionState.data.converted) {
    return {
      data: conversionState.data.salesOrder,
      error: conversionState.data.warning,
      missingTable: conversionState.missingTable,
    };
  }

  const stakeholderResult = await findOrCreateStakeholderByCompany(quotation.firma);
  if (stakeholderResult.error || !stakeholderResult.data) return failure<SalesOrder | null>("convertQuotationToSalesOrder stakeholder", stakeholderResult.error, null);

  const currency = quotation.active_currency || "TRY";
  const orderResult = await createSalesOrder({
    stakeholder_id: stakeholderResult.data.id,
    source_quotation_id: quotation.id,
    title: `Tekliften Oluşan Sipariş - ${quotation.teklif_no}`,
    description: quotation.konu ?? null,
    currency,
    subtotal: quotation.subtotal ?? 0,
    tax_total: quotation.kdv ?? 0,
    grand_total: quotation.total ?? 0,
    status: "new",
  });

  if (orderResult.error || !orderResult.data) return orderResult;

  const products = parseQuotationProducts(quotation.products);
  for (const product of products) {
    const item = quotationProductToItem(product, currency);
    const itemResult = await createSalesOrderItem({ ...item, sales_order_id: orderResult.data.id });
    if (itemResult.error || !itemResult.data) {
      return failure<SalesOrder | null>("convertQuotationToSalesOrder item", itemResult.error ?? "Satış siparişi kalemi oluşturulamadı.", null);
    }
  }

  const linkResult = await linkQuotationToStakeholder(quotation.id, stakeholderResult.data.id, "converted_to_order");
  if (linkResult.error || !linkResult.data) {
    return failure<SalesOrder | null>("convertQuotationToSalesOrder link", linkResult.error ?? "Teklif dönüşüm bağlantısı oluşturulamadı.", null);
  }

  await createAuditLog({
    entity_type: "quotation",
    entity_id: quotation.id,
    action: "quotation_converted",
    description: `${quotation.teklif_no} numaralı teklif satış siparişine dönüştürüldü.`,
    metadata: { sales_order_id: orderResult.data.id, order_no: orderResult.data.order_no },
  });
  return orderResult;
}
