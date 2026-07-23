import { useMemo, useState } from "react";
import {
  Building2,
  Eye,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  FinanceBreadcrumb,
  FinanceExportMenu,
  type ExportColumn,
} from "./FinanceNavigationTools";
import { parasutQueryKeys, useParasutList, useParasutReports } from "@/features/erp/parasut/api/queries";
import { callParasutWriteApi } from "@/features/erp/parasut/api/write-client";
import { useERPAuth } from "@/contexts/ERPAuthContext";
import { Button } from "@/components/ui/button";
import type {
  GenericParasutRow,
  InvoiceListRow,
  ListQueryParams,
  ParasutListResource,
} from "@/features/erp/parasut/types";
import { formatParasutCurrency, formatParasutDate, formatParasutDateTime } from "@/features/erp/parasut/utils/format";
import { CreateCustomerDialog } from "@/features/erp/parasut/components/CreateCustomerDialog";

// Only resources with a real, proven direct-list sync wrapper on the server
// (server/parasut/sync-*.ts) get a "Sync" button — must match
// supabase/functions/parasut-write-api/index.ts's SYNCABLE_RESOURCES keys
// exactly. Every other canonical page (bank_fees, employees, sales_offers,
// ...) has no sync path yet; never fabricate one client-side.
const SYNCABLE_RESOURCES = new Set<ParasutListResource>([
  "customers",
  "suppliers",
  "products",
  "accounts",
  "sales_invoices",
  "purchase_bills",
]);

interface ResyncResponse {
  status: "completed" | "partial" | "failed";
  pages: number;
  observed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: number;
  reconciliation?: { archivedCount: number; skippedReason: string | null };
}

type Column = { key: string; label: string; kind?: "date" | "datetime" | "money" | "status" | "boolean"; currencyKey?: string };
type PageConfig = {
  resource: ParasutListResource;
  breadcrumb: string;
  title: string;
  subtitle: string;
  search: string;
  columns: Column[];
  filters?: ListQueryParams["filters"];
  actionLabel?: string;
  actionPath?: string;
  filename?: string;
  filterMode?: "invoice" | "search";
};

