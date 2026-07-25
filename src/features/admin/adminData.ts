import { supabase } from "@/integrations/supabase/client";
import {
  getERPDashboardMetrics,
  getERPDatabaseStatus,
  getERPReportSummary,
  listEmployees,
  listERPQuotationsFromExistingTable,
  listInventoryItems,
  listInvoices,
  listMaintenanceTasks,
  listPayments,
  listPurchaseOrders,
  listQualityReports,
  listSalesOrders,
  listShipments,
  listStakeholders,
  listSubcontractingJobs,
  listWorkOrders,
} from "@/features/erp/shared/erpApi";
import type { ApiResult } from "@/features/erp/shared/types";

export type AdminMetric = {
  label: string;
  value: string;
  detail?: string;
};

export type AdminTableRow = Record<string, unknown> & { id?: string | number };

export type AdminTableConfig = {
  key: string;
  title: string;
  description: string;
  table: string;
  searchPlaceholder: string;
  columns: Array<{
    key: string;
    label: string;
    format?: "currency" | "date" | "boolean" | "number";
  }>;
  searchFields: string[];
  orderBy?: string;
  editableFields?: Array<{
    key: string;
    label: string;
    type?: "text" | "number" | "textarea" | "select" | "boolean";
    options?: string[];
    optionLabels?: Record<string, string>;
    required?: boolean;
  }>;
  valueLabels?: Record<string, Record<string, string>>;
};

export const adminTableConfigs: Record<string, AdminTableConfig> = {
  products: {
    key: "products",
    title: "Ürün Kataloğu",
    description: "Dişli ürünleri, stok durumu ve fiyat bilgileri.",
    table: "products",
    searchPlaceholder: "Ürün, SKU, kategori ara",
    searchFields: ["name", "sku", "category", "brand"],
    orderBy: "updated_at",
    columns: [
      { key: "name", label: "Ürün" },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Kategori" },
      { key: "price", label: "Fiyat", format: "currency" },
      { key: "stock_quantity", label: "Stok", format: "number" },
      { key: "in_stock", label: "Satışta", format: "boolean" },
    ],
    editableFields: [
      { key: "name", label: "Ürün adı", required: true },
      { key: "slug", label: "Slug", required: true },
      { key: "sku", label: "SKU" },
      { key: "category", label: "Kategori" },
      { key: "brand", label: "Marka" },
      { key: "price", label: "Fiyat", type: "number", required: true },
      { key: "currency", label: "Para birimi", type: "select", options: ["TRY", "USD", "EUR"] },
      { key: "stock_quantity", label: "Stok", type: "number" },
      { key: "in_stock", label: "Satışta", type: "boolean" },
      { key: "description", label: "Açıklama", type: "textarea" },
    ],
  },
  orders: {
    key: "orders",
    title: "Mağaza Siparişleri",
    description: "Web mağazadan gelen siparişlerin durum takibi.",
    table: "orders",
    searchPlaceholder: "Sipariş no, müşteri, şirket ara",
    searchFields: ["order_number", "customer_name", "company_name", "email", "phone"],
    orderBy: "created_at",
    columns: [
      { key: "order_number", label: "Sipariş" },
      { key: "customer_name", label: "Müşteri" },
      { key: "company_name", label: "Firma" },
      { key: "grand_total", label: "Toplam", format: "currency" },
      { key: "status", label: "Durum" },
      { key: "created_at", label: "Tarih", format: "date" },
    ],
    editableFields: [
      {
        key: "status",
        label: "Durum",
        type: "select",
        options: ["new", "confirmed", "preparing", "shipped", "completed", "cancelled"],
        optionLabels: {
          new: "Yeni",
          confirmed: "Onaylandı",
          preparing: "Hazırlanıyor",
          shipped: "Sevk Edildi",
          completed: "Tamamlandı",
          cancelled: "İptal",
        },
      },
      { key: "notes", label: "Notlar", type: "textarea" },
    ],
    valueLabels: {
      status: {
        new: "Yeni",
        confirmed: "Onaylandı",
        preparing: "Hazırlanıyor",
        shipped: "Sevk Edildi",
        completed: "Tamamlandı",
        cancelled: "İptal",
      },
    },
  },
  quotations: {
    key: "quotations",
    title: "Teklifler",
    description: "Hazırlanan tekliflerin hızlı kontrol ekranı.",
    table: "quotations",
    searchPlaceholder: "Teklif no, firma, ilgili kişi ara",
    searchFields: ["teklif_no", "firma", "ilgili_kisi", "email", "tel"],
    orderBy: "created_at",
    columns: [
      { key: "teklif_no", label: "Teklif" },
      { key: "firma", label: "Firma" },
      { key: "ilgili_kisi", label: "İlgili" },
      { key: "total", label: "Toplam", format: "currency" },
      { key: "active_currency", label: "Para Birimi" },
      { key: "created_at", label: "Tarih", format: "date" },
    ],
  },
};

