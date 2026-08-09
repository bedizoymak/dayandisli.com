// customerId references crmCustomers (src/features/crm/crmCustomerData.ts) — the
// CRM customer list is the single source of truth for customer identity across
// the whole ERP. See docs note: any "Müşteri" cell must resolve to a real
// crmCustomers.id so it can link to /apps/crm/customers/:id.
export const invoiceRows = [
  { no: "SF-2026-148", customer: "Atlas Makine Sanayi A.Ş.", customerId: "atlas-makine", invoiceDate: "16.07.2026", dueDate: "15.08.2026", amount: "₺ 485.000", collection: "Tahsil Edilecek", status: "Onaylandı" },
  { no: "SF-2026-143", customer: "Eksen Otomotiv Ltd.", customerId: "eksen-otomotiv", invoiceDate: "11.07.2026", dueDate: "11.07.2026", amount: "₺ 720.000", collection: "Tahsil Edildi", status: "Kapandı" },
  { no: "SF-2026-137", customer: "Selim Kaya", customerId: "selim-kaya", invoiceDate: "03.07.2026", dueDate: "10.07.2026", amount: "₺ 164.500", collection: "Tahsil Edilecek", status: "Gecikmiş" },
  { no: "SF-2026-129", customer: "Atlas Makine Sanayi A.Ş.", customerId: "atlas-makine", invoiceDate: "25.06.2026", dueDate: "25.07.2026", amount: "₺ 98.750", collection: "Tahsil Edilecek", status: "Onaylandı" },
];

export const customerFormDefaults = {
  taxNo: "1234567890", type: "Tüzel Kişi", companyName: "Örnek Sanayi A.Ş.", shortName: "Örnek Sanayi", taxOffice: "Büyük Mükellefler", category: "Yurtiçi Müşteri",
  email: "muhasebe@ornek.com", phone: "+90 212 555 00 00", fax: "+90 212 555 00 01", address: "İkitelli OSB, İstanbul", postalCode: "34490", district: "Başakşehir", city: "İstanbul",
  iban: "TR00 0000 0000 0000 0000 0000 00", priceList: "Standart Satış", currencySide: "Satış", openingBalance: "0",
  contacts: [{ name: "Deniz Yılmaz", email: "deniz@ornek.com", phone: "+90 532 555 00 00", note: "Finans yetkilisi" }],
};

export const collectionKpis = [
  { label: "Planlanmamış", value: "₺ 125.000" }, { label: "Vadesi Geçen", value: "₺ 3.340.000" }, { label: "Toplam Tahsilat", value: "₺ 4.815.000" }, { label: "Ortalama Vade Aşımı", value: "42 Gün" },
];
export const agingBuckets = [
  { label: "Planlanmamış", value: 125 }, { label: "Güncel", value: 1350 }, { label: "1–30 Gün Gecikmiş", value: 920 }, { label: "31–60 Gün Gecikmiş", value: 670 }, { label: "61–90 Gün Gecikmiş", value: 510 }, { label: "91–120 Gün Gecikmiş", value: 390 }, { label: "120+ Gün Gecikmiş", value: 850 },
];
export const collectionRows = [
  { collectionDate: "15.08.2026", documentDate: "16.07.2026", party: "Atlas Makine Sanayi A.Ş.", partyId: "atlas-makine", document: "SF-2026-148", amount: "₺ 485.000" },
  { collectionDate: "11.07.2026", documentDate: "11.07.2026", party: "Eksen Otomotiv Ltd.", partyId: "eksen-otomotiv", document: "SF-2026-143", amount: "₺ 720.000" },
  { collectionDate: "10.07.2026", documentDate: "03.07.2026", party: "Selim Kaya", partyId: "selim-kaya", document: "SF-2026-137", amount: "₺ 164.500" },
];
