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

export const collectionKpis: { label: string; value: string }[] = [];
export const agingBuckets: { label: string; value: number }[] = [];
export const collectionRows: {
  collectionDate: string;
  documentDate: string;
  party: string;
  document: string;
  amount: string;
}[] = [];
