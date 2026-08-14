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

  it("shows the fixed e-invoice block for every issuer", () => {
    const html = buildQuotePdfHtml(baseQuote, lines);
    expect(html).toContain("HAYRETTİN DAYAN CEHA DİŞLİ SANAYİ");
    expect(html).toContain("İkitelli VD: 43675880102");
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
});