export const canonicalParasutPages: Record<string, PageConfig> = {
  invoices: { resource: "sales_invoices", breadcrumb: "Muhasebe ve Finans / Gelir Yönetimi / Faturalar", title: "Faturalar", subtitle: "Satış faturalarını görüntüleyin, filtreleyin ve yönetin.", search: "Fatura veya müşteri ara", filters: { archived: false }, actionLabel: "Yeni Fatura", actionPath: "/apps/finance/income/invoices/new", filename: "faturalar", filterMode: "invoice", columns: [{ key: "invoice_no", label: "Fatura No" }, { key: "partyName", label: "Müşteri" }, { key: "issue_date", label: "Fatura Tarihi", kind: "date" }, { key: "due_date", label: "Vade Tarihi", kind: "date" }, { key: "gross_total", label: "Tutar", kind: "money", currencyKey: "currency" }, { key: "payment_status", label: "Tahsilat Durumu", kind: "status" }, { key: "source_archived", label: "Durum", kind: "status" }] },
  customers: { resource: "customers", breadcrumb: "Muhasebe ve Finans / Gelir Yönetimi / Müşteriler", title: "Müşteriler", subtitle: "Müşteri hesaplarını görüntüleyin ve yönetin.", search: "Ad veya VKN / TCKN ara", filters: { archived: false }, actionLabel: "Yeni Müşteri", actionPath: "/apps/finance/income/customers/new", filename: "musteriler", filterMode: "search", columns: [{ key: "name", label: "Müşteri Adı" }, { key: "contact_type", label: "Tür" }, { key: "tax_number", label: "VKN / TCKN" }, { key: "email", label: "E-posta" }, { key: "phone", label: "Telefon" }, { key: "trl_balance", label: "Bakiye", kind: "money" }, { key: "source_archived", label: "Durum", kind: "status" }] },
  suppliers: { resource: "suppliers", breadcrumb: "Muhasebe ve Finans / Satın Alma / Tedarikçiler", title: "Tedarikçiler", subtitle: "Paraşüt tedarikçi hesapları.", search: "Tedarikçi adı, e-posta veya vergi no ara", filters: { archived: false }, filename: "tedarikciler", columns: [{ key: "name", label: "Tedarikçi" }, { key: "tax_number", label: "Vergi No" }, { key: "email", label: "E-posta" }, { key: "phone", label: "Telefon" }, { key: "trl_balance", label: "Bakiye", kind: "money" }] },
  purchaseBills: { resource: "purchase_bills", breadcrumb: "Muhasebe ve Finans / Gider Yönetimi / Gelen Faturalar", title: "Gelen Faturalar", subtitle: "Paraşüt alış faturaları.", search: "Fatura veya tedarikçi ara", filters: { archived: false }, actionLabel: "Yeni Alış Faturası", actionPath: "/apps/finance/expense/list/new/invoice", filename: "gelen-faturalar", columns: [{ key: "invoice_no", label: "Fatura No" }, { key: "partyName", label: "Tedarikçi" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "due_date", label: "Vade", kind: "date" }, { key: "gross_total", label: "Tutar", kind: "money", currencyKey: "currency" }, { key: "payment_status", label: "Durum", kind: "status" }] },
  expenses: { resource: "bank_fees", breadcrumb: "Muhasebe ve Finans / Gider Yönetimi / Gider Listesi", title: "Gider Listesi", subtitle: "Paraşüt banka masrafları ve gider kayıtları.", search: "Gider açıklaması ara", filters: { archived: false }, actionLabel: "Yeni Gider", actionPath: "/apps/finance/expense/list/new/other", filename: "giderler", columns: [{ key: "description", label: "Açıklama" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "due_date", label: "Vade", kind: "date" }, { key: "net_total", label: "Net Tutar", kind: "money", currencyKey: "currency" }, { key: "remaining", label: "Kalan", kind: "money", currencyKey: "currency" }] },
  accounts: { resource: "accounts", breadcrumb: "Muhasebe ve Finans / Kasa / Kasa ve Bankalar", title: "Kasa ve Bankalar", subtitle: "Paraşüt kasa ve banka hesapları.", search: "Hesap adı, banka veya IBAN ara", filters: { archived: false }, filename: "kasa-bankalar", columns: [{ key: "name", label: "Hesap" }, { key: "account_type", label: "Tür" }, { key: "bank_name", label: "Banka" }, { key: "iban", label: "IBAN" }, { key: "balance", label: "Bakiye", kind: "money", currencyKey: "currency" }] },
  products: { resource: "products", breadcrumb: "Muhasebe ve Finans / Stok Yönetimi / Hizmet ve Ürünler", title: "Hizmet ve Ürünler", subtitle: "Paraşüt ürün ve hizmet kartları.", search: "Ad, kod veya barkod ara", filters: { archived: false }, actionLabel: "Yeni Ürün / Hizmet", actionPath: "/apps/finance/inventory/products/new", filename: "urunler", columns: [{ key: "name", label: "Ürün / Hizmet" }, { key: "code", label: "Kod" }, { key: "unit", label: "Birim" }, { key: "stock_count", label: "Stok" }, { key: "list_price", label: "Satış Fiyatı", kind: "money", currencyKey: "currency" }] },
  stockHistory: { resource: "stock_movements", breadcrumb: "Muhasebe ve Finans / Stok Yönetimi / Stok Geçmişi", title: "Stok Geçmişi", subtitle: "Paraşüt stok hareketleri.", search: "Ürün veya depo Paraşüt kimliği ara", filters: { archived: false }, columns: [{ key: "product_parasut_id", label: "Ürün Paraşüt ID" }, { key: "warehouse_parasut_id", label: "Depo Paraşüt ID" }, { key: "date", label: "Tarih", kind: "date" }, { key: "quantity", label: "Miktar" }] },
  inventory: { resource: "inventory_levels", breadcrumb: "Muhasebe ve Finans / Stok Yönetimi / Stoktaki Ürünler", title: "Stoktaki Ürünler", subtitle: "Paraşüt güncel stok seviyeleri.", search: "Ürün veya depo Paraşüt kimliği ara", filters: { archived: false }, columns: [{ key: "product_parasut_id", label: "Ürün Paraşüt ID" }, { key: "warehouse_parasut_id", label: "Depo Paraşüt ID" }, { key: "stock_count", label: "Mevcut" }, { key: "critical_stock_count", label: "Kritik Seviye" }] },
  shipments: { resource: "shipment_documents", breadcrumb: "Muhasebe ve Finans / Stok Yönetimi / İrsaliyeler", title: "İrsaliyeler", subtitle: "Paraşüt sevk ve irsaliye belgeleri.", search: "Belge no, açıklama veya şehir ara", filters: { archived: false }, columns: [{ key: "invoice_no", label: "Belge No" }, { key: "description", label: "Açıklama" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "shipment_date", label: "Sevk", kind: "datetime" }, { key: "inflow", label: "Giriş", kind: "boolean" }] },
  offers: { resource: "sales_offers", breadcrumb: "Satış / Teklifler", title: "Teklifler", subtitle: "Paraşüt satış teklifleri.", search: "Teklif veya durum ara", filters: { archived: false }, actionLabel: "Yeni Teklif", actionPath: "/apps/sales/quotes/new", filename: "teklifler", columns: [{ key: "content", label: "Teklif" }, { key: "status", label: "Durum", kind: "status" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "gross_total", label: "Toplam", kind: "money", currencyKey: "currency" }] },
  employees: { resource: "employees", breadcrumb: "İnsan Kaynakları / Çalışanlar", title: "Çalışanlar", subtitle: "Paraşüt çalışan kayıtları.", search: "Ad, e-posta veya IBAN ara", filters: { archived: false }, columns: [{ key: "name", label: "Ad" }, { key: "email", label: "E-posta" }, { key: "iban", label: "IBAN" }, { key: "trl_balance", label: "TL Bakiye", kind: "money" }] },
  salaries: { resource: "salaries", breadcrumb: "İnsan Kaynakları / Maaşlar", title: "Maaşlar", subtitle: "Paraşüt maaş kayıtları.", search: "Açıklama veya çalışan Paraşüt kimliği ara", filters: { archived: false }, columns: [{ key: "description", label: "Açıklama" }, { key: "employee_parasut_id", label: "Çalışan Paraşüt ID" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "net_total", label: "Net", kind: "money", currencyKey: "currency" }, { key: "remaining", label: "Kalan", kind: "money", currencyKey: "currency" }] },
  eInvoices: { resource: "e_invoices", breadcrumb: "E-Belgeler / E-Faturalar", title: "E-Faturalar", subtitle: "Paraşüt gelen ve giden e-fatura kayıtları.", search: "Belge, cari veya VKN ara", filters: { archived: false }, columns: [{ key: "external_id", label: "Belge No" }, { key: "contact_name", label: "Cari" }, { key: "direction", label: "Yön" }, { key: "status", label: "Durum", kind: "status" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "net_total", label: "Net", kind: "money", currencyKey: "currency" }] },
};

