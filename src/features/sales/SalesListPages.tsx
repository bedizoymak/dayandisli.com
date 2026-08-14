import { useEffect, useMemo, useState } from "react";
import {
  Eye,
  FileDown,
  MoreHorizontal,
  Pencil,
  Search,
  ShoppingCart,
  Trash2,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  FinanceExportMenu,
  type ExportColumn,
} from "../finance/FinanceNavigationTools";
import { salesActivities, salesOrders } from "./salesData";
import { SalesHeader, SalesStatus } from "./SalesShared";
import { customerName } from "./salesUtils";
import { useToast } from "@/hooks/use-toast";
import { deleteQuote, fetchQuoteWithLines, fetchQuotes } from "./quotesApi";
import { openQuotePdfPlaceholder, writeQuotePdfToWindow } from "./pdf/quotePdfHtml";
import { effectiveQuoteStatus, QUOTE_ISSUERS, QUOTE_STATUS_LABELS, type QuoteRow, type QuoteStatus } from "./quoteTypes";
const root = "/apps/sales";
const quoteColumns: ExportColumn<QuoteRow>[] = [
  { header: "Teklif No", value: (r) => r.quote_no },
  { header: "Firma", value: (r) => QUOTE_ISSUERS[r.issuer].legalName },
  { header: "Müşteri", value: (r) => r.customer_name },
  { header: "Konu", value: (r) => r.subject },
  { header: "Toplam", value: (r) => `${r.grand_total.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} ${r.currency}` },
  { header: "Durum", value: (r) => QUOTE_STATUS_LABELS[effectiveQuoteStatus(r)] },
  { header: "Oluşturulma Tarihi", value: (r) => r.issue_date },
  { header: "Geçerlilik Tarihi", value: (r) => r.valid_until ?? "—" },
];
export function QuotesPage() {
  const { toast } = useToast();
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<QuoteStatus | "">("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchQuotes().then((result) => {
      if (cancelled) return;
      if (result.ok) setQuotes(result.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("tr-TR");
    return quotes.filter((q) => {
      if (statusFilter && effectiveQuoteStatus(q) !== statusFilter) return false;
      if (!term) return true;
      const haystack = `${q.quote_no} ${q.customer_name} ${q.subject}`.toLocaleLowerCase("tr-TR");
      return haystack.includes(term);
    });
  }, [quotes, search, statusFilter]);

  async function downloadPdf(quote: QuoteRow) {
    // Popup blockers only allow window.open() when it runs synchronously
    // inside the click handler — so the window opens here, first, before
    // any `await`, and is written to only once the lines have loaded.
    const win = openQuotePdfPlaceholder();
    if (!win) {
      toast({
        title: "Popup engellendi",
        description: "Tarayıcınız açılır pencereyi engelledi. Lütfen bu site için popup iznini açıp tekrar deneyin.",
        variant: "destructive",
      });
      return;
    }
    setDownloadingId(quote.id);
    const result = await fetchQuoteWithLines(quote.id);
    setDownloadingId(null);
    if (result.ok === false) {
      win.close();
      toast({ title: "Hata", description: result.message, variant: "destructive" });
      return;
    }
    writeQuotePdfToWindow(win, result.data.quote, result.data.lines);
  }

  async function handleDelete(quote: QuoteRow) {
    if (!window.confirm(`${quote.quote_no} numaralı teklif kalıcı olarak silinecek. Devam etmek istiyor musunuz?`)) return;
    setDeletingId(quote.id);
    const result = await deleteQuote(quote.id);
    setDeletingId(null);
    if (result.ok === false) {
      toast({ title: "Hata", description: result.message, variant: "destructive" });
      return;
    }
    setQuotes((current) => current.filter((q) => q.id !== quote.id));
    toast({ title: "Silindi", description: `${quote.quote_no} kalıcı olarak silindi.` });
  }

  return (
    <div className="sales-page">
      <SalesHeader
        section="Teklifler"
        title="Teklifler"
        subtitle="Müşterilere hazırlanan teklifleri görüntüleyin, indirin ve siparişe dönüştürün."
      >
        <FinanceExportMenu
          title="Teklifler"
          filename="teklifler"
          rows={filtered}
          columns={quoteColumns}
        />
        <Link className="sales-primary" to={`${root}/quotes/new`}>
          Yeni Teklif Oluştur
        </Link>
      </SalesHeader>
      <div className="erp-card sales-filters">
        <label className="search">
          <Search />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Teklif no, müşteri, konu ara" />
        </label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as QuoteStatus | "")}>
          <option value="">Tüm Durumlar</option>
          {(Object.keys(QUOTE_STATUS_LABELS) as QuoteStatus[]).map((key) => (
            <option key={key} value={key}>
              {QUOTE_STATUS_LABELS[key]}
            </option>
          ))}
        </select>
        <button type="button" onClick={() => { setSearch(""); setStatusFilter(""); }}>
          Filtreleri Temizle
        </button>
      </div>
      <Table
        headers={[
          "Teklif No",
          "Firma",
          "Müşteri",
          "Konu",
          "Toplam",
          "Durum",
          "Oluşturulma Tarihi",
          "Geçerlilik Tarihi",
          "İşlemler",
        ]}
      >
        {loading ? (
          <tr>
            <td colSpan={9}>Yükleniyor…</td>
          </tr>
        ) : filtered.length === 0 ? (
          <tr>
            <td colSpan={9}>Kayıtlı teklif bulunamadı.</td>
          </tr>
        ) : (
          filtered.map((q) => {
            const customerLink =
              q.customer_source === "parasut" && q.parasut_customer_id
                ? `/apps/crm/customers/${q.parasut_customer_id}`
                : q.local_customer_id
                  ? `${root}/quote-customers/${q.local_customer_id}`
                  : null;
            return (
              <tr key={q.id}>
                <td>
                  <Link to={`${root}/quotes/${q.id}`}>{q.quote_no}</Link>
                </td>
                <td>{QUOTE_ISSUERS[q.issuer].legalName}</td>
                <td>
                  {customerLink ? (
                    <Link className="sales-customer-link" to={customerLink}>
                      {q.customer_name}
                    </Link>
                  ) : (
                    q.customer_name
                  )}
                </td>
                <td>{q.subject}</td>
                <td>
                  {q.grand_total.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} {q.currency}
                </td>
                <td>
                  <SalesStatus>{QUOTE_STATUS_LABELS[effectiveQuoteStatus(q)]}</SalesStatus>
                </td>
                <td>{q.issue_date}</td>
                <td>{q.valid_until ?? "—"}</td>
                <td>
                  <div className="sales-row-actions">
                    <Link title="Görüntüle" to={`${root}/quotes/${q.id}`}>
                      <Eye />
                    </Link>
                    <Link title="Düzenle" to={`${root}/quotes/${q.id}/edit`}>
                      <Pencil />
                    </Link>
                    <button title="Yazdır / PDF Kaydet" disabled={downloadingId === q.id} onClick={() => downloadPdf(q)}>
                      <FileDown />
                    </button>
                    <Link title="Siparişe Dönüştür" to={`${root}/orders/new?sourceQuoteId=${q.id}`}>
                      <ShoppingCart />
                    </Link>
                    <button title="Sil" disabled={deletingId === q.id} onClick={() => handleDelete(q)}>
                      <Trash2 />
                    </button>
                    <Link title="Kopyala" to={`${root}/quotes/new?duplicateOf=${q.id}`}>
                      <MoreHorizontal />
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })
        )}
      </Table>
    </div>
  );
}
function Filters({ activity = false }: { activity?: boolean }) {
  return (
    <div className="erp-card sales-filters">
      <label className="search">
        <Search />
        <input />
      </label>
      <select>
        <option>{activity ? "Tüm Müşteriler" : "Tüm Firmalar"}</option>
      </select>
      <select>
        <option>{activity ? "Tüm Aktivite Türleri" : "Tüm Durumlar"}</option>
      </select>
      <label>
        Başlangıç
        <input type="date" />
      </label>
      <label>
        Bitiş
        <input type="date" />
      </label>
      <button>Filtreleri Temizle</button>
    </div>
  );
}
function Table({
  headers,
  children,
}: {
  headers: string[];
  children: React.ReactNode;
}) {
  return (
    <div className="erp-card sales-table-wrap">
      <table className="sales-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
      <footer>
        <span>—</span>
        <button disabled>Önceki</button>
        <button disabled>Sonraki</button>
      </footer>
    </div>
  );
}
const orderColumns: ExportColumn<(typeof salesOrders)[number]>[] = [
  { header: "Sipariş No", value: (r) => r.no },
  { header: "Müşteri", value: (r) => customerName(r.customerId) },
  { header: "Kaynak Teklif", value: (r) => r.sourceQuoteNo ?? "—" },
  { header: "Proje", value: (r) => r.project },
  { header: "Sipariş Tarihi", value: (r) => r.orderDate },
  { header: "Termin Tarihi", value: (r) => r.dueDate },
  { header: "Toplam", value: (r) => r.total },
  { header: "Durum", value: (r) => r.status },
];
export function SalesOrdersPage() {
  return (
    <div className="sales-page">
      <SalesHeader
        section="Siparişler"
        title="Siparişler"
        subtitle="Tekliflerden veya manuel olarak oluşturulan müşteri siparişlerini yönetin."
      >
        <FinanceExportMenu
          title="Siparişler"
          filename="satis-siparisleri"
          rows={salesOrders}
          columns={orderColumns}
        />
        <Link className="sales-primary" to={`${root}/orders/new`}>
          Yeni Sipariş
        </Link>
      </SalesHeader>
      <Filters />
      <Table headers={orderColumns.map((c) => c.header).concat("İşlemler")}>
        {salesOrders.map((o) => (
          <tr key={o.id}>
            {orderColumns.map((c) =>
              c.header === "Sipariş No" ? (
                <td key={c.header}>
                  <Link to={`${root}/orders/${o.id}`}>{c.value(o)}</Link>
                </td>
              ) : (
                <td key={c.header}>{c.value(o)}</td>
              ),
            )}
            <td>
              <div className="sales-row-actions">
                <Link title="Görüntüle" to={`${root}/orders/${o.id}`}>
                  <Eye />
                </Link>
                <button title="Düzenle · Fatura Oluştur · Üretime Aktar · İndir">
                  <MoreHorizontal />
                </button>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
export function SalesActivitiesPage() {
  return (
    <div className="sales-page">
      <SalesHeader section="Satış Faaliyetleri" title="Satış Faaliyetleri" />
      <Filters activity />
      <Table
        headers={[
          "Tarih",
          "Aktivite Türü",
          "Müşteri",
          "Teklif / Sipariş",
          "Açıklama",
          "Sorumlu",
          "Durum",
          "İşlemler",
        ]}
      >
        {salesActivities.map((a) => (
          <tr key={a.id}>
            <td>{a.date}</td>
            <td>{a.type}</td>
            <td>
              <Link
                className="sales-customer-link"
                to={`/apps/crm/customers/${a.customerId}`}
              >
                {customerName(a.customerId)}
              </Link>
            </td>
            <td>{a.relation}</td>
            <td>{a.description}</td>
            <td>{a.owner}</td>
            <td>
              <SalesStatus>{a.status}</SalesStatus>
            </td>
            <td>
              <button>
                <MoreHorizontal />
              </button>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
