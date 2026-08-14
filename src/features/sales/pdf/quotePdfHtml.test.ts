import { describe, expect, it } from "vitest";
import { buildQuotePdfHtml } from "./quotePdfHtml";
import type { QuoteLineRow, QuoteRow } from "../quoteTypes";

const baseQuote: QuoteRow = {
  id: "q1",
  quote_no: "DY-202608-4",
  issuer: "dayan",
  status: "draft",
  currency: "TRY",
  subject: "Helis Dişli İmalatı",
  customer_source: "parasut",
  parasut_customer_id: "123",
  local_customer_id: null,
  customer_name: "MES METAL EKSTRÜZYON SANAYİ VE TİCARET A.Ş.",
  customer_contact: "Nagihan",
  customer_phone: "+90 212 875 34 67",
  customer_email: "nagihan@mesmetal.com",
  customer_address: "Beylikdüzü O.S.B Mah.",
  customer_tax_no: "1234567890",
  issue_date: "2026-08-14",
  valid_until: "2026-08-17",
  payment_terms: "%50 Peşin, bakiye teslimde",
  delivery_terms: "Fabrika teslim",
  delivery_time: "1 hafta",
  notes: "Test notu",
  subtotal: 25000,
  discount_total: 0,
  vat_total: 5000,
  grand_total: 30000,
  converted_order_no: null,
  created_at: "2026-08-14T00:00:00Z",
  updated_at: "2026-08-14T00:00:00Z",
};

const lines: QuoteLineRow[] = [
  {
    id: "l1",
    quote_id: "q1",
    position: 0,
    description: "MN 3 Z24 helis dişli",
    detail: "Komple imalat",
    quantity: 1,
    unit: "Adet",
    unit_price: 12000,
    discount_pct: 0,
    vat_pct: 20,
    line_total: 14400,
  },
];

