import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { SalesHeader, SalesStatus } from "./SalesShared";
import {
  fetchHistoryEntriesForCustomer,
  fetchLocalCustomer,
  fetchQuotesForCustomer,
} from "./quotesApi";
import { effectiveQuoteStatus, QUOTE_STATUS_LABELS, type QuoteHistoryEntryRow, type QuoteLocalCustomerRow, type QuoteRow } from "./quoteTypes";

const root = "/apps/sales";

export function QuoteCustomerDetailPage({ customerId }: { customerId?: string }) {
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<QuoteLocalCustomerRow | null>(null);
  const [quotes, setQuotes] = useState<QuoteRow[]>([]);
  const [history, setHistory] = useState<QuoteHistoryEntryRow[]>([]);

  useEffect(() => {
    if (!customerId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    Promise.all([
      fetchLocalCustomer(customerId),
      fetchQuotesForCustomer("local", customerId),
      fetchHistoryEntriesForCustomer("local", customerId),
    ]).then(([customerResult, quotesResult, historyResult]) => {
      if (cancelled) return;
      if (customerResult.ok) setCustomer(customerResult.data);
      if (quotesResult.ok) setQuotes(quotesResult.data);
      if (historyResult.ok) setHistory(historyResult.data);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  if (loading) {
    return (
      <div className="sales-page">
        <SalesHeader section="Teklifler" current="Yükleniyor…" title="Yükleniyor…" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="sales-page">
        <SalesHeader section="Teklifler" current="Müşteri bulunamadı" title="Müşteri bulunamadı" subtitle={`"${customerId ?? ""}" kimlikli yerel teklif müşterisi bulunamadı.`}>
          <Link className="sales-back" to={`${root}/quotes`}>
            ← Tekliflere Dön
          </Link>
        </SalesHeader>
      </div>
    );
  }

  return (
    <div className="sales-page">
      <SalesHeader section="Teklifler" current={customer.company_name} title={customer.company_name} subtitle="Yerel teklif müşterisi — Paraşüt'e kayıtlı değildir.">
        <Link className="sales-back" to={`${root}/quotes`}>
          ← Tekliflere Dön
        </Link>
        <Link className="sales-primary" to={`${root}/quotes/new?localCustomerId=${customer.id}`}>
          Teklif Oluştur
        </Link>
      </SalesHeader>
      <article className="erp-card sales-detail-grid" style={{ gridTemplateColumns: "1fr" }}>
        <p>
          <span>İlgili Kişi</span>
          <b>{customer.contact_name || "—"}</b>
        </p>
        <p>
          <span>Telefon</span>
          <b>{customer.phone || "—"}</b>
        </p>
        <p>
          <span>E-posta</span>
          <b>{customer.email || "—"}</b>
        </p>
        <p>
          <span>Adres</span>
          <b>{customer.address || "—"}</b>
        </p>
        <p>
          <span>Vergi No</span>
          <b>{customer.tax_no || "—"}</b>
        </p>
      </article>

      <section className="erp-card sales-detail-lines">
        <h2>Teklifler</h2>
        <table>
          <thead>
            <tr>
              <th>Teklif No</th>
              <th>Konu</th>
              <th>Toplam</th>
              <th>Durum</th>
              <th>Tarih</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id}>
                <td>
                  <Link to={`${root}/quotes/${q.id}`}>{q.quote_no}</Link>
                </td>
                <td>{q.subject}</td>
                <td>
                  {q.grand_total.toLocaleString("tr-TR")} {q.currency}
                </td>
                <td>
                  <SalesStatus>{QUOTE_STATUS_LABELS[effectiveQuoteStatus(q)]}</SalesStatus>
                </td>
                <td>{q.issue_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!quotes.length && <p>Bu müşteriye ait ERP teklifi bulunamadı.</p>}
      </section>

      <section className="erp-card sales-detail-lines">
        <h2>Geçmiş Teklifler</h2>
        <table>
          <thead>
            <tr>
              <th>Teklif No</th>
              <th>Tarih</th>
              <th>Tutar</th>
              <th>Not</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{h.quote_no || "—"}</td>
                <td>{h.quote_date || "—"}</td>
                <td>
                  {h.amount != null ? `${h.amount.toLocaleString("tr-TR")} ${h.currency ?? ""}` : "—"}
                </td>
                <td>{h.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!history.length && <p>Bu müşteriye ait eski/manuel teklif kaydı yok.</p>}
      </section>
    </div>
  );
}
