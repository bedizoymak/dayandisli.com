export type QuoteIssuerKey = "dayan" | "ceha";
export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected" | "expired";
export type QuoteCurrency = "TRY" | "USD" | "EUR";
export type QuoteCustomerSource = "parasut" | "local";

export type QuoteIssuerProfile = {
  prefix: string;
  legalName: string;
  displayName: string;
  taxNo: string;
  address: string;
  phone: string;
  email: string;
  logoPath: string | null;
};

// Approved billing entities. VKN is intentionally identical for both — both
// trade under the same tax identity (HAYRETTİN DAYAN CEHA DİŞLİ SANAYİ),
// per the task's fixed e-invoice block.
export const QUOTE_ISSUERS: Record<QuoteIssuerKey, QuoteIssuerProfile> = {
  dayan: {
    prefix: "DY",
    legalName: "Dayan Dişli & Profil Taşlama",
    displayName: "DAYAN DİŞLİ",
    taxNo: "43675880102",
    address:
      "İkitelli OSB Mahallesi, Çevre Sanayi Sitesi Sk. 8. Blok No: 45 – İç Kapı No: 1 Başakşehir, İstanbul",
    phone: "+90 536 583 74 20",
    email: "info@dayandisli.com",
    // Confirmed present in the repo (public/logo-header.png, already used by
    // every other PDF/print surface in this app).
    logoPath: "logo-header.png",
  },
  ceha: {
    prefix: "CH",
    legalName: "CEHA Dişli & Profil Taşlama",
    displayName: "CEHA DİŞLİ",
    taxNo: "43675880102",
    address:
      "İkitelli OSB Mahallesi, Çevre Sanayi Sitesi Sk. 8. Blok No: 45 – İç Kapı No: 1 Başakşehir, İstanbul",
    phone: "+90 536 583 74 20",
    email: "info@cehadisli.com",
    // Real CEHA logo asset, supplied 2026-08-14 and committed to
    // public/ceha-logo.png. The PDF template still falls back to the text
    // lockup automatically (onerror handler) if this ever fails to load.
    logoPath: "ceha-logo.png",
  },
};

export const QUOTE_EINVOICE_INFO = {
  legalName: "HAYRETTİN DAYAN CEHA DİŞLİ SANAYİ",
  address:
    "İkitelli OSB Mahallesi, Çevre Sanayi Sitesi Sk. 8. Blok No: 45 – İç Kapı No: 1 Başakşehir, İstanbul",
  taxOffice: "İkitelli VD: 43675880102",
};

// No production IBAN has been supplied yet. Deliberately empty — never
// filled with a placeholder TR000... value. Once real bank details exist,
// add an entry here keyed by issuer + currency; the PDF automatically
// switches from the "no bank info" fallback text to a real bank block the
// moment an entry is present, no other code change needed.
export const QUOTE_BANK_ACCOUNTS: Partial<
  Record<QuoteIssuerKey, Partial<Record<QuoteCurrency, { bankName: string; iban: string }>>>
> = {};

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  draft: "Taslak",
  sent: "Gönderildi",
  accepted: "Kabul Edildi",
  rejected: "Reddedildi",
  expired: "Süresi Doldu",
};

export const QUOTE_DEFAULT_TERMS = {
  paymentTerms: "%50 Peşin, bakiye teslimde",
  deliveryTime: "1 hafta",
  deliveryTerms: "Fabrika teslim",
  notes:
    "Teklif, belirtilen miktarlar ve teknik özellikler için hazırlanmıştır. Üretim, teknik resim ve gerekli ölçülerin kesinleşmesinin ardından planlanacaktır.",
};

export type QuoteLineDraft = {
  id: string;
  description: string;
  detail: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discountPct: number;
  vatPct: number;
};

export function emptyQuoteLine(id: string): QuoteLineDraft {
  return {
    id,
    description: "",
    detail: "",
    quantity: 1,
    unit: "Adet",
    unitPrice: 0,
    discountPct: 0,
    vatPct: 20,
  };
}

export type QuoteRow = {
  id: string;
  quote_no: string;
  issuer: QuoteIssuerKey;
  status: QuoteStatus;
  currency: QuoteCurrency;
  subject: string;
  customer_source: QuoteCustomerSource;
  parasut_customer_id: string | null;
  local_customer_id: string | null;
  customer_name: string;
  customer_contact: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  customer_address: string | null;
  customer_tax_no: string | null;
  issue_date: string;
  valid_until: string | null;
  payment_terms: string | null;
  delivery_terms: string | null;
  delivery_time: string | null;
  notes: string | null;
  subtotal: number;
  discount_total: number;
  vat_total: number;
  grand_total: number;
  converted_order_no: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteLineRow = {
  id: string;
  quote_id: string;
  position: number;
  description: string;
  detail: string | null;
  quantity: number;
  unit: string;
  unit_price: number;
  discount_pct: number;
  vat_pct: number;
  line_total: number;
};

export type QuoteLocalCustomerRow = {
  id: string;
  company_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  tax_no: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type QuoteHistoryEntryRow = {
  id: string;
  customer_source: QuoteCustomerSource;
  parasut_customer_id: string | null;
  local_customer_id: string | null;
  quote_no: string | null;
  quote_date: string | null;
  amount: number | null;
  currency: string | null;
  note: string | null;
  created_at: string;
};

// Real stored status is never mutated by the passage of time — this is a
// pure, presentation-only override so "Süresi Doldu" always reflects
// valid_until vs. today without discarding the user's actual chosen status
// (e.g. an explicitly "Kabul Edildi" quote never flips back to expired).
export function effectiveQuoteStatus(quote: Pick<QuoteRow, "status" | "valid_until">): QuoteStatus {
  if (quote.status === "draft" || quote.status === "accepted" || quote.status === "rejected") {
    return quote.status;
  }
  if (quote.valid_until && quote.valid_until < new Date().toISOString().slice(0, 10)) {
    return "expired";
  }
  return quote.status;
}
