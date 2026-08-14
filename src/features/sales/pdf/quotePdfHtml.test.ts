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

  it("prints the brand name only once per issuer — never a duplicate caption next to a logo that already contains the wordmark", () => {
    const dayanHtml = buildQuotePdfHtml(baseQuote, lines);
    const dayanBrandSection = dayanHtml.slice(dayanHtml.indexOf('class="brand-lockup"'), dayanHtml.indexOf("</section>", dayanHtml.indexOf('class="brand-lockup"')));
    // Only the (hidden, onerror-only) fallback caption may mention the name — never a second, always-visible one alongside the real logo image.
    expect(dayanBrandSection).not.toMatch(/<strong>DAYAN/);

    const cehaHtml = buildQuotePdfHtml({ ...baseQuote, issuer: "ceha" }, lines);
    const cehaBrandSection = cehaHtml.slice(cehaHtml.indexOf('class="brand-lockup"'), cehaHtml.indexOf("</section>", cehaHtml.indexOf('class="brand-lockup"')));
    expect(cehaBrandSection).not.toMatch(/<strong>CEHA/);
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

  it("uses the real CEHA logo image for the ceha issuer, with a text-lockup onerror fallback (never a fabricated logo)", () => {
    const html = buildQuotePdfHtml({ ...baseQuote, issuer: "ceha" }, lines);
    expect(html).toContain("ceha-logo.png");
    expect(html).toContain('class="brand-logo"');
    // The onerror handler that reveals the text lockup must still be wired,
    // so a broken/missing image never renders as an empty gap.
    expect(html).toContain("this.hidden=true;this.nextElementSibling.hidden=false");
    expect(html).toContain('class="logo-fallback"');
    expect(html).toContain("CEHA");
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
      expect(html).toContain("padding:8mm 10mm 7mm 10mm");
      expect(html).toContain("grid-template-columns:minmax(0,1fr) 1px 42mm");
      expect(html).toContain("column-gap:7mm");
      expect(html).toContain("border-bottom:3px solid #55b8e8");
    }
  });

  it("renders one rotated divider element between the text block and the brand block, for both issuers", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).toContain('<div class="header-divider" aria-hidden="true"></div>');
    expect(html).toContain("transform:rotate(14deg)");
  });

  it("sets Dayan's colors exactly: navy header, light-blue kicker, white title, light-blue-tinted tagline/divider", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    const headerRuleStart = html.indexOf(".quote-header{");
    const headerRule = html.slice(headerRuleStart, html.indexOf("}", headerRuleStart) + 1);
    expect(headerRule).toContain("--header-bg:#09243d");
    expect(headerRule).toContain("--header-ink:#fff");
    expect(headerRule).toContain("--header-kicker:#55b8e8");
    expect(headerRule).toContain("--header-tagline:#d9edf8");
    expect(headerRule).toContain("--divider-color:rgba(217,237,248,.35)");
  });

  it("sets CEHA's colors exactly: white header, navy kicker+title, muted tagline/divider", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    const cehaRuleStart = html.indexOf(".quote-header.issuer-ceha{");
    const cehaRule = html.slice(cehaRuleStart, html.indexOf("}", cehaRuleStart) + 1);
    expect(cehaRule).toContain("--header-bg:#ffffff");
    expect(cehaRule).toContain("--header-ink:#09243d");
    expect(cehaRule).toContain("--header-kicker:#09243d");
    expect(cehaRule).toContain("--header-tagline:#607486");
    expect(cehaRule).toContain("--divider-color:rgba(9,36,61,.25)");
  });

  it("measures the real logo's aspect ratio at load time (never a hardcoded per-issuer wide/compact guess)", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).toContain("var r=this.naturalWidth/this.naturalHeight");
    expect(html).toContain('this.setAttribute("data-logo-shape",r>=1.65?"wide":"compact")');
  });

  it("renders the approved slogan text as the single line under the logo, in both issuers", () => {
    for (const issuer of ["dayan", "ceha"] as const) {
      const html = buildQuotePdfHtml({ ...baseQuote, issuer }, lines);
      expect(html).toContain('<span class="slogan">HASSAS ÜRETİM • GÜVENİLİR TEDARİK</span>');
    }
  });
});
