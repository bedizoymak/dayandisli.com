import { useMemo, useState } from "react";
import { Loader2, MoreHorizontal, RefreshCw, Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { FinanceBreadcrumb } from "./FinanceNavigationTools";
import { parasutQueryKeys, useParasutList, useParasutReports } from "@/features/erp/parasut/api/queries";
import { callParasutWriteApi } from "@/features/erp/parasut/api/write-client";
import { useERPAuth } from "@/contexts/ERPAuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  GenericParasutRow,
  InvoiceListRow,
  ListQueryParams,
  ParasutListResource,
} from "@/features/erp/parasut/types";
import { formatParasutCurrency, formatParasutDate, formatParasutDateTime } from "@/features/erp/parasut/utils/format";

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
  filterMode?: "invoice" | "search";
};

export const canonicalParasutPages: Record<string, PageConfig> = {
  invoices: { resource: "sales_invoices", breadcrumb: "Muhasebe ve Finans / Gelir Yönetimi / Faturalar", title: "Faturalar", subtitle: "Satış faturalarını görüntüleyin, filtreleyin ve yönetin.", search: "Fatura veya müşteri ara", filters: { archived: false }, actionLabel: "Yeni Fatura", filterMode: "invoice", columns: [{ key: "invoice_no", label: "Fatura No" }, { key: "partyName", label: "Müşteri" }, { key: "issue_date", label: "Fatura Tarihi", kind: "date" }, { key: "due_date", label: "Vade Tarihi", kind: "date" }, { key: "gross_total", label: "Tutar", kind: "money", currencyKey: "currency" }, { key: "payment_status", label: "Durum", kind: "status" }] },
  customers: { resource: "customers", breadcrumb: "Muhasebe ve Finans / Gelir Yönetimi / Müşteriler", title: "Müşteriler", subtitle: "Müşteri hesaplarını görüntüleyin ve yönetin.", search: "Ad, e-posta veya VKN / TCKN ara", filters: { archived: false }, actionLabel: "Yeni Müşteri", filterMode: "search", columns: [{ key: "name", label: "Müşteri Adı" }, { key: "tax_number", label: "VKN / TCKN" }, { key: "email", label: "E-posta" }, { key: "phone", label: "Telefon" }, { key: "trl_balance", label: "Bakiye", kind: "money" }, { key: "source_archived", label: "Durum", kind: "status" }] },
  suppliers: { resource: "suppliers", breadcrumb: "Muhasebe ve Finans / Satın Alma / Tedarikçiler", title: "Tedarikçiler", subtitle: "Paraşüt tedarikçi hesapları.", search: "Tedarikçi adı, e-posta veya vergi no ara", filters: { archived: false }, columns: [{ key: "name", label: "Tedarikçi" }, { key: "tax_number", label: "Vergi No" }, { key: "email", label: "E-posta" }, { key: "phone", label: "Telefon" }, { key: "trl_balance", label: "Bakiye", kind: "money" }] },
  purchaseBills: { resource: "purchase_bills", breadcrumb: "Muhasebe ve Finans / Gider Yönetimi / Gelen Faturalar", title: "Gelen Faturalar", subtitle: "Paraşüt alış faturaları.", search: "Fatura veya tedarikçi ara", filters: { archived: false }, columns: [{ key: "invoice_no", label: "Fatura No" }, { key: "partyName", label: "Tedarikçi" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "due_date", label: "Vade", kind: "date" }, { key: "gross_total", label: "Tutar", kind: "money", currencyKey: "currency" }, { key: "payment_status", label: "Durum", kind: "status" }] },
  expenses: { resource: "bank_fees", breadcrumb: "Muhasebe ve Finans / Gider Yönetimi / Gider Listesi", title: "Gider Listesi", subtitle: "Paraşüt banka masrafları ve gider kayıtları.", search: "Gider açıklaması ara", filters: { archived: false }, columns: [{ key: "description", label: "Açıklama" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "due_date", label: "Vade", kind: "date" }, { key: "net_total", label: "Net Tutar", kind: "money", currencyKey: "currency" }, { key: "remaining", label: "Kalan", kind: "money", currencyKey: "currency" }] },
  accounts: { resource: "accounts", breadcrumb: "Muhasebe ve Finans / Kasa / Kasa ve Bankalar", title: "Kasa ve Bankalar", subtitle: "Paraşüt kasa ve banka hesapları.", search: "Hesap adı, banka veya IBAN ara", filters: { archived: false }, columns: [{ key: "name", label: "Hesap" }, { key: "account_type", label: "Tür" }, { key: "bank_name", label: "Banka" }, { key: "iban", label: "IBAN" }, { key: "balance", label: "Bakiye", kind: "money", currencyKey: "currency" }] },
  products: { resource: "products", breadcrumb: "Muhasebe ve Finans / Stok Yönetimi / Hizmet ve Ürünler", title: "Hizmet ve Ürünler", subtitle: "Paraşüt ürün ve hizmet kartları.", search: "Ad, kod veya barkod ara", filters: { archived: false }, columns: [{ key: "name", label: "Ürün / Hizmet" }, { key: "code", label: "Kod" }, { key: "unit", label: "Birim" }, { key: "stock_count", label: "Stok" }, { key: "list_price", label: "Satış Fiyatı", kind: "money", currencyKey: "currency" }] },
  stockHistory: { resource: "stock_movements", breadcrumb: "Muhasebe ve Finans / Stok Yönetimi / Stok Geçmişi", title: "Stok Geçmişi", subtitle: "Paraşüt stok hareketleri.", search: "Ürün veya depo Paraşüt kimliği ara", filters: { archived: false }, columns: [{ key: "product_parasut_id", label: "Ürün Paraşüt ID" }, { key: "warehouse_parasut_id", label: "Depo Paraşüt ID" }, { key: "date", label: "Tarih", kind: "date" }, { key: "quantity", label: "Miktar" }] },
  inventory: { resource: "inventory_levels", breadcrumb: "Muhasebe ve Finans / Stok Yönetimi / Stoktaki Ürünler", title: "Stoktaki Ürünler", subtitle: "Paraşüt güncel stok seviyeleri.", search: "Ürün veya depo Paraşüt kimliği ara", filters: { archived: false }, columns: [{ key: "product_parasut_id", label: "Ürün Paraşüt ID" }, { key: "warehouse_parasut_id", label: "Depo Paraşüt ID" }, { key: "stock_count", label: "Mevcut" }, { key: "critical_stock_count", label: "Kritik Seviye" }] },
  shipments: { resource: "shipment_documents", breadcrumb: "Muhasebe ve Finans / Stok Yönetimi / İrsaliyeler", title: "İrsaliyeler", subtitle: "Paraşüt sevk ve irsaliye belgeleri.", search: "Belge no, açıklama veya şehir ara", filters: { archived: false }, columns: [{ key: "invoice_no", label: "Belge No" }, { key: "description", label: "Açıklama" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "shipment_date", label: "Sevk", kind: "datetime" }, { key: "inflow", label: "Giriş", kind: "boolean" }] },
  offers: { resource: "sales_offers", breadcrumb: "Satış / Teklifler", title: "Teklifler", subtitle: "Paraşüt satış teklifleri.", search: "Teklif veya durum ara", filters: { archived: false }, columns: [{ key: "content", label: "Teklif" }, { key: "status", label: "Durum", kind: "status" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "gross_total", label: "Toplam", kind: "money", currencyKey: "currency" }] },
  employees: { resource: "employees", breadcrumb: "İnsan Kaynakları / Çalışanlar", title: "Çalışanlar", subtitle: "Paraşüt çalışan kayıtları.", search: "Ad, e-posta veya IBAN ara", filters: { archived: false }, columns: [{ key: "name", label: "Ad" }, { key: "email", label: "E-posta" }, { key: "iban", label: "IBAN" }, { key: "trl_balance", label: "TL Bakiye", kind: "money" }] },
  salaries: { resource: "salaries", breadcrumb: "İnsan Kaynakları / Maaşlar", title: "Maaşlar", subtitle: "Paraşüt maaş kayıtları.", search: "Açıklama veya çalışan Paraşüt kimliği ara", filters: { archived: false }, columns: [{ key: "description", label: "Açıklama" }, { key: "employee_parasut_id", label: "Çalışan Paraşüt ID" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "net_total", label: "Net", kind: "money", currencyKey: "currency" }, { key: "remaining", label: "Kalan", kind: "money", currencyKey: "currency" }] },
  eInvoices: { resource: "e_invoices", breadcrumb: "E-Belgeler / E-Faturalar", title: "E-Faturalar", subtitle: "Paraşüt gelen ve giden e-fatura kayıtları.", search: "Belge, cari veya VKN ara", filters: { archived: false }, columns: [{ key: "external_id", label: "Belge No" }, { key: "contact_name", label: "Cari" }, { key: "direction", label: "Yön" }, { key: "status", label: "Durum", kind: "status" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "net_total", label: "Net", kind: "money", currencyKey: "currency" }] },
};

