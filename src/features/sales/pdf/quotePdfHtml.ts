import { QUOTE_BANK_ACCOUNTS, QUOTE_EINVOICE_INFO, QUOTE_ISSUERS, type QuoteCurrency, type QuoteIssuerKey } from "../quoteTypes";
import type { QuoteLineRow, QuoteRow } from "../quoteTypes";

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character] ?? character,
  );

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  }
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function validityLabel(issueDate: string, validUntil: string | null) {
  if (!validUntil) return "—";
  const start = new Date(`${issueDate}T00:00:00`);
  const end = new Date(`${validUntil}T00:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return formatDate(validUntil);
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  return `${days} Gün`;
}

// Verbatim port of the approved V6 template's visual language (dark navy
// header, thin light-blue rule, KDV-inclusive grand-total band, plain-list
// terms, unboxed footer) — see the task's index.html/style.css. Adapted
// here to be driven by real quote data instead of the static sample.
const PDF_STYLE = `
:root{--navy:#09243d;--blue:#55b8e8;--ink:#183047;--muted:#607486;--line:#d9e2e9;--paper:#fff}
*{box-sizing:border-box}
body{margin:0;background:#e7edf2;color:var(--ink);font-family:Arial,"Helvetica Neue",sans-serif}
.quote-sheet{width:210mm;min-height:297mm;margin:18px auto;background:var(--paper);padding:15mm 14mm 12mm}
.quote-header{background:var(--navy);border-bottom:3px solid var(--blue);min-height:43mm;padding:9mm 10mm;display:flex;justify-content:space-between;align-items:flex-start;color:#fff}
.header-copy{max-width:127mm}
.issuer-kicker{margin:0 0 3mm;color:var(--blue);font-size:10px;font-weight:700;letter-spacing:1.35px}
.header-copy h1{margin:0;font-size:23px;line-height:1.06;letter-spacing:.2px}
.tagline{margin:3mm 0 0;color:#d9edf8;font-size:10.5px}
.brand-lockup{width:38mm;display:flex;align-items:center;flex-direction:column;text-align:center;margin-top:-2mm}
.brand-logo{max-width:28mm;max-height:17mm;object-fit:contain}
.logo-fallback{height:17mm;color:#fff;font-size:13px;font-weight:800;line-height:.85;letter-spacing:1px;padding-top:2mm;display:flex;align-items:center;justify-content:center;flex-direction:column}
.logo-fallback span{color:var(--blue)}
.brand-lockup strong{font-size:8.5px;letter-spacing:.8px;margin-top:2mm}
.brand-lockup>span.slogan{font-size:6.6px;color:#d9edf8;margin-top:1mm;white-space:nowrap}
.meta-grid{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-top:0;margin-bottom:7mm}
.meta-grid div{padding:3.7mm 4mm;border-right:1px solid var(--line)}
.meta-grid div:last-child{border:0}
.meta-grid span,.section-label{display:block;color:var(--muted);font-size:7.2px;font-weight:700;letter-spacing:.8px}
.meta-grid strong{display:block;margin-top:1.4mm;font-size:9.5px}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:7mm;margin-top:2mm}
.party{border-top:2px solid var(--blue);padding-top:3mm;min-height:35mm}
.party h2{font-size:10.3px;margin:2.4mm 0 3mm;line-height:1.25}
.party p{font-size:8.1px;line-height:1.48;margin:1.3mm 0}
.party p span{color:var(--muted);font-weight:700}
.manual-subject{font-size:9px;margin:6mm 0 5mm;padding:0 0 2.5mm;border-bottom:1px solid var(--line);font-weight:700}
.products h2,.conditions h2{font-size:9.5px;letter-spacing:.55px;margin:0 0 3mm;color:var(--navy)}
table{border-collapse:collapse;width:100%;font-size:8px}
thead{display:table-header-group}
tr{page-break-inside:avoid}
th{background:#eaf4f9;color:var(--navy);padding:2.7mm 2mm;text-align:left;font-size:7.1px;letter-spacing:.35px}
td{padding:3mm 2mm;border-bottom:1px solid var(--line);vertical-align:top}
th:nth-child(1),td:nth-child(1){width:6mm;text-align:center}
th:nth-child(3),td:nth-child(3){width:15mm;text-align:center}
th:nth-child(n+4),td:nth-child(n+4){text-align:right;white-space:nowrap}
.item-title{font-weight:700;display:block}
.item-detail{font-size:7.2px;color:var(--muted);margin-top:1mm;display:block}
.bottom-grid{display:grid;grid-template-columns:1fr 57mm;gap:9mm;margin-top:8mm}
.conditions ul{margin:0;padding-left:4.6mm}
.conditions li{font-size:8px;line-height:1.5;margin-bottom:1.2mm}
.totals{margin:0;font-size:8.6px}
.totals div{display:flex;justify-content:space-between;padding:2.4mm 0;border-bottom:1px solid var(--line)}
.totals dd{margin:0;font-weight:700}
.totals .grand-total{background:var(--navy);color:#fff;margin-top:2mm;padding:3.4mm 3mm;border:0;font-size:10px}
.quote-footer{border-top:1px solid var(--line);margin-top:10mm;padding-top:4mm;display:grid;grid-template-columns:1.7fr 1fr;gap:8mm}
.quote-footer strong{display:block;font-size:7.8px;margin:1.5mm 0}
.quote-footer p:not(.section-label){font-size:7.5px;line-height:1.45;margin:1mm 0}
.document-footer{border-top:1px solid var(--line);margin:5mm 0 0;padding-top:2.5mm;text-align:center;font-size:6.8px;color:var(--muted)}
.page-number:after{content:"Sayfa " counter(page) " / " counter(pages)}
@page{size:A4;margin:0}
@media print{
  body{background:#fff}
  .quote-sheet{box-shadow:none;margin:0;width:auto;min-height:0;padding:10mm}
}
`;

export function buildQuotePdfHtml(quote: QuoteRow, lines: QuoteLineRow[]): string {
  const issuer = QUOTE_ISSUERS[quote.issuer as QuoteIssuerKey];
  const currency = quote.currency as QuoteCurrency;
  const bank = QUOTE_BANK_ACCOUNTS[quote.issuer as QuoteIssuerKey]?.[currency];

  const itemsHtml = lines
    .map((line, index) => {
      const gross = line.quantity * line.unit_price;
      const afterDiscount = gross * (1 - line.discount_pct / 100);
      const total = afterDiscount * (1 + line.vat_pct / 100);
      return `<tr>
        <td>${index + 1}</td>
        <td>
          <span class="item-title">${escapeHtml(line.description || "—")}</span>
          ${line.detail ? `<span class="item-detail">${escapeHtml(line.detail)}</span>` : ""}
        </td>
        <td>${escapeHtml(line.quantity)} ${escapeHtml(line.unit)}</td>
        <td>${escapeHtml(money(line.unit_price, currency))}</td>
        <td>%${escapeHtml(line.discount_pct)}</td>
        <td>${escapeHtml(money(total, currency))}</td>
      </tr>`;
    })
    .join("");

  // Absolute URL required: this document is rendered from a blob: URL (see
  // openQuotePdf below), which has no origin of its own to resolve a
  // relative path against.
  const logoUrl = issuer.logoPath
    ? `${window.location.origin}${import.meta.env.BASE_URL}${issuer.logoPath}`
    : null;
  const brandBlock = logoUrl
    ? `<img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(issuer.legalName)}" onerror="this.hidden=true;this.nextElementSibling.hidden=false" />
       <div class="logo-fallback" hidden>${escapeHtml(issuer.displayName.split(" ")[0])}<br /><span>${escapeHtml(issuer.displayName.split(" ").slice(1).join(" ") || issuer.displayName)}</span></div>`
    : `<div class="logo-fallback">${escapeHtml(issuer.displayName.split(" ")[0])}<br /><span>${escapeHtml(issuer.displayName.split(" ").slice(1).join(" ") || issuer.displayName)}</span></div>`;

  const bankHtml = bank
    ? `<section class="bank-info"><p class="section-label">BANKA BİLGİLERİ</p><strong>${escapeHtml(bank.bankName)}</strong><p>${escapeHtml(bank.iban)}</p></section>`
    : `<section class="bank-info"><p class="section-label">BANKA BİLGİLERİ</p><p>Banka bilgileri talep halinde paylaşılacaktır.</p></section>`;

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8" /><title>${escapeHtml(quote.quote_no)} — Teklif</title><style>${PDF_STYLE}</style></head><body>
<main class="quote-sheet">
  <header class="quote-header">
    <section class="header-copy">
      <p class="issuer-kicker">${escapeHtml(issuer.displayName)}</p>
      <h1>ÜRÜN VE HİZMET TEKLİFİ</h1>
      <p class="tagline">Dişli imalatı, profil taşlama ve hassas mekanik çözümler</p>
    </section>
    <section class="brand-lockup" aria-label="Firma logosu">
      ${brandBlock}
      <strong>${escapeHtml(issuer.displayName)}</strong>
      <span class="slogan">Güç, hassasiyet, süreklilik</span>
    </section>
  </header>

  <section class="meta-grid" aria-label="Teklif bilgileri">
    <div><span>TEKLİF NO</span><strong>${escapeHtml(quote.quote_no)}</strong></div>
    <div><span>TEKLİF TARİHİ</span><strong>${escapeHtml(formatDate(quote.issue_date))}</strong></div>
    <div><span>GEÇERLİLİK</span><strong>${escapeHtml(validityLabel(quote.issue_date, quote.valid_until))}</strong></div>
    <div><span>PARA BİRİMİ</span><strong>${escapeHtml(currency)}</strong></div>
  </section>

  <section class="parties">
    <article class="party">
      <p class="section-label">TEKLİF VEREN</p>
      <h2>${escapeHtml(issuer.legalName)}</h2>
      <p>${escapeHtml(issuer.address)}</p>
      <p><span>Telefon</span> ${escapeHtml(issuer.phone)} &nbsp; <span>E-posta</span> ${escapeHtml(issuer.email)}</p>
      <p><span>VKN</span> ${escapeHtml(issuer.taxNo)}</p>
    </article>
    <article class="party customer">
      <p class="section-label">MÜŞTERİ</p>
      <h2>${escapeHtml(quote.customer_name)}</h2>
      <p>${escapeHtml(quote.customer_address || "—")}</p>
      <p>
        ${quote.customer_phone ? `<span>Telefon</span> ${escapeHtml(quote.customer_phone)} &nbsp; ` : ""}
        ${quote.customer_email ? `<span>E-posta</span> ${escapeHtml(quote.customer_email)}` : ""}
      </p>
      ${quote.customer_tax_no ? `<p><span>Vergi No</span> ${escapeHtml(quote.customer_tax_no)}</p>` : ""}
    </article>
  </section>

  <p class="manual-subject">Konu: ${escapeHtml(quote.subject || "—")}</p>

  <section class="products">
    <h2>ÜRÜNLER VE HİZMETLER</h2>
    <table>
      <thead><tr><th>#</th><th>ÜRÜN / HİZMET VE TEKNİK AÇIKLAMA</th><th>MİKTAR</th><th>BİRİM FİYAT</th><th>İSKONTO</th><th>TOPLAM</th></tr></thead>
      <tbody>${itemsHtml}</tbody>
    </table>
  </section>

  <section class="bottom-grid">
    <div class="conditions">
      <h2>TEKLİF KOŞULLARI</h2>
      <ul>
        <li><b>Ödeme Şekli:</b> ${escapeHtml(quote.payment_terms || "—")}</li>
        <li><b>Teslim süresi:</b> ${escapeHtml(quote.delivery_time || "—")}</li>
        <li><b>Teslim yeri:</b> ${escapeHtml(quote.delivery_terms || "—")}</li>
        ${quote.notes ? `<li>${escapeHtml(quote.notes)}</li>` : ""}
      </ul>
    </div>
    <dl class="totals">
      <div><dt>Ara Toplam</dt><dd>${escapeHtml(money(quote.subtotal, currency))}</dd></div>
      <div><dt>İskonto</dt><dd>${escapeHtml(money(quote.discount_total, currency))}</dd></div>
      <div><dt>KDV</dt><dd>${escapeHtml(money(quote.vat_total, currency))}</dd></div>
      <div class="grand-total"><dt>GENEL TOPLAM</dt><dd>${escapeHtml(money(quote.grand_total, currency))}</dd></div>
    </dl>
  </section>

  <footer class="quote-footer">
    <section class="invoice-info">
      <p class="section-label">E-FATURA MÜKELLEFİ BİLGİLERİ</p>
      <strong>${escapeHtml(QUOTE_EINVOICE_INFO.legalName)}</strong>
      <p>${escapeHtml(QUOTE_EINVOICE_INFO.address)}</p>
      <p>${escapeHtml(QUOTE_EINVOICE_INFO.taxOffice)}</p>
    </section>
    ${bankHtml}
  </footer>
  <p class="document-footer">${escapeHtml(issuer.legalName)} · ${escapeHtml(issuer.email)} · ${escapeHtml(issuer.address)} · <span class="page-number"></span></p>
</main>
<script>window.onload=()=>window.print();<\/script>
</body></html>`;
}

/**
 * Use when quote+lines are already loaded in memory (e.g. the quote detail
 * page) — a single synchronous call from the click handler, so no popup
 * blocker can intervene: the window is opened and fully written to in one
 * tick, with no `await` in between.
 */
export function openQuotePdf(quote: QuoteRow, lines: QuoteLineRow[]) {
  const html = buildQuotePdfHtml(quote, lines);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const printWindow = window.open(url, "_blank", "noopener,noreferrer");
  if (!printWindow) URL.revokeObjectURL(url);
  else setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Use when the quote's lines still need to be fetched (e.g. the "PDF İndir"
 * row action on the quotes list, which only has the header in memory).
 * Popup blockers key off whether window.open() itself ran synchronously
 * inside the user gesture — NOT whether the window's content was written
 * synchronously. Call this FIRST, synchronously, directly in the onClick
 * handler; only afterwards `await` the data fetch and pass the still-open
 * window into writeQuotePdfToWindow(). (A prior version awaited the fetch
 * *before* calling window.open(), which put the call outside the gesture
 * and let most browsers silently block it.) No `noopener` here — writing
 * into the window later requires keeping the reference.
 */
export function openQuotePdfPlaceholder(): Window | null {
  const win = window.open("", "_blank");
  win?.document.write(
    "<!doctype html><title>Teklif hazırlanıyor…</title><body style=\"font:14px Arial;padding:40px;color:#334\">Teklif hazırlanıyor…</body>",
  );
  return win;
}

export function writeQuotePdfToWindow(win: Window, quote: QuoteRow, lines: QuoteLineRow[]) {
  const html = buildQuotePdfHtml(quote, lines);
  win.document.open();
  win.document.write(html);
  win.document.close();
}