function cell(row: GenericParasutRow & Partial<InvoiceListRow>, column: Column) {
  if (column.key === "partyName") return row.partyName ?? "—";
  if (column.key === "source_archived") return row.source_archived ? "Pasif" : "Aktif";
  if (column.key === "contact_type") {
    const contactType = row.attributes.contact_type;
    return contactType === "company" ? "Tüzel" : contactType === "person" ? "Gerçek" : String(contactType ?? "—");
  }
  const typedValue = (row as unknown as Record<string, unknown>)[column.key];
  const value = typedValue ?? row.attributes[column.key];
  if (column.kind === "date") return formatParasutDate(value as string | null);
  if (column.kind === "datetime") return formatParasutDateTime(value as string | null);
  if (column.kind === "money") return formatParasutCurrency(value as string | number | null, column.currencyKey ? String(row.attributes[column.currencyKey] ?? "TRL") : "TRL");
  if (column.kind === "boolean") return value === true ? "Evet" : value === false ? "Hayır" : "—";
  return String(value ?? "—");
}

export function SyncButton({ config }: { config: PageConfig }) {
  const { roles } = useERPAuth();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);

  if (!roles.includes("admin") || !SYNCABLE_RESOURCES.has(config.resource)) return null;

  async function handleClick() {
    // Belt-and-suspenders against a duplicate click: the button is also
    // `disabled` below, but React state updates aren't synchronous, so a
    // second click before the next render must still be a no-op here.
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      const result = await callParasutWriteApi<ResyncResponse>("resync", { resource: config.resource });
      if (result.error) {
        toast.error("Senkronizasyon başarısız.", { description: result.error });
        return;
      }
      const response = result.data;
      // No page reload — invalidate this resource's cached list queries
      // (every page/search/filter variation, hence the partial key match)
      // so the currently-visible table refetches on its own.
      await queryClient.invalidateQueries({ queryKey: [...parasutQueryKeys.all, "list", config.resource] });

      const archived = response.reconciliation?.archivedCount ?? 0;
      toast.success("Senkronizasyon tamamlandı.", {
        description: `${response.observed} kayıt senkronize edildi. ${archived} arşivlendi. ${response.errors} hata.`,
      });
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <Button className="income-sync-button" variant="outline" onClick={handleClick} disabled={isSyncing} aria-busy={isSyncing}>
      {isSyncing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
      {isSyncing ? "Senkronize ediliyor…" : "Senkronize Et"}
    </Button>
  );
}

