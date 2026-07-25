export type PartyRef = {
  id: string;
  name: string;
  type: "customer" | "supplier";
};
export type ProductRef = {
  id: string;
  name: string;
  code: string;
  stock: number;
  purchase: number;
  sale: number;
};
export const parties: PartyRef[] = [
  { id: "c1", name: "Atlas Makine", type: "customer" },
  { id: "c2", name: "Eksen Otomotiv", type: "customer" },
  { id: "s1", name: "Marmara Metal A.Ş.", type: "supplier" },
  { id: "s2", name: "Anadolu Rulman A.Ş.", type: "supplier" },
];
export const products: ProductRef[] = [
  {
    id: "p1",
    name: "Helisel Dişli M2",
    code: "HD-M2-001",
    stock: 184,
    purchase: 820,
    sale: 1280,
  },
  {
    id: "p2",
    name: "Konik Dişli Seti",
    code: "KD-S-014",
    stock: 46,
    purchase: 1640,
    sale: 2490,
  },
  {
    id: "p3",
    name: "CNC İşleme Hizmeti",
    code: "HZ-CNC-01",
    stock: 0,
    purchase: 0,
    sale: 1850,
  },
];
export const dispatches = [
  {
    no: "IRS-2026-0084",
    party: "Atlas Makine",
    type: "Giden",
    date: "16.07.2026",
    quantity: "24 Adet",
    status: "Sevk Edildi",
  },
  {
    no: "GIRS-2026-0041",
    party: "Marmara Metal A.Ş.",
    type: "Gelen",
    date: "15.07.2026",
    quantity: "680 Kg",
    status: "Teslim Alındı",
  },
];
export const stockMovements = [
  {
    product: "Helisel Dişli M2",
    type: "Giden İrsaliye",
    party: "Atlas Makine",
    date: "16.07.2026",
    quantity: "-24 Adet",
  },
  {
    product: "42CrMo4 Çelik",
    type: "Gelen İrsaliye",
    party: "Marmara Metal A.Ş.",
    date: "15.07.2026",
    quantity: "+680 Kg",
  },
  {
    product: "Konik Dişli Seti",
    type: "Satış Faturası",
    party: "Eksen Otomotiv",
    date: "12.07.2026",
    quantity: "-6 Adet",
  },
];
export const suppliers = [
  {
    name: "Marmara Metal A.Ş.",
    short: "Marmara Metal",
    taxNo: "1234567890",
    phone: "+90 224 555 18 42",
    email: "muhasebe@marmarametal.com",
    city: "Bursa",
    contact: "Selim Kaya",
  },
  {
    name: "Anadolu Rulman A.Ş.",
    short: "Anadolu Rulman",
    taxNo: "9876543210",
    phone: "+90 216 555 29 10",
    email: "satis@anadolurulman.com",
    city: "İstanbul",
    contact: "Derya Ak",
  },
];
export const orders = [
  {
    no: "SIP-2026-0072",
    customer: "Atlas Makine",
    orderDate: "16.07.2026",
    delivery: "05.08.2026",
    status: "Üretimde",
    total: "₺420.000",
    invoice: "FTR-2026-0718",
  },
  {
    no: "SIP-2026-0068",
    customer: "Eksen Otomotiv",
    orderDate: "10.07.2026",
    delivery: "28.07.2026",
    status: "Onaylandı",
    total: "₺186.500",
    invoice: "—",
  },
];
