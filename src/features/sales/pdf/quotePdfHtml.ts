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
//
// CEHA uses the identical layout with only the header's two colors
// swapped (white bg / navy text instead of navy bg / white text) via the
// --header-bg/--header-ink/--header-kicker/--header-tagline custom
// properties set on .quote-header per issuer (see buildQuotePdfHtml) — no
// separate template.
//
// print-color-adjust/-webkit-print-color-adjust: exact is load-bearing —
// without it, Chromium's print/"Save as PDF" path silently drops every
// background-color (the navy header, the navy grand-total band, the table
// header tint), which is exactly the washed-out/white-header, missing
// grand-total-band output previously reported. This is the fix for that.
const PDF_STYLE = `
:root{--navy:#09243d;--blue:#55b8e8;--ink:#183047;--muted:#607486;--line:#d9e2e9;--paper:#fff}
*{box-sizing:border-box;print-color-adjust:exact;-webkit-print-color-adjust:exact;color-adjust:exact}
html,body{margin:0;padding:0}
body{background:#e7edf2;color:var(--ink);font-family:Arial,"Helvetica Neue",sans-serif}
.quote-sheet{margin:18px auto;background:var(--paper);padding:16mm 16mm 14mm;box-shadow:0 4px 24px #0e26341c}
.quote-document{width:210mm;min-height:297mm;box-sizing:border-box;display:flex;flex-direction:column}
/* Fixed technical geometry — identical for both issuers; only colors,
   the logo file, and the logo's own aspect-ratio-driven fit change. */
.quote-header{
  --header-bg:#09243d;--header-ink:#fff;--header-kicker:#55b8e8;--header-tagline:#d9edf8;
  height:43mm;box-sizing:border-box;
  padding:8mm 10mm 7mm;
  border-bottom:3px solid #55b8e8;
  display:grid;grid-template-columns:minmax(0,1fr) 1px 42mm;column-gap:7mm;
  overflow:hidden;
  background:var(--header-bg);color:var(--header-ink);
}
.quote-header.issuer-ceha{--header-bg:#ffffff;--header-ink:#09243d;--header-kicker:#09243d;--header-tagline:#607486}
.header-copy{min-width:0;display:flex;flex-direction:column;justify-content:center}
.header-kicker{margin:0 0 3.2mm;color:var(--header-kicker);font-size:9pt;font-weight:700;letter-spacing:.9pt}
.header-title{font-size:20pt;line-height:1.08;font-weight:800;letter-spacing:0;white-space:nowrap;margin:0;color:var(--header-ink)}
.header-tagline{font-size:9.5pt;line-height:1.35;margin:3mm 0 0;color:var(--header-tagline)}
/* No per-issuer color needed: the divider inherits .quote-header's own
   text color (white on Dayan's navy, navy on CEHA's white), so it always
   reads correctly against whichever background is active. */
.header-divider{width:1px;height:30mm;align-self:center;justify-self:center;opacity:.26;transform:rotate(14deg);transform-origin:center;background:currentColor}
.brand-lockup{width:42mm;align-self:center;justify-self:center;display:flex;flex-direction:column;align-items:center;text-align:center;transform:translateY(2.5mm)}
.brand-lockup.issuer-ceha{transform:translateY(4mm)}
.brand-logo{display:block;margin:0 auto;object-fit:contain;object-position:center;max-width:31mm;max-height:12mm}
.brand-lockup[data-logo-shape="compact"] .brand-logo{max-width:24mm;max-height:17mm}
.brand-name {
  display: block;
  color: #fff;
  font-size: 8.8pt;
  font-weight: 800;
  letter-spacing: .55pt;
  line-height: 1;
  white-space: nowrap;
  text-align: center;
  background: #09243d;
  border-radius: 1px;
  padding: .7mm 2.4mm;
}
.brand-lockup.issuer-ceha .brand-name{margin-top:2mm}
.logo-fallback{color:var(--header-ink);font-size:10pt;font-weight:800;letter-spacing:.7pt;line-height:1.1;display:flex;align-items:center;justify-content:center;flex-direction:column}
.logo-fallback[hidden]{display:none}
.logo-fallback span{color:var(--header-kicker)}
/* CEHA's white header means white fallback text would be invisible — give
   it its own navy badge so the (white, single-line) wordmark stays
   readable. Dayan's navy header already contrasts fine, no badge needed. */
.quote-header.issuer-ceha .logo-fallback.ceha-wordmark{background:#09243d;padding:2mm 3mm;border-radius:1px}
.ceha-wordmark{color:#fff;font-size:10pt;font-weight:800;letter-spacing:.65pt;line-height:1;white-space:nowrap}
.brand-tagline{margin-top:3.2mm;font-size:6.4pt;font-weight:500;letter-spacing:.1pt;line-height:1.2;color:var(--header-tagline);white-space:nowrap}
.brand-lockup.issuer-ceha .brand-tagline{margin-top:1.2mm}
.meta-grid{display:grid;grid-template-columns:repeat(4,1fr);border:1px solid var(--line);border-top:0;margin-bottom:9mm}
.meta-grid div{padding:4.2mm 5mm;border-right:1px solid var(--line)}
.meta-grid div:last-child{border-right:0}
.meta-grid span,.section-label{display:block;color:var(--muted);font-size:7.6px;font-weight:700;letter-spacing:.8px}
.meta-grid strong{display:block;margin-top:1.8mm;font-size:10.5px}
.parties{display:grid;grid-template-columns:1fr 1fr;gap:7mm;margin-top:2mm;margin-bottom:8mm}
.party{min-height:35mm;padding-top:3mm;border:0;border-top:2px solid #55b8e8;border-radius:0;background:transparent}
.party-label{font-size:9pt;font-weight:800;letter-spacing:.45pt;color:#09243d;margin:0 0 3.2mm}
.party-name{font-size:10.5pt;font-weight:800;line-height:1.25;margin:0 0 2.7mm}
.party p{font-size:8.8px;line-height:1.62;margin:1.5mm 0}
.party p span{color:var(--muted);font-weight:700}
.manual-subject{font-size:10px;margin:0 0 6mm;padding:0 0 3mm;border-bottom:1px solid var(--line);font-weight:700;color:var(--navy)}
.products-title{margin:6mm 0 3mm;font-size:10pt;font-weight:800;letter-spacing:.45pt;color:#09243d}
.conditions h2{font-size:10.5px;letter-spacing:.6px;margin:0 0 3.5mm;color:var(--navy)}
table{border-collapse:collapse;width:100%;font-size:8.6px}
thead{display:table-header-group}
tr{page-break-inside:avoid}
.quote-table thead th{background:#09243d;color:#fff;font-size:7.6pt;font-weight:800;letter-spacing:.2pt;padding:3mm 2.2mm;border:0;text-align:left}
.quote-table tbody td{padding:3mm 2.2mm;border-bottom:1px solid #d9e2e9;font-size:8.2pt;vertical-align:top}
th:nth-child(1),td:nth-child(1){width:7mm;text-align:center}
th:nth-child(3),td:nth-child(3){width:17mm;text-align:center}
th:nth-child(n+4),td:nth-child(n+4){text-align:right;white-space:nowrap}
.item-title{font-weight:700;display:block}
.item-detail{font-size:7.6px;color:var(--muted);margin-top:1mm;display:block}
.bottom-grid{display:grid;grid-template-columns:1fr 62mm;gap:10mm;margin-top:9mm}
.conditions ul{margin:0;padding-left:4.8mm}
.conditions li{font-size:8.6px;line-height:1.6;margin-bottom:1.6mm}
.totals{width:57mm;margin-left:auto;border:0;border-radius:0;background:transparent}
.totals-row{display:flex;justify-content:space-between;padding:2.7mm 0;border-bottom:1px solid #d9e2e9;font-size:8.8pt}
.totals-row dt,.totals-row dd{margin:0}
.totals-row dd{font-weight:700}
.totals-row.grand-total{margin-top:2.5mm;padding:3.5mm 3mm;background:#09243d;color:#fff;border:0;border-radius:0;font-size:10pt;font-weight:800}
.totals-row.grand-total .amount{color:#55b8e8;font-size:11pt;font-weight:800}
.quote-footer{border-top:1px solid var(--line);margin-top:11mm;padding-top:4.5mm;display:grid;grid-template-columns:1.7fr 1fr;gap:9mm}
.quote-footer,.document-footer{break-inside:avoid;page-break-inside:avoid}
.quote-footer{break-after:avoid;page-break-after:avoid}
.quote-footer strong{display:block;font-size:8.4px;margin:1.6mm 0}
.quote-footer p:not(.section-label){font-size:8px;line-height:1.5;margin:1mm 0}
.document-footer{border-top:1px solid var(--line);margin:0;padding-top:2.5mm;text-align:center;font-size:7.2px;color:var(--muted);margin-top:auto}
.page-number:after{content:"Sayfa " counter(page) " / " counter(pages)}
@page{size:A4;margin:0}
@media print{
  body{background:#fff}
  .quote-sheet{box-shadow:none;margin:0;padding:12mm 12mm 6mm}
}
`;