type LiveRow = GenericParasutRow & Partial<InvoiceListRow>;

function LiveTableBody({
  config,
  rows,
  loading,
  error,
}: {
  config: PageConfig;
  rows: LiveRow[];
  loading: boolean;
  error: Error | null;
}) {
  if (loading) return <tr><td colSpan={config.columns.length + 1} className="income-state">Yükleniyor…</td></tr>;
  if (error) return <tr><td colSpan={config.columns.length + 1} className="income-state income-state-error">Veriler yüklenemedi: {error.message}</td></tr>;
  if (!rows.length) return <tr><td colSpan={config.columns.length + 1} className="income-state">Gösterilecek kayıt bulunamadı.</td></tr>;
  return rows.map((row) => <tr key={row.id}>
    {config.columns.map((column) => <td key={column.key}>{column.kind === "status"
      ? <span className={`income-status ${cell(row, column) === "Aktif" || cell(row, column).includes("Edildi") ? "success" : cell(row, column) === "Pasif" || cell(row, column).includes("Gecik") ? "danger" : "info"}`}>{cell(row, column)}</span>
      : cell(row, column)}</td>)}
    <td><button className="income-row-actions" title="Görüntüle · Düzenle · Çoğalt · Dışa Aktar · Arşivle"><MoreHorizontal /></button></td>
  </tr>);
}

