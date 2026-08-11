import { useEffect, useState } from "react";
import { Eye, Mail, MapPin, MessageCircle, Pencil, Phone, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/finance/financeLabels";
import { CrmPageHeader, StatusBadge } from "./CrmShared";
import { PartyLedgerEntryDialog } from "../finance/PartyLedgerEntryDialog";

const parent = "/apps/crm/customers";

type ContactRecord = {
  parasut_id?: unknown;
  attributes?: Record<string, unknown> | null;
};

type DocumentRow = {
  parasut_id?: unknown;
  attributes?: Record<string, unknown> | null;
};

type DetailResponse = {
  contact?: ContactRecord | null;
  recentDocuments?: DocumentRow[] | null;
} | null;

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

function numericBalance(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function invoiceAmount(value: unknown, currencyValue: unknown) {
  const currency = sourceText(currencyValue).toUpperCase().replace(/^TRL$/, "TRY");
  const amount =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(amount) || !currency) return "—";
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

export function CustomerDetailPage({ customerId }: { customerId?: string }) {
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<ContactRecord | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    if (!customerId) {
      setLoading(false);
      setContact(null);
      setDocuments([]);
      return;
    }
    setLoading(true);
    supabase.functions
      .invoke("parasut-api", {
        body: { action: "detail", resource: "customers", parasutId: customerId },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        const response = data as DetailResponse;
        if (error || !response || !response.contact) {
          setContact(null);
          setDocuments([]);
        } else {
          setContact(response.contact);
          setDocuments(Array.isArray(response.recentDocuments) ? response.recentDocuments : []);
        }
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setContact(null);
        setDocuments([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

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
  const balanceValue = numericBalance(attributes.trl_balance);
  const balance = balanceValue === null ? "—" : formatMoney(balanceValue);
  const phone = sourceText(attributes.phone);
  const whatsapp = sourceText(attributes.whatsapp) || phone;

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
          <span>
            <MapPin />
            {displayAddress(attributes)}
          </span>
        </div>
      </article>
      <section className="crm-kpis detail">
        {[
          ["Toplam Alacak", "—"],
          ["Tahsil Edilen", "—"],
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
      <InvoiceHistory documents={documents} />
    </div>
  );
}

function InvoiceHistory({ documents }: { documents: DocumentRow[] }) {
  return (
    <section className="crm-history">
      <h2>Fatura Geçmişi</h2>
      <div className="erp-card crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              {["Belge No", "Tarih", "Vade Tarihi", "Tutar", "Durum", "İşlemler"].map((h) => (
                <th key={h}>{h}</th>
              ))}
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