function formatError(error: unknown) {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

export function formatAdminValue(value: unknown, format?: AdminTableConfig["columns"][number]["format"], labels?: Record<string, string>) {
  if (value === null || value === undefined || value === "") return "-";
  if (labels?.[String(value)]) return labels[String(value)];
  if (format === "currency") {
    const amount = Number(value);
    return Number.isFinite(amount)
      ? new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 }).format(amount)
      : String(value);
  }
  if (format === "date") return new Intl.DateTimeFormat("tr-TR").format(new Date(String(value)));
  if (format === "boolean") return value ? "Evet" : "Hayır";
  if (format === "number") return new Intl.NumberFormat("tr-TR").format(Number(value) || 0);
  return String(value);
}

export async function listAdminRows(config: AdminTableConfig, search = ""): Promise<ApiResult<AdminTableRow[]>> {
  let query = supabase.from(config.table as never).select("*").limit(100);
  if (config.orderBy) query = query.order(config.orderBy as never, { ascending: false });

  const trimmed = search.trim();
  if (trimmed) {
    const terms = config.searchFields.map((field) => `${field}.ilike.%${trimmed}%`).join(",");
    query = query.or(terms as never);
  }

  const { data, error } = (await query) as { data: AdminTableRow[] | null; error: unknown };
  return { data: data ?? [], error: formatError(error) };
}

export async function upsertAdminRow(config: AdminTableConfig, row: AdminTableRow) {
  const now = new Date().toISOString();
  const payload = { ...row, updated_at: now };
  const request = row.id
    ? supabase.from(config.table as never).update(payload as never).eq("id" as never, row.id as never).select("*").single()
    : supabase.from(config.table as never).insert(payload as never).select("*").single();

  const { data, error } = (await request) as { data: AdminTableRow | null; error: unknown };
  return { data, error: formatError(error) };
}

export async function deleteAdminRow(config: AdminTableConfig, id: string | number) {
  const { error } = await supabase.from(config.table as never).delete().eq("id" as never, id as never);
  return { data: !error, error: formatError(error) };
}

export async function getAdminOverview() {
  const [
    metrics,
    reports,
    database,
    quotations,
    customers,
    suppliers,
    salesOrders,
    workOrders,
    inventory,
    employees,
  ] = await Promise.all([
    getERPDashboardMetrics(),
    getERPReportSummary(),
    getERPDatabaseStatus(),
    listERPQuotationsFromExistingTable(5),
    listStakeholders("", "customer"),
    listStakeholders("", "supplier"),
    listSalesOrders(),
    listWorkOrders(),
    listInventoryItems(),
    listEmployees(),
  ]);

  return {
    metrics,
    reports,
    database,
    quotations,
    customers,
    suppliers,
    salesOrders,
    workOrders,
    inventory,
    employees,
  };
}

export async function getAdminOperationsSummary() {
  const [salesOrders, workOrders, purchaseOrders, subcontracting, shipments, quality, maintenance, inventory] = await Promise.all([
    listSalesOrders(),
    listWorkOrders(),
    listPurchaseOrders(),
    listSubcontractingJobs(),
    listShipments(),
    listQualityReports(),
    listMaintenanceTasks(),
    listInventoryItems(),
  ]);

  return { salesOrders, workOrders, purchaseOrders, subcontracting, shipments, quality, maintenance, inventory };
}

export async function getAdminFinanceSummary() {
  const [reports, invoices, payments, customers, suppliers] = await Promise.all([
    getERPReportSummary(),
    listInvoices(),
    listPayments(),
    listStakeholders("", "customer"),
    listStakeholders("", "supplier"),
  ]);

  return { reports, invoices, payments, customers, suppliers };
}