function LivePagination({
  page,
  pageSize,
  total,
  totalPages,
  go,
  setPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  go: (page: number) => void;
  setPageSize: (size: number) => void;
}) {
  return <div className="income-pagination">
    <span>{total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} / ${total}` : "0 kayıt"}</span>
    <label>Sayfa boyutu <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}><option>10</option><option>25</option><option>50</option></select></label>
    <button disabled={page <= 1} onClick={() => go(page - 1)}>‹</button>
    <button className="active">{page}</button>
    <button disabled={page >= totalPages} onClick={() => go(page + 1)}>›</button>
  </div>;
}

export function CanonicalParasutListPage({ config }: { config: PageConfig }) {
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const [dueFrom, setDueFrom] = useState(params.get("dueFrom") ?? "");
  const [dueTo, setDueTo] = useState(params.get("dueTo") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = Math.max(10, Number(params.get("pageSize") ?? 25));
  const filters = useMemo(() => ({
    ...config.filters,
    ...(dueFrom ? { dueFrom } : {}),
    ...(dueTo ? { dueTo } : {}),
    ...(status ? { status } : {}),
  }), [config.filters, dueFrom, dueTo, status]);
  const queryParams = useMemo(() => ({ page, pageSize, search, filters }), [page, pageSize, search, filters]);
  const query = useParasutList<GenericParasutRow & Partial<InvoiceListRow>>(config.resource, queryParams);
  const rows = query.data?.rows ?? [];
  const exportColumns = useMemo<ExportColumn<GenericParasutRow & Partial<InvoiceListRow>>[]>(
    () => config.columns.map((column) => ({
      header: column.label,
      value: (row) => cell(row, column),
    })),
    [config.columns],
  );
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / pageSize));
  const go = (nextPage: number) => setParams((current) => {
    const next = new URLSearchParams(current);
    next.set("page", String(nextPage));
    next.set("pageSize", String(pageSize));
    if (search) next.set("q", search); else next.delete("q");
    if (dueFrom) next.set("dueFrom", dueFrom); else next.delete("dueFrom");
    if (dueTo) next.set("dueTo", dueTo); else next.delete("dueTo");
    if (status) next.set("status", status); else next.delete("status");
    return next;
  });
  const setPageSize = (size: number) => {
    const next = new URLSearchParams(params);
    next.set("pageSize", String(size));
    next.set("page", "1");
    setParams(next);
  };
  const error = query.isError
    ? query.error instanceof Error ? query.error : new Error("Beklenmeyen hata")
    : null;
  const pagination = <LivePagination page={page} pageSize={pageSize} total={query.data?.total ?? 0} totalPages={totalPages} go={go} setPageSize={setPageSize} />;
  const customerCreate = config.resource === "customers"
    ? <CreateCustomerDialog onCreated={() => queryClient.invalidateQueries({ queryKey: [...parasutQueryKeys.all, "list", "customers"] })} />
    : null;

  if (config.resource === "products" || config.resource === "suppliers" || config.resource === "stock_movements" || config.resource === "inventory_levels" || config.resource === "shipment_documents" || config.resource === "purchase_bills" && config.breadcrumb.includes("Satın Alma")) {
    return <div className="ops-page" data-provider="parasut">
      <header className="ops-header"><div><FinanceBreadcrumb value={config.breadcrumb} /><h1>{config.title}</h1></div><div>{config.actionPath ? <Link className="ops-primary" to={config.actionPath}>{config.actionLabel}</Link> : null}<FinanceExportMenu title={config.title} filename={config.filename ?? config.resource} rows={rows} columns={exportColumns} /><SyncButton config={config} /></div></header>
      <div className="ops-filters"><label><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={config.search} /></label><button onClick={() => go(1)}>Filtrele</button><button onClick={() => { setSearch(""); setParams({}); }}>Temizle</button></div>
      <div className="ebru-card ops-table-wrap"><table className="ops-table"><thead><tr>{config.columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>İşlemler</th></tr></thead><tbody><LiveTableBody config={config} rows={rows} loading={query.isLoading} error={error} /></tbody></table>{pagination}</div>
    </div>;
  }

  if (config.resource === "sales_offers") {
    return <div className="sales-page" data-provider="parasut">
      <header className="sales-header"><div><span>Satış / Teklifler</span><h1>Teklifler</h1><p>{config.subtitle}</p></div><div><FinanceExportMenu title={config.title} filename="teklifler" rows={rows} columns={exportColumns} /><Link className="sales-primary" to="/apps/sales/quotes/new">Yeni Teklif Oluştur</Link><SyncButton config={config} /></div></header>
      <div className="ebru-card sales-filters"><label className="search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={config.search} /></label><select><option>Tüm Durumlar</option></select><button onClick={() => go(1)}>Filtrele</button></div>
      <div className="ebru-card sales-table-wrap"><table className="sales-table"><thead><tr>{config.columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>İşlemler</th></tr></thead><tbody><LiveTableBody config={config} rows={rows} loading={query.isLoading} error={error} /></tbody></table>{pagination}</div>
    </div>;
  }

  if (config.resource === "customers" && config.breadcrumb.startsWith("Müşteri")) {
    const currentBalance = rows.reduce((sum, row) => sum + Number(row.attributes.trl_balance ?? 0), 0);
    return <div className="crm-page" data-provider="parasut">
      <header className="crm-page-head"><div><FinanceBreadcrumb value="Müşteri İlişkileri / Müşteriler" /><h1>Müşteriler</h1><p>Müşteri ilişkilerini, proje bağlantılarını, tahsilatları ve kalan bakiyeleri tek yerden izleyin.</p></div><div><FinanceExportMenu title="Müşteriler" filename="crm-musteriler" rows={rows} columns={exportColumns} />{customerCreate}<SyncButton config={config} /></div></header>
      <section className="crm-kpis"><article className="ebru-card"><span>Toplam Müşteri</span><strong>{query.data?.total ?? 0}</strong></article><article className="ebru-card"><span>Toplam Tahsilat</span><strong>—</strong></article><article className="ebru-card"><span>Bekleyen Tahsilat</span><strong>{formatParasutCurrency(currentBalance, "TRL")}</strong></article><article className="ebru-card"><span>Bakiyesi Kapanan</span><strong>{rows.filter((row) => Number(row.attributes.trl_balance ?? 0) === 0).length}</strong></article></section>
      <div className="ebru-card crm-filters"><label className="search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Firma, kişi, telefon, e-posta, TC/VKN ara" /></label><select><option>Tüm Türler</option><option>Tüzel Kişi</option><option>Gerçek Kişi</option></select><select><option>Tüm Projeler</option></select><select><option>Tüm Bakiyeler</option><option>Bakiyesi Açık</option><option>Bakiyesi Kapalı</option></select></div>
      <div className="ebru-card crm-table-wrap"><table className="crm-table"><thead><tr><th>Müşteri</th><th>Telefon</th><th>Projeler</th><th>Planlanan Alacak</th><th>Tahsil Edilen</th><th>Kalan Bakiye</th><th>İşlemler</th></tr></thead><tbody>{query.isLoading || error || !rows.length ? <LiveTableBody config={{ ...config, columns: config.columns.slice(0, 6) }} rows={[]} loading={query.isLoading} error={error} /> : rows.map((row) => <tr key={row.id}><td><div className="crm-customer-cell"><i>{row.attributes.contact_type === "company" ? <Building2 /> : <UserRound />}</i><span><Link to={`/apps/crm/customers/${row.parasut_id}`}>{String(row.attributes.name ?? "—")}</Link><small>{cell(row, { key: "contact_type", label: "Tür" })} · {String(row.attributes.tax_number ?? "—")}</small></span></div></td><td>{String(row.attributes.phone ?? "—")}<small>{String(row.attributes.email ?? "")}</small></td><td>—</td><td>—</td><td>—</td><td><strong>{formatParasutCurrency(row.attributes.trl_balance as string | null, "TRL")}</strong></td><td><div className="crm-row-actions"><Link title="Görüntüle" to={`/apps/crm/customers/${row.parasut_id}`}><Eye /></Link><Link title="Düzenle" to={`/apps/crm/customers/${row.parasut_id}/edit`}><Pencil /></Link><button title="Sil" type="button"><Trash2 /></button><button title="Diğer" type="button"><MoreHorizontal /></button></div></td></tr>)}</tbody></table>{pagination}</div>
    </div>;
  }

  if (config.resource === "accounts") {
    return <div className="report-page" data-provider="parasut">
      <header className="report-header"><div><FinanceBreadcrumb value={config.breadcrumb} /><h1>{config.title}</h1></div><div className="report-actions"><FinanceExportMenu title={config.title} filename="kasa-ve-bankalar" rows={rows} columns={exportColumns} /><SyncButton config={config} /></div></header>
      <div className="ebru-card report-filters"><label className="wide"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Hesap ara" /></label><button onClick={() => go(1)}>Filtrele</button></div>
      <div className="ebru-card report-table-wrap"><table><thead><tr>{config.columns.map((column) => <th key={column.key}>{column.label}</th>)}<th>İşlemler</th></tr></thead><tbody><LiveTableBody config={config} rows={rows} loading={query.isLoading} error={error} /></tbody></table>{pagination}</div>
    </div>;
  }

  return <div className="income-page" data-provider="parasut">
    <header className="income-page-head"><div><FinanceBreadcrumb value={config.breadcrumb} /><h1>{config.title}</h1><p>{config.subtitle}</p></div><div>{customerCreate ?? (config.actionLabel && config.actionPath ? <Link className="income-primary" to={config.actionPath}>{config.actionLabel}</Link> : null)}<FinanceExportMenu title={config.title} filename={config.filename ?? config.resource} rows={rows} columns={exportColumns} /><SyncButton config={config} /></div></header>
    <div className="ebru-card income-filters">
      {config.filterMode === "invoice" ? <><label>Başlangıç Tarihi<input type="date" value={dueFrom} onChange={(event) => setDueFrom(event.target.value)} /></label><label>Bitiş Tarihi<input type="date" value={dueTo} onChange={(event) => setDueTo(event.target.value)} /></label><label>Durum<select defaultValue=""><option value="">Tümü</option><option value="open">Onaylandı</option><option value="paid">Kapandı</option></select></label><label>Tahsilat Durumu<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tümü</option><option value="unpaid">Tahsil Edilecek</option><option value="paid">Tahsil Edildi</option></select></label></> : null}
      <label className="income-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={config.search} /></label>
      {config.resource === "customers" ? <><label>Durum<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tümü</option><option value="active">Aktif</option><option value="archived">Pasif</option></select></label><label>Bakiye Durumu<select><option>Tümü</option><option>Borçlu</option><option>Alacaklı</option><option>Dengede</option></select></label></> : null}
      <Button className="income-filter-button" onClick={() => go(1)}>Filtrele</Button>
      <Button variant="ghost" className="income-clear" onClick={() => { setSearch(""); setDueFrom(""); setDueTo(""); setStatus(""); setParams({}); }}>Filtreleri Temizle</Button>
    </div>
    <section className="ebru-card income-table-card"><div className="income-table-scroll"><table><thead><tr>{config.columns.map((column) => <th key={column.key}>{column.label} ↕</th>)}<th>İşlemler</th></tr></thead><tbody>
      {query.isLoading ? <tr><td colSpan={config.columns.length + 1} className="income-state">Yükleniyor…</td></tr>
        : query.isError ? <tr><td colSpan={config.columns.length + 1} className="income-state income-state-error">Veriler yüklenemedi: {query.error instanceof Error ? query.error.message : "Beklenmeyen hata"}</td></tr>
        : !rows.length ? <tr><td colSpan={config.columns.length + 1} className="income-state">Gösterilecek kayıt bulunamadı.</td></tr>
        : rows.map((row) => <tr key={row.id}>{config.columns.map((column) => <td key={column.key}>{column.kind === "status" ? <span className={`income-status ${cell(row, column) === "Aktif" || cell(row, column).includes("Edildi") ? "success" : cell(row, column) === "Pasif" || cell(row, column).includes("Gecik") ? "danger" : "info"}`}>{cell(row, column)}</span> : cell(row, column)}</td>)}<td><button className="income-row-actions" title="Görüntüle · Düzenle · Çoğalt · Dışa Aktar · Arşivle"><MoreHorizontal /></button></td></tr>)}
    </tbody></table></div>
      <div className="income-pagination"><span>{query.data?.total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, query.data.total)} / ${query.data.total}` : "0 kayıt"}</span><label>Sayfa boyutu <select value={pageSize} onChange={(event) => { const next = new URLSearchParams(params); next.set("pageSize", event.target.value); next.set("page", "1"); setParams(next); }}><option>10</option><option>25</option><option>50</option></select></label><button disabled={page <= 1} onClick={() => go(page - 1)}>‹</button><button className="active">{page}</button><button disabled={page >= totalPages} onClick={() => go(page + 1)}>›</button></div>
    </section>
  </div>;
}