export function buildQuotePdfHtml(quote: QuoteRow, lines: QuoteLineRow[]): string {
  const issuer = QUOTE_ISSUERS[quote.issuer as QuoteIssuerKey];
  const showBrandName = quote.issuer !== "dayan";
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
  // Shape (wide vs compact) is measured from the actual loaded file's
  // naturalWidth/naturalHeight — never a hardcoded per-issuer guess — so a
  // future logo swap for either issuer keeps fitting correctly with no
  // CSS change. The attribute is set on the .brand-lockup CONTAINER (not
  // the <img> itself), matching the CSS selectors
  // `.brand-lockup[data-logo-shape="…"] .brand-logo`.
  const logoShapeScript =
    'var r=this.naturalWidth/this.naturalHeight;this.parentElement.setAttribute("data-logo-shape",r>=1.65?"wide":"compact")';
  // CEHA's fallback (only shown if the real logo image fails to load) is a
  // single-line white-on-navy badge — a plain navy-header fallback would
  // be invisible against CEHA's white header. Dayan's existing two-line
  // fallback already contrasts fine against its navy header.
  const fallbackBlock =
    quote.issuer === "ceha"
      ? `<div class="logo-fallback ceha-wordmark" hidden>${escapeHtml(issuer.displayName)}</div>`
      : `<div class="logo-fallback" hidden>${escapeHtml(issuer.displayName.split(" ")[0])}<br /><span>${escapeHtml(issuer.displayName.split(" ").slice(1).join(" ") || issuer.displayName)}</span></div>`;
  const brandBlock = logoUrl
    ? `<img class="brand-logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(issuer.legalName)}" onload='${logoShapeScript}' onerror="this.hidden=true;this.nextElementSibling.hidden=false" />
       ${fallbackBlock}`
    : fallbackBlock.replace(' hidden>', '>');

  const bankHtml = bank
    ? `<section class="bank-info"><p class="section-label">BANKA BİLGİLERİ</p><strong>${escapeHtml(bank.bankName)}</strong><p>${escapeHtml(bank.iban)}</p></section>`
    : `<section class="bank-info"><p class="section-label">BANKA BİLGİLERİ</p><p>Banka bilgileri talep halinde paylaşılacaktır.</p></section>`;

  return `<!doctype html><html lang="tr"><head><meta charset="utf-8" /><title>${escapeHtml(quote.quote_no)} — Teklif</title><style>${PDF_STYLE}</style></head><body>
<main class="quote-sheet quote-document">
  <header class="quote-header${quote.issuer === "ceha" ? " issuer-ceha" : ""}">
    <section class="header-copy">
      <p class="header-kicker">${escapeHtml(issuer.displayName)}</p>
      <h1 class="header-title">ÜRÜN VE HİZMET TEKLİFİ</h1>
      <p class="header-tagline">Dişli imalatı, profil taşlama ve hassas mekanik çözümler</p>
    </section>
    <div class="header-divider" aria-hidden="true"></div>
    <section class="brand-lockup${quote.issuer === "ceha" ? " issuer-ceha" : ""}" aria-label="Firma logosu">
      ${brandBlock}
      ${showBrandName ? `<div class="brand-name">${escapeHtml(issuer.displayName)}</div>` : ""}
      <span class="brand-tagline">${escapeHtml(issuer.slogan)}</span>
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
      <p class="party-label">TEKLİF VEREN</p>
      <h2 class="party-name">${escapeHtml(issuer.legalName)}</h2>
      <p><span>Yetkili</span> ${escapeHtml(issuer.contactPerson)}</p>
      <p><span>Telefon</span> ${escapeHtml(issuer.phone)}</p>
      <p><span>E-posta</span> ${escapeHtml(issuer.email)}</p>
      <p><span>VKN</span> ${escapeHtml(issuer.taxNo)}</p>
      <p><span>Adres</span> ${escapeHtml(issuer.address)}</p>
    </article>
    <article class="party customer">
      <p class="party-label">MÜŞTERİ</p>
      <h2 class="party-name">${escapeHtml(quote.customer_name)}</h2>
      ${quote.customer_phone ? `<p><span>Telefon</span> ${escapeHtml(quote.customer_phone)}</p>` : ""}
      ${quote.customer_email ? `<p><span>E-posta</span> ${escapeHtml(quote.customer_email)}</p>` : ""}
      ${quote.customer_tax_no ? `<p><span>Vergi No</span> ${escapeHtml(quote.customer_tax_no)}</p>` : ""}
      <p><span>Adres</span> ${escapeHtml(quote.customer_address || "—")}</p>
    </article>
  </section>

  <p class="manual-subject">Konu: ${escapeHtml(quote.subject || "—")}</p>

  <section class="products">
    <p class="products-title">ÜRÜNLER VE HİZMETLER</p>
    <table class="quote-table">
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
      <div class="totals-row"><dt>Ara Toplam</dt><dd>${escapeHtml(money(quote.subtotal, currency))}</dd></div>
      <div class="totals-row"><dt>İskonto</dt><dd>${escapeHtml(money(quote.discount_total, currency))}</dd></div>
      <div class="totals-row"><dt>KDV</dt><dd>${escapeHtml(money(quote.vat_total, currency))}</dd></div>
      <div class="totals-row grand-total"><dt>GENEL TOPLAM</dt><dd class="amount">${escapeHtml(money(quote.grand_total, currency))}</dd></div>
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
<script>window.onload=()=>window.print();</script>
</body></html>`;
}

/**
 * Use when quote+lines are already loaded in memory (e.g. the quote detail
 * page) — a single synchronous call from the click handler, so no popup
 * blocker can intervene: the window is opened and fully written to in one
 * tick, with no `await` in between.
 */
/** Returns false when the popup was blocked, so callers can surface a visible error instead of doing nothing. */
export function openQuotePdf(quote: QuoteRow, lines: QuoteLineRow[]): boolean {
  const html = buildQuotePdfHtml(quote, lines);
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const printWindow = window.open(url, "_blank", "noopener,noreferrer");
  if (!printWindow) {
    URL.revokeObjectURL(url);
    return false;
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
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