function cell(row: GenericParasutRow & Partial<InvoiceListRow>, column: Column) {
  if (column.key === "partyName") return row.partyName ?? "—";
  if (column.key === "source_archived") return row.source_archived ? "Arşivlendi" : "Aktif";
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

export function CanonicalParasutListPage({ config }: { config: PageConfig }) {
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

  return <div className="income-page" data-provider="parasut">
    <header className="income-page-head"><div><FinanceBreadcrumb value={config.breadcrumb} /><h1>{config.title}</h1><p>{config.subtitle}</p></div><div>{config.actionLabel ? <Button className="income-primary" disabled title="Henüz kullanıma açık değil">{config.actionLabel}</Button> : null}<SyncButton config={config} /></div></header>
    <div className="ebru-card income-filters">
      {config.filterMode === "invoice" ? <><label>Başlangıç Tarihi<Input type="date" value={dueFrom} onChange={(event) => setDueFrom(event.target.value)} /></label><label>Bitiş Tarihi<Input type="date" value={dueTo} onChange={(event) => setDueTo(event.target.value)} /></label><label>Durum<select value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Tümü</option><option value="paid">Ödendi</option><option value="overdue">Gecikmiş</option><option value="unpaid">Ödenmedi</option></select></label></> : null}
      <label className="income-search"><Search /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={config.search} /></label>
      <Button className="income-filter-button" onClick={() => go(1)}>Filtrele</Button>
      <Button variant="ghost" className="income-clear" onClick={() => { setSearch(""); setDueFrom(""); setDueTo(""); setStatus(""); setParams({}); }}>Filtreleri Temizle</Button>
    </div>
    <section className="ebru-card income-table-card"><div className="income-table-scroll"><table><thead><tr>{config.columns.map((column) => <th key={column.key}>{column.label} ↕</th>)}<th>İşlemler</th></tr></thead><tbody>
      {query.isLoading ? <tr><td colSpan={config.columns.length + 1} className="income-state">Yükleniyor…</td></tr>
        : query.isError ? <tr><td colSpan={config.columns.length + 1} className="income-state income-state-error">Veriler yüklenemedi: {query.error instanceof Error ? query.error.message : "Beklenmeyen hata"}</td></tr>
        : !query.data?.rows.length ? <tr><td colSpan={config.columns.length + 1} className="income-state">Gösterilecek kayıt bulunamadı.</td></tr>
        : query.data.rows.map((row) => <tr key={row.id}>{config.columns.map((column) => <td key={column.key}>{column.kind === "status" ? <span className={`income-status ${cell(row, column) === "Aktif" ? "success" : "info"}`}>{cell(row, column)}</span> : cell(row, column)}</td>)}<td><button className="income-row-actions" title="Görüntüle"><MoreHorizontal /></button></td></tr>)}
    </tbody></table></div>
      <div className="income-pagination"><span>{query.data?.total ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, query.data.total)} / ${query.data.total}` : "0 kayıt"}</span><label>Sayfa boyutu <select value={pageSize} onChange={(event) => { const next = new URLSearchParams(params); next.set("pageSize", event.target.value); next.set("page", "1"); setParams(next); }}><option>10</option><option>25</option><option>50</option></select></label><button disabled={page <= 1} onClick={() => go(page - 1)}>‹</button><button className="active">{page}</button><button disabled={page >= totalPages} onClick={() => go(page + 1)}>›</button></div>
    </section>
  </div>;
}

export function CanonicalFinanceReportPage({ kind }: { kind: "collections" | "payments" | "incomeExpense" | "vat" | "cash" }) {
  const query = useParasutReports();
  const title = { collections: "Tahsilat Raporu", payments: "Ödemeler Raporu", incomeExpense: "Gelir-Gider Raporu", vat: "KDV Raporu", cash: "Kasa / Banka Raporu" }[kind];
  if (query.isLoading) return <div className="income-page"><div className="ebru-card income-state">Yükleniyor…</div></div>;
  if (query.isError) return <div className="income-page"><div className="ebru-card income-state income-state-error">Veriler yüklenemedi: {query.error instanceof Error ? query.error.message : "Beklenmeyen hata"}</div></div>;
  const data = query.data;
  const rows = kind === "collections" ? data?.collectionSummary : kind === "payments" ? data?.paymentSummary : kind === "cash" ? data?.customerBalances : data?.salesSummary;
  return <div className="income-page" data-provider="parasut"><header className="income-page-head"><div><FinanceBreadcrumb value={`Muhasebe ve Finans / Raporlar / ${title}`} /><h1>{title}</h1><p>Gerçek Paraşüt ayna verilerinden oluşturulur.</p></div></header><section className="ebru-card income-table-card"><div className="income-table-scroll"><table><thead><tr><th>Para Birimi / Kayıt</th><th>Adet</th><th>Tutar</th></tr></thead><tbody>{!rows?.length ? <tr><td colSpan={3} className="income-state">Rapor için kullanılabilir kayıt bulunamadı.</td></tr> : rows.map((row, index) => { const item = row as Record<string, unknown>; return <tr key={index}><td>{String(item.currency ?? (item.attributes as Record<string, unknown> | undefined)?.name ?? "—")}</td><td>{String(item.count ?? "—")}</td><td>{formatParasutCurrency((item.total ?? item.gross ?? (item.attributes as Record<string, unknown> | undefined)?.trl_balance) as string | null, String(item.currency ?? "TRL"))}</td></tr>; })}</tbody></table></div></section></div>;
}