describe("buildQuotePdfHtml — approved V6 template fields", () => {
  it("includes the issuer's real header copy, quote meta, customer, subject, terms and totals", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).toContain("DAYAN DİŞLİ");
    expect(html).toContain("ÜRÜN VE HİZMET TEKLİFİ");
    expect(html).toContain("DY-202608-4");
    expect(html).toContain(baseQuote.customer_name);
    expect(html).toContain("Konu: Helis Dişli İmalatı");
    expect(html).toContain("ÜRÜNLER VE HİZMETLER");
    expect(html).toContain("TEKLİF KOŞULLARI");
    expect(html).toContain("GENEL TOPLAM");
    expect(html).toContain("MN 3 Z24 helis dişli");
  });

  it("shows the fixed e-invoice block for every issuer, with the mükellef name as exactly 'HAYRETTİN DAYAN'", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).toContain(">HAYRETTİN DAYAN<");
    expect(html).not.toContain("HAYRETTİN DAYAN CEHA DİŞLİ SANAYİ");
    expect(html).toContain("İkitelli VD: 43675880102");
  });

  it("renders the issuer name under the logo as the exact single-line white brand-name block", () => {
    const dayanHtml = buildQuotePdfHtml(baseQuote, lines);
    const dayanBrandSection = dayanHtml.slice(dayanHtml.indexOf('class="brand-lockup"'), dayanHtml.indexOf("</section>", dayanHtml.indexOf('class="brand-lockup"')));
    expect(dayanBrandSection).toContain('<div class="brand-name">DAYAN DİŞLİ</div>');

    const cehaHtml = buildQuotePdfHtml({ ...baseQuote, issuer: "ceha" }, lines);
    const cehaBrandSection = cehaHtml.slice(cehaHtml.indexOf('class="brand-lockup"'), cehaHtml.indexOf("</section>", cehaHtml.indexOf('class="brand-lockup"')));
    expect(cehaBrandSection).toContain('<div class="brand-name">CEHA DİŞLİ</div>');

    for (const html of [dayanHtml, cehaHtml]) {
      expect(html).toContain(`.brand-name {
  display: block;
  margin-top: 2.4mm;
  color: #FFFFFF !important;
  font-size: 8.8pt;
  font-weight: 800;
  letter-spacing: 0.55pt;
  line-height: 1;
  white-space: nowrap;
  text-align: center;
}`);
    }
  });

  it("falls back to the 'talep halinde' bank text when no IBAN is configured for the issuer/currency", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).toContain("Banka bilgileri talep halinde paylaşılacaktır.");
    expect(html).not.toMatch(/TR\d{2}\s?\d{4}/); // never a fabricated IBAN-shaped string
  });

  it("uses the real Dayan logo image for the dayan issuer", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).toContain("logo-header.png");
    expect(html).toContain('class="brand-logo"');
  });

  it("uses the real CEHA logo image for the ceha issuer, with a single-line white-on-navy wordmark onerror fallback (never a fabricated logo)", () => {
    const html = buildQuotePdfHtml({ ...baseQuote, issuer: "ceha" }, lines);
    expect(html).toContain("ceha-logo.png");
    expect(html).toContain('class="brand-logo"');
    // The onerror handler that reveals the text lockup must still be wired,
    // so a broken/missing image never renders as an empty gap.
    expect(html).toContain("this.hidden=true;this.nextElementSibling.hidden=false");
    expect(html).toContain('class="logo-fallback ceha-wordmark"');
    expect(html).toContain("CEHA DİŞLİ");
  });

  it("escapes customer-supplied text to prevent HTML injection", () => {
    const html = buildQuotePdfHtml({ ...baseQuote, customer_name: '<script>alert(1)</script>' }, lines);
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("forces print-color-adjust so navy backgrounds (header, grand-total band) survive print/Save-as-PDF instead of being silently dropped", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).toContain("print-color-adjust:exact");
    expect(html).toContain("-webkit-print-color-adjust:exact");
  });

  it("Dayan renders the identical layout template with a navy header (no issuer-ceha class)", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).toMatch(/<header class="quote-header">/);
    expect(html).not.toMatch(/<header class="[^"]*issuer-ceha/);
  });

  it("CEHA renders the SAME layout template, only flagged with issuer-ceha for the header color-variant CSS (not a separate template)", () => {
    const html = buildQuotePdfHtml({ ...baseQuote, issuer: "ceha" }, lines);
    expect(html).toContain('<header class="quote-header issuer-ceha">');
    // Same section structure as Dayan — proves it is the one shared template.
    for (const marker of ["ÜRÜNLER VE HİZMETLER", "TEKLİF KOŞULLARI", "GENEL TOPLAM", "meta-grid", "quote-footer"]) {
      expect(html).toContain(marker);
    }
  });

  it("repeats the table header on every print page (thead as table-header-group) for multi-page quotes", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).toContain("thead{display:table-header-group}");
  });

  it("never labels TEKLİF KOŞULLARI as 'TİCARİ ŞARTLAR'", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).not.toContain("TİCARİ ŞARTLAR");
    expect(html).toContain("TEKLİF KOŞULLARI");
  });

  it("uses the exact fixed A4 header geometry (identical for both issuers)", () => {
    const dayanHtml = buildQuotePdfHtml(baseQuote, lines);
    const cehaHtml = buildQuotePdfHtml({ ...baseQuote, issuer: "ceha" }, lines);
    for (const html of [dayanHtml, cehaHtml]) {
      expect(html).toContain("height:43mm;box-sizing:border-box");
      expect(html).toContain("padding:8mm 10mm 7mm");
      expect(html).toContain("grid-template-columns:minmax(0,1fr) 1px 42mm");
      expect(html).toContain("column-gap:7mm");
      expect(html).toContain("border-bottom:3px solid #55b8e8");
    }
  });

  it("renders one rotated divider element between the text block and the brand block, colored via currentColor (auto-adapts to either header's text color)", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).toContain('<div class="header-divider" aria-hidden="true"></div>');
    expect(html).toContain("transform:rotate(14deg)");
    expect(html).toContain(".header-divider{width:1px;height:30mm;align-self:center;justify-self:center;opacity:.26;transform:rotate(14deg);transform-origin:center;background:currentColor}");
  });

  it("sets Dayan's colors exactly: navy header, light-blue kicker, white title/ink, light-blue-tinted tagline", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    const headerRuleStart = html.indexOf(".quote-header{");
    const headerRule = html.slice(headerRuleStart, html.indexOf("}", headerRuleStart) + 1);
    expect(headerRule).toContain("--header-bg:#09243d");
    expect(headerRule).toContain("--header-ink:#fff");
    expect(headerRule).toContain("--header-kicker:#55b8e8");
    expect(headerRule).toContain("--header-tagline:#d9edf8");
  });

  it("sets CEHA's colors exactly: white header, navy kicker+title/ink, muted tagline", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    const cehaRuleStart = html.indexOf(".quote-header.issuer-ceha{");
    const cehaRule = html.slice(cehaRuleStart, html.indexOf("}", cehaRuleStart) + 1);
    expect(cehaRule).toContain("--header-bg:#ffffff");
    expect(cehaRule).toContain("--header-ink:#09243d");
    expect(cehaRule).toContain("--header-kicker:#09243d");
    expect(cehaRule).toContain("--header-tagline:#607486");
  });

  it("measures the real logo's aspect ratio at load time and tags the .brand-lockup CONTAINER (not the <img>), matching the CSS selector", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).toContain("var r=this.naturalWidth/this.naturalHeight");
    expect(html).toContain('this.parentElement.setAttribute("data-logo-shape",r>=1.65?"wide":"compact")');
    expect(html).toContain('.brand-lockup[data-logo-shape="compact"] .brand-logo{max-width:24mm;max-height:17mm}');
  });

  it("renders the approved slogan text as a single line under the logo, in both issuers", () => {
    for (const issuer of ["dayan", "ceha"] as const) {
      const html = buildQuotePdfHtml({ ...baseQuote, issuer }, lines);
      expect(html).toContain('<span class="brand-tagline">HASSAS ÜRETİM • GÜVENİLİR TEDARİK</span>');
    }
  });

  it("shifts the brand-lockup group down slightly (translateY) so the logo/slogan group sits lower in the header, per spec", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).toContain("transform:translateY(2.5mm)");
  });

  it("gives TEKLİF VEREN/MÜŞTERİ plain, borderless blocks — no rounded card look — with bold party-label/party-name typography", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).toContain(".party{min-height:35mm;padding-top:3mm;border:0;border-top:2px solid #55b8e8;border-radius:0;background:transparent}");
    expect(html).toContain(".party-label{font-size:9pt;font-weight:800;letter-spacing:.45pt;color:#09243d;margin:0 0 3.2mm}");
    expect(html).toContain(".party-name{font-size:10.5pt;font-weight:800;line-height:1.25;margin:0 0 2.7mm}");
    expect(html).toContain('<p class="party-label">TEKLİF VEREN</p>');
    expect(html).toContain('<p class="party-label">MÜŞTERİ</p>');
  });

  it("renders the product table's header row navy with bold white text, and repeats it on every print page", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).toContain('<table class="quote-table">');
    expect(html).toContain(".quote-table thead th{background:#09243d;color:#fff;font-size:7.6pt;font-weight:800;letter-spacing:.2pt;padding:3mm 2.2mm;border:0;text-align:left}");
  });

  it("renders the grand-total band navy/white with a light-blue-highlighted amount, and plain sage rows above it with no card wrapper", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).toContain(".totals{width:57mm;margin-left:auto;border:0;border-radius:0;background:transparent}");
    expect(html).toContain(".totals-row.grand-total{margin-top:2.5mm;padding:3.5mm 3mm;background:#09243d;color:#fff;border:0;border-radius:0;font-size:10pt;font-weight:800}");
    expect(html).toContain(".totals-row.grand-total .amount{color:#55b8e8;font-size:11pt;font-weight:800}");
    expect(html).toContain('<div class="totals-row grand-total"><dt>GENEL TOPLAM</dt><dd class="amount">');
  });
});