export function CanonicalFinanceReportPage({ kind }: { kind: "collections" | "payments" | "incomeExpense" | "vat" | "cash" }) {
  const query = useParasutReports();
  const title = { collections: "Tahsilat Raporu", payments: "Ödemeler Raporu", incomeExpense: "Gelir-Gider Raporu", vat: "KDV Raporu", cash: "Kasa / Banka Raporu" }[kind];
  const shellClass = kind === "collections" ? "income-page" : "report-page";
  if (query.isLoading) return <div className={shellClass}><div className="ebru-card income-state">Yükleniyor…</div></div>;
  if (query.isError) return <div className={shellClass}><div className="ebru-card income-state income-state-error">Veriler yüklenemedi: {query.error instanceof Error ? query.error.message : "Beklenmeyen hata"}</div></div>;
  const data = query.data;
  if (!data) return <div className={shellClass}><div className="ebru-card income-state">Rapor için kullanılabilir kayıt bulunamadı.</div></div>;

  const reportHeader = <header className={kind === "collections" ? "income-page-head" : "report-header"}><div><FinanceBreadcrumb value={`Muhasebe ve Finans / Raporlar / ${title}`} /><h1>{title}</h1><p>Gerçek Paraşüt ayna verilerinden oluşturulur.</p></div></header>;
  const dateFilters = <div className="ebru-card report-filters"><label>Başlangıç<input type="date" /></label><label>Bitiş<input type="date" /></label><button>Filtrele</button><button>Temizle</button></div>;

  if (kind === "collections") {
    const total = data.collectionSummary.map((row) => formatParasutCurrency(row.total, row.currency)).join(" · ") || "—";
    const overdue = data.receivablesAging.flatMap((bucket) => bucket.totals).map((row) => formatParasutCurrency(row.total, row.currency)).join(" · ") || "—";
    const max = Math.max(1, ...data.receivablesAging.map((bucket) => bucket.count));
    return <div className="income-page" data-provider="parasut">{reportHeader}
      <section className="income-kpis"><article className="ebru-card"><span>Planlanmamış</span><strong>—</strong></article><article className="ebru-card"><span>Vadesi Geçen</span><strong>{overdue}</strong></article><article className="ebru-card"><span>Toplam Tahsilat</span><strong>{total}</strong></article><article className="ebru-card"><span>Ortalama Vade Aşımı</span><strong>—</strong></article></section>
      <article className="ebru-card aging-chart"><h2>Tahsilat Yaşlandırması</h2><div className="aging-bars">{data.receivablesAging.map((bucket) => <div key={bucket.bucket}><span>{bucket.count}</span><i style={{ height: `${Math.max(10, bucket.count / max * 100)}%` }} /><small>{bucket.bucket}</small></div>)}</div>{!data.receivablesAging.length && <div className="income-state">Yaşlandırma verisi bulunamadı.</div>}</article>
      <div className="ebru-card income-filters"><label>Başlangıç<input type="date" /></label><label>Bitiş<input type="date" /></label><label>Müşteri<select><option>Tümü</option></select></label><label>Fatura Türü<select><option>Tümü</option></select></label><label className="income-search"><Search /><input placeholder="Raporda ara" /></label><button className="income-filter-button">Filtrele</button><button className="income-clear">Filtreleri Temizle</button></div>
      <section className="ebru-card income-table-card"><div className="income-table-scroll"><table><thead><tr><th>Para Birimi</th><th>Tahsilat Tutarı</th></tr></thead><tbody>{data.collectionSummary.map((row) => <tr key={row.currency}><td>{row.currency}</td><td>{formatParasutCurrency(row.total, row.currency)}</td></tr>)}</tbody></table>{!data.collectionSummary.length && <div className="income-state">Tahsilat kaydı bulunamadı.</div>}</div></section>
    </div>;
  }

  if (kind === "incomeExpense") {
    return <div className="report-page" data-provider="parasut">{reportHeader}{dateFilters}<div className="income-expense-grid">
      {[{ title: "Gelirler", rows: data.salesSummary, tone: "income" }, { title: "Giderler", rows: data.purchaseSummary, tone: "expense" }].map((section) => <article className="ebru-card report-distribution" key={section.title}><div><h2>{section.title}</h2>{section.rows.map((row) => <p key={row.currency}><span>{row.currency}</span><strong>{formatParasutCurrency(row.gross, row.currency)}</strong></p>)}<footer><span>Toplam</span><strong>{section.rows.length ? section.rows.map((row) => formatParasutCurrency(row.gross, row.currency)).join(" · ") : "—"}</strong></footer></div><div className={`report-donut ${section.tone}`}><span>{section.rows.length ? "Canlı" : "—"}</span></div></article>)}
    </div><article className="ebru-card report-net"><span>Net</span><strong>Para birimi bazında yukarıda</strong></article></div>;
  }

  const rows = kind === "payments" ? data.paymentSummary : kind === "cash" ? data.customerBalances : data.salesSummary;
  return <div className="report-page" data-provider="parasut">{reportHeader}{dateFilters}
    {kind === "payments" ? <section className="report-kpis"><article className="ebru-card"><span>Planlanmamış</span><strong>—</strong></article><article className="ebru-card"><span>Vadesi Geçen</span><strong>{data.payablesAging.flatMap((bucket) => bucket.totals).map((row) => formatParasutCurrency(row.total, row.currency)).join(" · ") || "—"}</strong></article><article className="ebru-card"><span>Toplam Ödeme</span><strong>{data.paymentSummary.map((row) => formatParasutCurrency(row.total, row.currency)).join(" · ") || "—"}</strong></article><article className="ebru-card"><span>Ort. Vade Aşımı</span><strong>—</strong></article></section> : null}
    <section className="ebru-card report-table-wrap"><table><thead><tr><th>Para Birimi / Kayıt</th><th>Adet</th><th>Tutar</th></tr></thead><tbody>{!rows.length ? <tr><td colSpan={3} className="income-state">Rapor için kullanılabilir kayıt bulunamadı.</td></tr> : rows.map((row, index) => { const item = row as unknown as Record<string, unknown>; const attributes = item.attributes as Record<string, unknown> | undefined; return <tr key={index}><td>{String(item.currency ?? attributes?.name ?? "—")}</td><td>{String(item.count ?? "—")}</td><td>{formatParasutCurrency((item.total ?? item.gross ?? attributes?.trl_balance) as string | null, String(item.currency ?? "TRL"))}</td></tr>; })}</tbody></table></section>
  </div>;
}
