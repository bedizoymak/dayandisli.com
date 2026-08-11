export type InvoiceRow = {
  no: string;
  customer: string;
  customerId: string;
  invoiceDate: string;
  dueDate: string;
  amount: string;
  collection: string;
  status: string;
};

export type CollectionKpi = {
  label: string;
  value: string;
};

export type CollectionAgingBucket = {
  label: string;
  value: number;
};

export type CollectionRow = {
  collectionDate: string;
  documentDate: string;
  party: string;
  partyId: string;
  document: string;
  amount: string;
};

export const invoiceRows: InvoiceRow[] = [];

export const customerFormDefaults = {
  taxNo: "",
  type: "",
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
  currencySide: "",
  openingBalance: "",
  contacts: [] as Array<{
    name: string;
    email: string;
    phone: string;
    note: string;
  }>,
};

export const collectionKpis: CollectionKpi[] = [];
export const agingBuckets: CollectionAgingBucket[] = [];
export const collectionRows: CollectionRow[] = [];
