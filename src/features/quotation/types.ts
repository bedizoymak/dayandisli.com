export interface ProductRow {
  id: number;
  kod: string;
  cins: string;
  malzeme: string;
  miktar: number;
  birim: string;
  birimFiyat: number;
  doviz: string;
}

export interface CustomerProfile {
  id: string;
  firma: string;
  ilgili_kisi: string;
  telefon: string;
  email: string;
  konu: string;
}

export interface QuotationFormData {
  firma: string;
  ilgiliKisi: string;
  tel: string;
  email: string;
  konu: string;
  products: ProductRow[];
  activeCurrency: string;
  notlar: string;
  opsiyon: string;
  teslimSuresi: string;
  odemeSekli: string;
  teslimYeri: string;
}

export const MALZEME_OPTIONS = ["C45", "8620", "4140", "16MnCr5", "20MnCr5", "Bronz", "Özel"];
export const BIRIM_OPTIONS = ["Adet", "Kg", "Metre", "Set"];
export const DOVIZ_OPTIONS = [
  { value: "TRY", label: "₺ TRY", symbol: "₺" },
  { value: "USD", label: "$ USD", symbol: "$" },
  { value: "EUR", label: "€ EUR", symbol: "€" },
];



