import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { FinanceBreadcrumb } from "./FinanceNavigationTools";
import { useParasutList, useParasutReports } from "@/features/erp/parasut/api/queries";
import type {
  GenericParasutRow,
  InvoiceListRow,
  ListQueryParams,
  ParasutListResource,
} from "@/features/erp/parasut/types";
import { formatParasutCurrency, formatParasutDate, formatParasutDateTime } from "@/features/erp/parasut/utils/format";

type Column = { key: string; label: string; kind?: "date" | "datetime" | "money" | "status" | "boolean"; currencyKey?: string };
type PageConfig = {
  resource: ParasutListResource;
  breadcrumb: string;
  title: string;
  subtitle: string;
  search: string;
  columns: Column[];
  filters?: ListQueryParams["filters"];
};

export const canonicalParasutPages: Record<string, PageConfig> = {
  invoices: { resource: "sales_invoices", breadcrumb: "Muhasebe ve Finans / Gelir Yönetimi / Faturalar", title: "Faturalar", subtitle: "Paraşüt satış faturaları.", search: "Fatura veya müşteri ara", filters: { archived: false }, columns: [{ key: "invoice_no", label: "Fatura No" }, { key: "partyName", label: "Müşteri" }, { key: "issue_date", label: "Fatura Tarihi", kind: "date" }, { key: "due_date", label: "Vade Tarihi", kind: "date" }, { key: "gross_total", label: "Tutar", kind: "money", currencyKey: "currency" }, { key: "payment_status", label: "Durum", kind: "status" }] },
  customers: { resource: "customers", breadcrumb: "Muhasebe ve Finans / Gelir Yönetimi / Müşteriler", title: "Müşteriler", subtitle: "Paraşüt müşteri hesapları.", search: "Ad, e-posta veya VKN / TCKN ara", filters: { archived: false }, columns: [{ key: "name", label: "Müşteri Adı" }, { key: "tax_number", label: "VKN / TCKN" }, { key: "email", label: "E-posta" }, { key: "phone", label: "Telefon" }, { key: "trl_balance", label: "Bakiye", kind: "money" }, { key: "source_archived", label: "Durum", kind: "status" }] },
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
  const value = row.attributes[column.key];
  if (column.kind === "date") return formatParasutDate(value as string | null);
  if (column.kind === "datetime") return formatParasutDateTime(value as string | null);
  if (column.kind === "money") return formatParasutCurrency(value as string | number | null, column.currencyKey ? String(row.attributes[column.currencyKey] ?? "TRL") : "TRL");
  if (column.kind === "boolean") return value === true ? "Evet" : value === false ? "Hayır" : "—";
  return String(value ?? "—");
}

export function CanonicalParasutListPage({ config }: { config: PageConfig }) {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const page = Math.max(1, Number(params.get("page") ?? 1));
  const pageSize = 25;
  const queryParams = useMemo(() => ({ page, pageSize, search, filters: config.filters }), [page, search, config.filters]);
  const query = useParasutList<GenericParasutRow & Partial<InvoiceListRow>>(config.resource, queryParams);
  const totalPages = Math.max(1, Math.ceil((query.data?.total ?? 0) / pageSize));
  const go = (nextPage: number) => setParams((current) => {
    const next = new URLSearchParams(current);
    next.set("page", String(nextPage));
    if (search) next.set("q", search); else next.delete("q");
    return next;
  });

  return <div className="income-page" data-provider="parasut">
    <header className="income-page-head"><div><FinanceBreadcrumb value={config.breadcrumb} /><h1>{config.title}</h1><p>{config.subtitle}</p></div></header>
    <div className="ebru-card income-filters">
      <label className="income-search"><Search /><input value={search} onChange={(event) => { setSearch(event.target.value); go(1); }} placeholder={config.search} /></label>
      <button className="income-clear" onClick={() => { setSearch(""); setParams({}); }}>Filtreleri Temizle</button>
    </div>
    <section className="ebru-card income-table-card"><div className="income-table-scroll"><table><thead><tr>{config.columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr></thead><tbody>
      {query.isLoading ? <tr><td colSpan={config.columns.length} className="income-state">Yükleniyor…</td></tr>
        : query.isError ? <tr><td colSpan={config.columns.length} className="income-state income-state-error">Veriler yüklenemedi: {query.error instanceof Error ? query.error.message : "Beklenmeyen hata"}</td></tr>
        : !query.data?.rows.length ? <tr><td colSpan={config.columns.length} className="income-state">Gösterilecek Paraşüt kaydı bulunamadı.</td></tr>
        : query.data.rows.map((row) => <tr key={row.id}>{config.columns.map((column) => <td key={column.key}>{column.kind === "status" ? <span className="income-status info">{cell(row, column)}</span> : cell(row, column)}</td>)}</tr>)}
    </tbody></table></div>
      <div className="income-pagination"><span>Toplam {query.data?.total ?? 0} kayıt · Sayfa {page} / {totalPages}</span><button disabled={page <= 1} onClick={() => go(page - 1)}>‹</button><button disabled={page >= totalPages} onClick={() => go(page + 1)}>›</button></div>
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
