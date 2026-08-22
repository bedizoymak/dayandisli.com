import { useEffect, useMemo, useState } from "react";
import { Eye, Mail, MapPin, MessageCircle, Pencil, Phone, Printer, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/finance/financeLabels";
import { CrmPageHeader, StatusBadge } from "./CrmShared";
import { PartyLedgerEntryDialog } from "../finance/PartyLedgerEntryDialog";
import { fetchQuotesForCustomer } from "../sales/quotesApi";
import { effectiveQuoteStatus, QUOTE_STATUS_LABELS, type QuoteRow } from "../sales/quoteTypes";
import { QuoteHistoryPanel } from "../sales/QuoteHistoryPanel";
import { listAllChecks } from "../finance/checks/checksApi";
import { istanbulTodayIso } from "../finance/checks/checkDomain";
import type { CheckListRow } from "../finance/checks/types";
import {
  buildAuthoritativeLedgerRows,
  buildLedgerPrintRows,
  buildPaymentToDocumentMap,
  LEDGER_TYPE_LABELS,
  statementWarning,
  type AuthoritativeStatement,
  type LedgerRow,
} from "./customerLedger";

const parent = "/apps/crm/customers";

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
  // Dual-role contacts: this same Paraşüt contact can be the `supplier` on
  // purchase_bills even when account_type is "customer" — see
  // customerLedger.ts's doc comment and ACCOUNT_STATEMENT_AND_PARASUT_SYNC_AUDIT.md.
  supplierDocuments?: DocumentRow[] | null;
  supplierPayments?: PaymentRow[] | null;
  statement?: AuthoritativeStatement | null;
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

// Positive running balance = customer owes us (Borç bakiyesi, "B" suffix);
// negative = we owe the customer / they're in credit (Alacak bakiyesi, "A"
// suffix). Convention matches the supplied PİNO statement. Used for ledger
// rows/totals only.
function formatSignedBalance(value: number) {
  const suffix = value < 0 ? "A" : "B";
  return `${formatMoney(Math.abs(value))} ${suffix}`;
}

// Profile-header balance: +/-/0 sign, no B/A suffix — same convention as
// the customer list, applied to the real trl_balance directly.
function formatHeaderBalance(value: number) {
  if (value === 0) return formatMoney(0);
  return `${value > 0 ? "+" : "-"}${formatMoney(Math.abs(value))}`;
}

export function CustomerDetailPage({ customerId }: { customerId?: string }) {
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState<ContactRecord | null>(null);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [supplierDocuments, setSupplierDocuments] = useState<DocumentRow[]>([]);
  const [supplierPayments, setSupplierPayments] = useState<PaymentRow[]>([]);
  const [statement, setStatement] = useState<AuthoritativeStatement | null>(null);
  const [receivedChecks, setReceivedChecks] = useState<CheckListRow[]>([]);
  const [issuedChecks, setIssuedChecks] = useState<CheckListRow[]>([]);
  const [linkedChecksStatus, setLinkedChecksStatus] = useState<"loading" | "ready" | "error">("loading");
  const [offers, setOffers] = useState<OfferApiRow[]>([]);
  const [erpQuotes, setErpQuotes] = useState<QuoteRow[]>([]);
  const [invoiceSort, setInvoiceSort] = useState<"asc" | "desc">("desc");
  const [printFrom, setPrintFrom] = useState("");
  const [printTo, setPrintTo] = useState("");

  useEffect(() => {
    let cancelled = false;
    if (!customerId) {
      setLoading(false);
      setContact(null);
      setDocuments([]);
      setPayments([]);
      setSupplierDocuments([]);
      setSupplierPayments([]);
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
          setSupplierDocuments([]);
          setSupplierPayments([]);
          setStatement(null);
        } else {
          setContact(response.contact);
          setDocuments(Array.isArray(response.recentDocuments) ? response.recentDocuments : []);
          setPayments(Array.isArray(response.payments) ? response.payments : []);
          setSupplierDocuments(Array.isArray(response.supplierDocuments) ? response.supplierDocuments : []);
          setSupplierPayments(Array.isArray(response.supplierPayments) ? response.supplierPayments : []);
          setStatement(response.statement ?? null);
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
        setSupplierDocuments([]);
        setSupplierPayments([]);
        setOffers([]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  useEffect(() => {
    if (!customerId) {
      setReceivedChecks([]);
      setIssuedChecks([]);
      setLinkedChecksStatus("ready");
      return;
    }

    let cancelled = false;
    setLinkedChecksStatus("loading");
    // Dual-role contacts can also be the given_to party on an issued check
    // (see customerLedger.ts) — fetched unconditionally alongside received
    // checks; for a pure customer this simply resolves to an empty array.
    Promise.all([
      listAllChecks({ filters: { contactParasutId: customerId, direction: "received" } }),
      listAllChecks({ filters: { contactParasutId: customerId, direction: "issued" } }),
    ])
      .then(([receivedResult, issuedResult]) => {
        if (cancelled) return;
        if (receivedResult.ok === false || issuedResult.ok === false) {
          setReceivedChecks([]);
          setIssuedChecks([]);
          setLinkedChecksStatus("error");
          return;
        }
        setReceivedChecks(receivedResult.data);
        setIssuedChecks(issuedResult.data);
        setLinkedChecksStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setReceivedChecks([]);
          setIssuedChecks([]);
          setLinkedChecksStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [customerId]);

  useEffect(() => {
    if (!customerId) {
      setErpQuotes([]);
      return;
    }
    let cancelled = false;
    fetchQuotesForCustomer("parasut", customerId).then((result) => {
      if (cancelled) return;
      setErpQuotes(result.ok ? result.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  // Reference lookup only (Tahsilatlar table's "Referans" column) — built
  // from every fetched document, not just balance-impacting ones, since a
  // cancelled invoice's number is still useful context there.
  const documentByPaymentId = useMemo(() => buildPaymentToDocumentMap(documents), [documents]);

  // Every real, non-cancelled invoice matched to this customer via the real
  // relationships.contact relation is a Borç row — it must appear whether or
  // not it has any linked payment. append_contact_balance was previously
  // used to exclude rows here, but real production data showed customers
  // whose genuine invoices have that flag false while still being real,
  // owed receivables — excluding on it silently dropped every invoice for
  // some customers. Only a genuinely cancelled document is excluded now
  // (see customerLedger.ts's filterBalanceDocuments, applied internally).
  const balanceDocuments = useMemo(
    () => documents.filter((document) => sourceText(document.attributes?.item_type) !== "cancelled"),
    [documents],
  );

  const ledgerRows = useMemo<LedgerRow[]>(
    () => buildAuthoritativeLedgerRows(statement, customerId ?? ""),
    [statement, customerId],
  );

  const ledgerWithBalance = ledgerRows;
  const reconciliationWarning = useMemo(() => statementWarning(statement, ledgerRows), [statement, ledgerRows]);

  const totalDebit = ledgerRows.reduce((sum, row) => sum + row.debit, 0);
  const totalCredit = ledgerRows.reduce((sum, row) => sum + row.credit, 0);
  const totalBalance = totalDebit - totalCredit;

  // The visible Start/End inputs must filter the on-screen ledger itself,
  // not only the printed output. Default (both empty) is the full real
  // history, so it begins at the customer's true oldest row. carryForward is
  // the real computed balance from every actual row before the selected
  // start date — never fabricated — and is only shown once a start date is
  // chosen.
  const rangeFilteredLedger = useMemo(() => {
    const rowsBeforeRange = printFrom ? ledgerWithBalance.filter((row) => row.date < printFrom) : [];
    const carryForward = printFrom && rowsBeforeRange.length ? rowsBeforeRange[rowsBeforeRange.length - 1].balance : null;
    const rows = ledgerWithBalance.filter(
      (row) => (!printFrom || row.date >= printFrom) && (!printTo || row.date <= printTo),
    );
    const debit = rows.reduce((sum, row) => sum + row.debit, 0);
    const credit = rows.reduce((sum, row) => sum + row.credit, 0);
    const balance = rows.length ? rows[rows.length - 1].balance : carryForward ?? 0;
    return { rows, carryForward, totalDebit: debit, totalCredit: credit, totalBalance: balance };
  }, [ledgerWithBalance, printFrom, printTo]);

  const collectedTotal = payments.reduce((sum, payment) => sum + (numericValue(payment.attributes?.amount) ?? 0), 0);

  // remaining_in_trl is Paraşüt's own already-net (unpaid), TRY-denominated
  // per-invoice figure — using it (rather than re-deriving from gross_total
  // minus matched payments) avoids re-guessing what Paraşüt already computed.
  const todayIso = istanbulTodayIso();
  const openTryChecks = receivedChecks.filter(
    (check) =>
      check.direction === "received" &&
      check.party.parasutId === customerId &&
      check.settlementStatus === "open" &&
      check.remainingAmount !== null &&
      check.remainingAmount > 0 &&
      check.currency === "TRY",
  );
  const overdueCheckTotal = openTryChecks.reduce(
    (sum, check) => sum + (check.dueDate && check.dueDate < todayIso && check.remainingAmount !== null ? check.remainingAmount : 0),
    0,
  );
  const upcomingCheckTotal = openTryChecks.reduce(
    (sum, check) => sum + (check.dueDate && check.dueDate >= todayIso && check.remainingAmount !== null ? check.remainingAmount : 0),
    0,
  );
  const overdueTotal = balanceDocuments.reduce((sum, document) => {
    const attributes = document.attributes ?? {};
    const remaining = numericValue(attributes.remaining_in_trl);
    const dueDate = sourceText(attributes.due_date);
    if (remaining === null || !dueDate || dueDate >= todayIso) return sum;
    return sum + remaining;
  }, overdueCheckTotal);
  const upcomingTotal = balanceDocuments.reduce((sum, document) => {
    const attributes = document.attributes ?? {};
    const remaining = numericValue(attributes.remaining_in_trl);
    const dueDate = sourceText(attributes.due_date);
    if (remaining === null || !dueDate || dueDate < todayIso) return sum;
    return sum + remaining;
  }, upcomingCheckTotal);

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
  const balance = balanceValue === null ? "—" : formatHeaderBalance(balanceValue);
  const phone = sourceText(attributes.phone);
  const whatsapp = sourceText(attributes.whatsapp) || phone;

  const printLedger = () => {
    const periodLabel =
      printFrom || printTo
        ? `Dönem: ${printFrom || "başlangıç"} – ${printTo || "güncel"}`
        : "Dönem: Tüm Kayıtlar";
    // A window opened via window.open("", "_blank") + document.write() stays
    // in the same browsing-context group as this tab (opener relationship),
    // which is what let window.print() inside it block this page's UI
    // thread. A Blob URL opened with the "noopener" window feature (not just
    // nulling .opener after the fact) gets its own browsing context group,
    // so the print dialog can no longer freeze this tab, and this page stays
    // on the same route the whole time.
    const html = buildLedgerPrintHtml(
      `Cari Hesap Ekstresi — ${name}`,
      `Müşteri Kodu: ${code} · ${periodLabel}`,
      rangeFilteredLedger.rows,
      { totalDebit: rangeFilteredLedger.totalDebit, totalCredit: rangeFilteredLedger.totalCredit, totalBalance: rangeFilteredLedger.totalBalance },
      rangeFilteredLedger.carryForward,
      `${window.location.origin}${import.meta.env.BASE_URL}logo-header.png`,
      reconciliationWarning,
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
        <Link className="crm-primary" to={`/apps/sales/quotes/new?customerId=${customerId}`}>
          Teklif Oluştur
        </Link>
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
          ["Vadesi Geçen Tutar", formatMoney(overdueTotal)],
          ["Yaklaşan Ödeme", formatMoney(upcomingTotal)],
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
        <div className="crm-head-actions" style={{ justifyContent: "space-between", display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
          <h2>Cari Hareketler — Resmi Hesap</h2>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
              Başlangıç
              <input type="date" value={printFrom} onChange={(e) => setPrintFrom(e.target.value)} />
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.85rem" }}>
              Bitiş
              <input type="date" value={printTo} onChange={(e) => setPrintTo(e.target.value)} />
            </label>
            <button type="button" className="crm-primary" onClick={printLedger}>
              <Printer />
              Cari Hesabı Yazdır
            </button>
          </div>
        </div>
        <div className="crm-empty" style={{ marginBottom: "0.5rem" }}>
          Her satır Paraşüt işlem geçmişindeki tek bir gerçek transaction kimliğidir. Tahsisler yalnızca bağlantı ayrıntısıdır
          ve bakiyeyi ikinci kez etkilemez; açılış bakiyesi yalnızca Paraşüt'ün gerçek açılış-bakiyesi işlemi varsa görünür.
        </div>
        {reconciliationWarning && <div className="crm-empty" role="alert" style={{ marginBottom: "0.5rem", color: "#b42318" }}>{reconciliationWarning}</div>}
        {linkedChecksStatus === "loading" && (
          <div className="crm-empty" style={{ marginBottom: "0.5rem" }}>
            Bağlı çek hareketleri yükleniyor…
          </div>
        )}
        {linkedChecksStatus === "error" && (
          <div className="crm-empty" role="alert" style={{ marginBottom: "0.5rem" }}>
            Bağlı çek hareketleri yüklenemedi; fatura ve tahsilat hareketleri etkilenmedi.
          </div>
        )}
        <div className="erp-card crm-table-wrap">
          <table className="crm-table">
            <thead>
              <tr>
                {["Tarih", "İşlem", "Açıklama", "Borç", "Alacak", "Bakiye"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rangeFilteredLedger.carryForward !== null && (
                <tr className="crm-carry-row">
                  <td>—</td>
                  <td>Devir Bakiyesi</td>
                  <td>Seçilen dönem öncesi gerçek bakiye</td>
                  <td>—</td>
                  <td>—</td>
                  <td>{formatSignedBalance(rangeFilteredLedger.carryForward)}</td>
                </tr>
              )}
              {rangeFilteredLedger.rows.map((row) => (
                <tr key={row.transactionId} title={`Paraşüt transaction ${row.transactionId}`}>
                  <td>{row.date || "—"}</td>
                  <td>
                    {LEDGER_TYPE_LABELS[row.transactionType]}
                  </td>
                  <td>{row.description || "—"}</td>
                  <td>{row.debit ? formatMoney(row.debit) : "—"}</td>
                  <td>{row.credit ? formatMoney(row.credit) : "—"}</td>
                  <td>{formatSignedBalance(row.balance)}</td>
                </tr>
              ))}
            </tbody>
            {rangeFilteredLedger.rows.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3}>
                    <strong>Toplam</strong>
                  </td>
                  <td>
                    <strong>{formatMoney(rangeFilteredLedger.totalDebit)}</strong>
                  </td>
                  <td>
                    <strong>{formatMoney(rangeFilteredLedger.totalCredit)}</strong>
                  </td>
                  <td>
                    <strong>{formatSignedBalance(rangeFilteredLedger.totalBalance)}</strong>
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
          {!rangeFilteredLedger.rows.length && (
            <div className="crm-empty">Bu müşteriye ait cari hareket bulunamadı.</div>
          )}
        </div>
      </section>

      <ErpQuoteHistory quotes={erpQuotes} />

      <QuoteHistoryPanel source="parasut" parasutCustomerId={customerId ?? null} localCustomerId={null} />

      <OfferHistory offers={offers} />
    </div>
  );
}

function ErpQuoteHistory({ quotes }: { quotes: QuoteRow[] }) {
  return (
    <section className="crm-history">
      <h2>Teklifler (ERP)</h2>
      <div className="erp-card crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              {["Teklif No", "Konu", "Toplam", "Durum", "Tarih"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {quotes.map((quote) => (
              <tr key={quote.id}>
                <td>
                  <Link to={`/apps/sales/quotes/${quote.id}`}>{quote.quote_no}</Link>
                </td>
                <td>{quote.subject}</td>
                <td>{invoiceAmount(quote.grand_total, quote.currency)}</td>
                <td>
                  <StatusBadge>{QUOTE_STATUS_LABELS[effectiveQuoteStatus(quote)]}</StatusBadge>
                </td>
                <td>{displayText(quote.issue_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {!quotes.length && <div className="crm-empty">Bu müşteriye ait ERP teklifi bulunamadı.</div>}
      </div>
    </section>
  );
}

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character,
  );

export function buildLedgerPrintHtml(
  title: string,
  subtitle: string,
  rows: (LedgerRow & { balance: number })[],
  totals: { totalDebit: number; totalCredit: number; totalBalance: number },
  carryForward: number | null,
  logoUrl: string,
  warning: string | null = null,
) {
  const headers = ["Tarih", "İşlem", "Açıklama", "Borç", "Alacak", "Bakiye"];
  const carryRow =
    carryForward !== null
      ? `<tr class="carry"><td>—</td><td>Devir Bakiyesi</td><td>Seçilen dönem öncesi gerçek bakiye</td><td>—</td><td>—</td><td>${escapeHtml(formatSignedBalance(carryForward))}</td></tr>`
      : "";
  const bodyRows = buildLedgerPrintRows(rows)
    .map((row) => {
      const typeLabel = LEDGER_TYPE_LABELS[row.transactionType];
      return `<tr><td>${escapeHtml(row.date || "—")}</td><td>${escapeHtml(typeLabel)}</td><td>${escapeHtml(row.description || "—")}</td><td>${escapeHtml(row.debit ? formatMoney(row.debit) : "—")}</td><td>${escapeHtml(row.credit ? formatMoney(row.credit) : "—")}</td><td>${escapeHtml(formatSignedBalance(row.balance))}</td></tr>`;
    })
    .join("");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>
body{font:11px Arial;color:#18212b;margin:0}
.sheet{padding:14mm}
header{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #173d65;margin-bottom:14px;padding-bottom:12px}
header img{height:40px;object-fit:contain}
h1{margin:5px 0;font-size:16px}
.meta{color:#596879;font-size:10.5px}
table{width:100%;border-collapse:collapse;margin-top:14px}
th,td{border:1px solid #ccd5df;padding:6px;text-align:left}
th{background:#e9f0f7}
tfoot td{font-weight:700}
tr.carry td{font-style:italic;background:#f4f7fa}
.pdf-kpis{display:flex;gap:10px;margin:14px 0}
.pdf-kpis article{flex:1 1 150px;border:1px solid #ccd5df;border-radius:8px;padding:8px 10px}
.pdf-kpis span{display:block;color:#687684;font-size:9px;text-transform:uppercase}
.pdf-kpis strong{font-size:14px}
.page-number:after{content:"Sayfa " counter(page) " / " counter(pages)}
@page{size:A4;margin:12mm 12mm 18mm 12mm}
@media print{.page-number{position:fixed;bottom:6mm;right:12mm;font-size:9px;color:#687684}}
</style></head><body><div class="sheet"><header><div><strong>Dayan Dişli</strong><h1>${escapeHtml(title)}</h1><div class="meta">${escapeHtml(subtitle)}</div></div><img src="${escapeHtml(logoUrl)}" alt="Dayan Dişli" /></header>${warning ? `<div role="alert" style="border:2px solid #b42318;color:#b42318;padding:8px;margin:10px 0">${escapeHtml(warning)}</div>` : ""}<section class="pdf-kpis"><article><span>Toplam Borç</span><strong>${escapeHtml(formatMoney(totals.totalDebit))}</strong></article><article><span>Toplam Alacak</span><strong>${escapeHtml(formatMoney(totals.totalCredit))}</strong></article><article><span>Toplam Bakiye</span><strong>${escapeHtml(formatSignedBalance(totals.totalBalance))}</strong></article></section><table><thead><tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr></thead><tbody>${carryRow}${bodyRows}</tbody></table><div class="page-number"></div></div><script>window.onload=()=>window.print();</script></body></html>`;
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
                  {/* net_total, not gross_total — see customerLedger.ts's doc comment: this
                      Paraşüt account's gross_total is the pre-tax amount. */}
                  <td>{invoiceAmount(attributes.net_total, attributes.currency)}</td>
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
