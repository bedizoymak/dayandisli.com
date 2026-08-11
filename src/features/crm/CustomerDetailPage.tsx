import { useEffect, useMemo, useState } from "react";
import { Eye, Mail, MapPin, MessageCircle, Pencil, Phone, Printer, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/finance/financeLabels";
import { CrmPageHeader, StatusBadge } from "./CrmShared";
import { PartyLedgerEntryDialog } from "../finance/PartyLedgerEntryDialog";

const parent = "/apps/crm/customers";
// Must match the `limit(300)` guard rail on the detail action's document
// fetch in supabase/functions/parasut-api/handlers.ts — if we receive
// exactly this many rows, older history may exist beyond the cap and the
// statement must say so instead of silently presenting an incomplete total.
const DOCUMENT_FETCH_CAP = 300;

type ContactRecord = {
  parasut_id?: unknown;
  attributes?: Record<string, unknown> | null;
};

type DocumentRow = {
  parasut_id?: unknown;
  attributes?: Record<string, unknown> | null;
  relationships?: { payments?: { data?: { id?: unknown }[] | { id?: unknown } | null } | null } | null;
};

type PaymentRow = {
  parasut_id?: unknown;
  attributes?: Record<string, unknown> | null;
};

type DetailResponse = {
  contact?: ContactRecord | null;
  recentDocuments?: DocumentRow[] | null;
  payments?: PaymentRow[] | null;
} | null;

type OfferApiRow = {
  parasut_id?: unknown;
  attributes?: Record<string, unknown> | null;
};

function sourceText(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function displayText(value: unknown) {
  const text = sourceText(value);
  return text || "—";
}

function displayCustomerType(value: unknown) {
  if (value === "company") return "Tüzel Kişi";
  if (value === "person") return "Gerçek Kişi";
  return "—";
}

function numericValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function invoiceAmount(value: unknown, currencyValue: unknown) {
  const currency = sourceText(currencyValue).toUpperCase().replace(/^TRL$/, "TRY");
  const amount = numericValue(value);
  if (amount === null || !currency) return "—";
  try {
    return formatMoney(amount, currency);
  } catch {
    return "—";
  }
}

function collectionLabel(value: unknown) {
  const status = sourceText(value);
  return (
    {
      paid: "Tahsil Edildi",
      partially_paid: "Kısmen Tahsil Edildi",
      overdue: "Gecikmiş",
      unpaid: "Tahsil Edilecek",
    }[status] ?? status
  ) || "—";
}

function displayAddress(attributes: Record<string, unknown>) {
  const parts = [attributes.address, attributes.district, attributes.city]
    .map(sourceText)
    .filter(Boolean);
  return parts.length ? parts.join(", ") : "—";
}

function documentPaymentIds(document: DocumentRow): string[] {
  const ref = document.relationships?.payments?.data;
  if (!ref) return [];
  const list = Array.isArray(ref) ? ref : [ref];
  return list.map((item) => sourceText(item?.id)).filter(Boolean);
}

type LedgerRow = {
  key: string;
  date: string;
  type: string;
  debit: number;
  credit: number;
  description: string;
};

export function CustomerDetailPage({ customerId }: { customerId?: string }) {
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<ContactRecord | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [offers, setOffers] = useState<OfferApiRow[]>([]);
  const [invoiceSort, setInvoiceSort] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    let cancelled = false;
    if (!customerId) {
      setLoading(false);
      setContact(null);
      setDocuments([]);
      setPayments([]);
      setOffers([]);
      return;
    }
    setLoading(true);
    Promise.all([
      supabase.functions.invoke("parasut-api", {
        body: { action: "detail", resource: "customers", parasutId: customerId },
      }),
      supabase.functions.invoke("parasut-api", {
        body: { action: "list", resource: "sales_offers", pageSize: 100 },
      }),
    ])
      .then(([detailResult, offersResult]) => {
        if (cancelled) return;
        const response = detailResult.data as DetailResponse;
        if (detailResult.error || !response || !response.contact) {
          setContact(null);
          setDocuments([]);
          setPayments([]);
        } else {
          setContact(response.contact);
          setDocuments(Array.isArray(response.recentDocuments) ? response.recentDocuments : []);
          setPayments(Array.isArray(response.payments) ? response.payments : []);
        }
        const offersResponse = offersResult.data as { rows?: unknown } | null;
        if (!offersResult.error && offersResponse && Array.isArray(offersResponse.rows)) {
          setOffers(
            (offersResponse.rows as OfferApiRow[]).filter(
              (row) => sourceText(row.attributes?.contact_parasut_id) === customerId,
            ),
          );
        } else {
          setOffers([]);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setContact(null);
        setDocuments([]);
        setPayments([]);
        setOffers([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const documentByPaymentId = useMemo(() => {
    const map = new Map<string, DocumentRow>();
    for (const document of documents) {
      for (const paymentId of documentPaymentIds(document)) {
        map.set(paymentId, document);
      }
    }
    return map;
  }, [documents]);

  const ledgerRows = useMemo<LedgerRow[]>(() => {
    // Only invoices Paraşüt itself counts toward the contact's balance
    // (append_contact_balance !== false) and that are not cancelled feed the
    // statement — otherwise the running balance can never match trl_balance,
    // since Paraşüt's own contact balance excludes those by the same rule.
    const balanceDocuments = documents.filter((document) => {
      const attributes = document.attributes ?? {};
      if (attributes.append_contact_balance === false) return false;
      if (sourceText(attributes.item_type) === "cancelled") return false;
      return true;
    });
    const debitRows: LedgerRow[] = balanceDocuments.map((document) => {
      const attributes = document.attributes ?? {};
      const rawAmount = numericValue(attributes.gross_total) ?? 0;
      const currency = sourceText(attributes.currency).toUpperCase();
      const rate = numericValue(attributes.exchange_rate);
      // gross_total is in the invoice's own currency; convert to TRY using
      // Paraşüt's own recorded exchange_rate so foreign-currency invoices
      // don't silently understate/overstate the TRY-denominated balance.
      const amount = currency && currency !== "TRY" && currency !== "TRL" && rate && rate > 0 ? rawAmount * rate : rawAmount;
      return {
        key: `invoice-${sourceText(document.parasut_id)}`,
        date: sourceText(attributes.issue_date),
        type: "Satış Faturası",
        debit: amount,
        credit: 0,
        description: displayText(attributes.invoice_no),
      };
    });
    const creditRows: LedgerRow[] = payments.map((payment) => {
      const attributes = payment.attributes ?? {};
      const amount = numericValue(attributes.amount) ?? 0;
      const parentDocument = documentByPaymentId.get(sourceText(payment.parasut_id));
      const reference = displayText(parentDocument?.attributes?.invoice_no);
      const notes = sourceText(attributes.notes);
      return {
        key: `payment-${sourceText(payment.parasut_id)}`,
        date: sourceText(attributes.date),
        type: "Tahsilat",
        debit: 0,
        credit: amount,
        description: notes || reference,
      };
    });
    return [...debitRows, ...creditRows]
      .filter((row) => row.date)
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [documents, payments, documentByPaymentId]);

  const ledgerWithBalance = useMemo(() => {
    let running = 0;
    return ledgerRows.map((row) => {
      running += row.debit - row.credit;
      return { ...row, balance: running };
    });
  }, [ledgerRows]);

  const totalDebit = ledgerRows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = ledgerRows.reduce((sum, row) => sum + row.credit, 0);
  const totalBalance = totalDebit - totalCredit;

  const collectedTotal = payments.reduce((sum, payment) => sum + (numericValue(payment.attributes?.amount) ?? 0), 0);

  const sortedDocuments = useMemo(() => {
    return [...documents].sort((a, b) => {
      const dateA = sourceText(a.attributes?.issue_date);
      const dateB = sourceText(b.attributes?.issue_date);
      const comparison = dateA.localeCompare(dateB);
      return invoiceSort === "asc" ? comparison : -comparison;
    });
  }, [documents, invoiceSort]);

  if (loading) {
    return (
      <div className="crm-page">
        <CrmPageHeader current="Müşteri Detayı" title="Yükleniyor…" />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="crm-page">
        <CrmPageHeader
          current="Müşteri bulunamadı"
          title="Müşteri bulunamadı"
          subtitle={`"${customerId ?? ""}" kimlikli müşteri kaydı bulunamadı.`}
        >
          <Link className="crm-back" to={parent}>
            ← Müşteri listesine dön
          </Link>
        </CrmPageHeader>
      </div>
    );
  }

  const attributes = contact.attributes ?? {};
  const name = displayText(attributes.name);
  const code = sourceText(attributes.short_name) || sourceText(contact.parasut_id) || "—";
  const balanceValue = numericValue(attributes.trl_balance);
  const balance = balanceValue === null ? "—" : formatMoney(balanceValue);
  const phone = sourceText(attributes.phone);
  const whatsapp = sourceText(attributes.whatsapp) || phone;

  const printLedger = () => {
    const today = new Intl.DateTimeFormat("tr-TR", { dateStyle: "long" }).format(new Date());
    // A window opened via window.open("", "_blank") + document.write() stays
    // in the same browsing-context group as this tab (opener relationship),
    // which is what let window.print() inside it block this page's UI
    // thread. A Blob URL opened with the "noopener" window feature (not just
    // nulling .opener after the fact) gets its own browsing context group,
    // so the print dialog can no longer freeze this tab, and this page stays
    // on the same route the whole time.
    const html = buildLedgerPrintHtml(
      `Cari Hesap Ekstresi — ${name}`,
      `Müşteri Kodu: ${code} · Tarih: ${today}`,
      ledgerWithBalance,
      { totalDebit, totalCredit, totalBalance },
    );
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const printWindow = window.open(url, "_blank", "noopener,noreferrer");
    if (!printWindow) URL.revokeObjectURL(url);
    else setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  return (
    <div className="crm-page">
      <CrmPageHeader current="Müşteri Detayı" title={name} subtitle={displayCustomerType(attributes.contact_type)}>
        <Link className="crm-back" to={parent}>
          ← Müşterilere Dön
        </Link>
        {whatsapp && (
          <a className="crm-whatsapp" href={`https://wa.me/${whatsapp.replace(/\D/g, "")}`}>
            <MessageCircle />
            WhatsApp
          </a>
        )}
        <PartyLedgerEntryDialog
          kind="collection"
          partyLabel="Müşteri"
          partyName={name}
          trigger={
            <button type="button" className="crm-primary crm-collection-btn">
              Tahsilat Ekle
            </button>
          }
        />
        <Link className="crm-primary" to={`${parent}/${customerId}/edit`}>
          <Pencil />
          Düzenle
        </Link>
      </CrmPageHeader>
      <article className="erp-card crm-info-card">
        <div className="crm-large-avatar">
          <UserRound />
        </div>
        <div>
          <span>
            <Phone />
            {displayText(attributes.phone)}
          </span>
          <span>
            <Mail />
            {displayText(attributes.email)}
          </span>
          <span>TC/Vergi No: {displayText(attributes.tax_number)}</span>
          <span>Müşteri Kodu: {code}</span>
          <span>
            <MapPin />
            {displayAddress(attributes)}
          </span>
        </div>
      </article>
      <section className="crm-kpis detail">
        {[
          ["Toplam Borç", formatMoney(totalDebit)],
          ["Tahsil Edilen", formatMoney(collectedTotal)],
          ["Müşteri Bakiyesi", balance],
          ["Vadesi Geçen Tutar", "—"],
          ["Yaklaşan Ödeme", "—"],
        ].map((item) => (
          <article className="erp-card" key={item[0]}>
            <span>{item[0]}</span>
            <strong>{item[1]}</strong>
          </article>
        ))}
      </section>

      <InvoiceHistory
        documents={sortedDocuments}
        sort={invoiceSort}
        onToggleSort={() => setInvoiceSort((current) => (current === "asc" ? "desc" : "asc"))}
      />

      <CollectionsHistory documents={documents} payments={payments} documentByPaymentId={documentByPaymentId} />

      <section className="crm-history">
        <div className="crm-head-actions" style={{ justifyContent: "space-between", display: "flex", alignItems: "center" }}>
          <h2>Cari Hareketler</h2>
          <button type="button" className="crm-primary" onClick={printLedger}>
            <Printer />
            Yazdır / Ekstre Al
          </button>
        </div>
        {documents.length >= DOCUMENT_FETCH_CAP && (
          <div className="crm-empty">
            Bu müşteri için {DOCUMENT_FETCH_CAP}+ belge bulunuyor; ekstre yalnızca en güncel {DOCUMENT_FETCH_CAP} belgeyi kapsıyor ve toplam bakiye ile tam eşleşmeyebilir.
          </div>
        )}
        <div className="erp-card crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                {["Tarih", "İşlem Türü", "Borç", "Alacak", "KPB", "Satır Bakiyesi", "Açıklama"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ledgerWithBalance.map((row) => (
                <tr key={row.key}>
                  <td>{row.date || "—"}</td>
                  <td>{row.type}</td>
                  <td>{row.debit ? formatMoney(row.debit) : "—"}</td>
                  <td>{row.credit ? formatMoney(row.credit) : "—"}</td>
                  <td>—</td>
                  <td>{formatMoney(row.balance)}</td>
                  <td>{row.description || "—"}</td>
                </tr>
              ))}
            </tbody>
            {ledgerWithBalance.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={2}>
                    <strong>Toplam</strong>
                  </td>
                  <td>
                    <strong>{formatMoney(totalDebit)}</strong>
                  </td>
                  <td>
                    <strong>{formatMoney(totalCredit)}</strong>
                  </td>
                  <td>—</td>
                  <td>
                    <strong>{formatMoney(totalBalance)}</strong>
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
          {!ledgerWithBalance.length && (
            <div className="crm-empty">Bu müşteriye ait cari hareket bulunamadı.</div>
          )}
        </div>
      </section>

      <OfferHistory offers={offers} />
    </div>
  );
}

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character,
  );

function buildLedgerPrintHtml(
  title: string,
  subtitle: string,
  rows: { date: string; type: string; debit: number; credit: number; balance: number; description: string }[],
  totals: { totalDebit: number; totalCredit: number; totalBalance: number },
) {
  const exported = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date());
  const headers = ["Tarih", "İşlem Türü", "Borç", "Alacak", "KPB", "Satır Bakiyesi", "Açıklama"];
  const bodyRows = rows
    .map(
      (row) =>
        `<tr><td>${escapeHtml(row.date || "—")}</td><td>${escapeHtml(row.type)}</td><td>${escapeHtml(row.debit ? formatMoney(row.debit) : "—")}</td><td>${escapeHtml(row.credit ? formatMoney(row.credit) : "—")}</td><td>—</td><td>${escapeHtml(formatMoney(row.balance))}</td><td>${escapeHtml(row.description || "—")}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:12px Arial;color:#18212b;margin:30px}header{border-bottom:2px solid #173d65;margin-bottom:18px;padding-bottom:12px}h1{margin:5px 0}.meta{color:#596879}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccd5df;padding:7px;text-align:left}th{background:#e9f0f7}tfoot td{font-weight:700}footer{margin-top:24px;border-top:1px solid #ccd5df;padding-top:10px;color:#687684}.pdf-kpis{display:flex;gap:10px;margin:14px 0}.pdf-kpis article{flex:1 1 150px;border:1px solid #ccd5df;border-radius:8px;padding:10px 12px}.pdf-kpis span{display:block;color:#687684;font-size:10px;text-transform:uppercase}.pdf-kpis strong{font-size:16px}@page{size:landscape;margin:12mm}</style></head><body><header><strong>Dayan Dişli</strong><h1>${escapeHtml(title)}</h1><div class="meta">${escapeHtml(subtitle)} · Dışa aktarım: ${escapeHtml(exported)}</div></header><section class="pdf-kpis"><article><span>Toplam Borç</span><strong>${escapeHtml(formatMoney(totals.totalDebit))}</strong></article><article><span>Toplam Alacak</span><strong>${escapeHtml(formatMoney(totals.totalCredit))}</strong></article><article><span>Toplam Bakiye</span><strong>${escapeHtml(formatMoney(totals.totalBalance))}</strong></article></section><table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${bodyRows}</tbody></table><footer>© Eclipse Mühendislik</footer><script>window.onload=()=>window.print();</script></body></html>`;
}

function InvoiceHistory({
  documents,
  sort,
  onToggleSort,
}: {
  documents: DocumentRow[];
  sort: "asc" | "desc";
  onToggleSort: () => void;
}) {
  return (
    <section className="crm-history">
      <h2>Fatura Geçmişi</h2>
      <div className="erp-card crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              <th>Belge No</th>
              <th aria-sort={sort === "asc" ? "ascending" : "descending"}>
                <button
                  type="button"
                  onClick={onToggleSort}
                  aria-label="Tarihe göre sırala"
                  style={{
                    alignItems: "center",
                    background: "none",
                    border: 0,
                    color: "inherit",
                    cursor: "pointer",
                    display: "inline-flex",
                    font: "inherit",
                    gap: "0.3rem",
                    padding: 0,
                  }}
                >
                  Tarih <span aria-hidden="true">{sort === "asc" ? "↑" : "↓"}</span>
                </button>
              </th>
              <th>Vade Tarihi</th>
              <th>Tutar</th>
              <th>Durum</th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {documents.map((document) => {
              const attributes = document.attributes ?? {};
              const parasutId = sourceText(document.parasut_id);
              const no = displayText(attributes.invoice_no);
              return (
                <tr key={parasutId || no}>
                  <td>{no}</td>
                  <td>{displayText(attributes.issue_date)}</td>
                  <td>{displayText(attributes.due_date)}</td>
                  <td>{invoiceAmount(attributes.gross_total, attributes.currency)}</td>
                  <td>
                    <StatusBadge>{collectionLabel(attributes.payment_status)}</StatusBadge>
                  </td>
                  <td>
                    <Link
                      title="Görüntüle"
                      to={`/apps/finance/income/invoices/${encodeURIComponent(no)}`}
                    >
                      <Eye />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!documents.length && (
          <div className="crm-empty">Bu müşteriye ait fatura bulunamadı.</div>
        )}
      </div>
    </section>
  );
}

function CollectionsHistory({
  payments,
  documentByPaymentId,
}: {
  documents: DocumentRow[];
  payments: PaymentRow[];
  documentByPaymentId: Map<string, DocumentRow>;
}) {
  const rows = [...payments].sort((a, b) =>
    sourceText(b.attributes?.date).localeCompare(sourceText(a.attributes?.date)),
  );
  return (
    <section className="crm-history">
      <h2>Tahsilatlar</h2>
      <div className="erp-card crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              {["Tarih", "Tutar", "Yöntem/Hesap", "Referans", "Açıklama"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((payment) => {
              const attributes = payment.attributes ?? {};
              const parentDocument = documentByPaymentId.get(sourceText(payment.parasut_id));
              const reference = displayText(parentDocument?.attributes?.invoice_no);
              return (
                <tr key={sourceText(payment.parasut_id)}>
                  <td>{displayText(attributes.date)}</td>
                  <td>{invoiceAmount(attributes.amount, attributes.currency)}</td>
                  <td>—</td>
                  <td>{reference}</td>
                  <td>{displayText(attributes.notes)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && (
          <div className="crm-empty">Bu müşteriye ait tahsilat bulunamadı.</div>
        )}
      </div>
    </section>
  );
}

function OfferHistory({ offers }: { offers: OfferApiRow[] }) {
  return (
    <section className="crm-history">
      <h2>Teklif Geçmişi</h2>
      <div className="erp-card crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              {["Tarih", "İçerik", "Toplam", "Durum"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => {
              const attributes = offer.attributes ?? {};
              return (
                <tr key={sourceText(offer.parasut_id)}>
                  <td>{displayText(attributes.issue_date)}</td>
                  <td>{displayText(attributes.content) !== "—" ? displayText(attributes.content) : displayText(attributes.description)}</td>
                  <td>{invoiceAmount(attributes.gross_total, attributes.currency)}</td>
                  <td>
                    <StatusBadge>{displayText(attributes.status)}</StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!offers.length && (
          <div className="crm-empty">Bu müşteriye ait teklif bulunamadı.</div>
        )}
      </div>
    </section>
  );
}
