export const customerFormDefaults = {
  taxNo: "",
  type: "Tüzel Kişi",
  companyName: "",
  shortName: "",
  taxOffice: "",
  category: "",
  email: "",
  phone: "",
  fax: "",
  address: "",
  postalCode: "",
  district: "",
  city: "",
  iban: "",
  priceList: "",
  currencySide: "Satış",
  openingBalance: "0",
  contacts: [] as { name: string; email: string; phone: string; note: string }[],
};

export const collectionKpis = [
  { label: "Planlanmamış", value: "—" },
  { label: "Vadesi Geçen", value: "—" },
  { label: "Toplam Tahsilat", value: "—" },
  { label: "Ortalama Vade Aşımı", value: "—" },
];
export const agingBuckets = [
  { label: "Planlanmamış", value: 0 },
  { label: "Güncel", value: 0 },
  { label: "1–30 Gün Gecikmiş", value: 0 },
  { label: "31–60 Gün Gecikmiş", value: 0 },
  { label: "61–90 Gün Gecikmiş", value: 0 },
  { label: "91–120 Gün Gecikmiş", value: 0 },
  { label: "120+ Gün Gecikmiş", value: 0 },
];
export const collectionRows: {
  collectionDate: string;
  documentDate: string;
  party: string;
  document: string;
  amount: string;
}[] = [];
