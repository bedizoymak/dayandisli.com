export const cashAccounts = [
  { name: "Merkez Kasa", iban: "—", currency: "TRY", balance: "₺185.300" },
  {
    name: "Garanti BBVA",
    iban: "TR12 0006 2000 0000 1234 5678 90",
    currency: "TRY",
    balance: "₺4.820.000",
  },
  {
    name: "Akbank",
    iban: "TR34 0004 6000 0000 9876 5432 10",
    currency: "TRY",
    balance: "₺2.150.000",
  },
];
export const checks = [
  {
    issuer: "Atlas Makine",
    info: "Çek #847291",
    due: "31.07.2026",
    amount: "₺100.000",
    status: "Portföyde · Alınan Çek",
  },
  {
    issuer: "Marmara Metal",
    info: "Çek #224180",
    due: "15.08.2026",
    amount: "₺260.000",
    status: "Ödenecek · Verilen Çek",
  },
  {
    issuer: "Eksen Otomotiv",
    info: "Çek #910842",
    due: "20.07.2026",
    amount: "₺85.000",
    status: "Tahsil edilecek · Alınan Çek",
  },
];
export const cashMovements = [
  {
    type: "Giriş",
    date: "16.07.2026",
    party: "Atlas Makine",
    name: "Fatura Tahsilatı",
    amount: "₺420.000",
  },
  {
    type: "Çıkış",
    date: "15.07.2026",
    party: "SGK",
    name: "Prim Ödemesi",
    amount: "-₺148.250",
  },
  {
    type: "Çıkış",
    date: "14.07.2026",
    party: "Marmara Metal",
    name: "Tedarik Ödemesi",
    amount: "-₺284.400",
  },
];
export const cashChart = [35, 52, 44, 68, 58, 76, 62, 84, 73, 92, 79, 96];
export const cashFlowGrid = {
  periods: ["Bugün", "20 Tem", "27 Tem", "3 Ağu", "10 Ağu", "17 Ağu"],
  rows: [
    {
      label: "Dönem Başı Bakiyesi",
      values: ["₺7,15M", "₺7,24M", "₺7,08M", "₺7,32M", "₺7,18M", "₺7,46M"],
    },
    {
      label: "Tahsilatlar",
      values: ["₺420K", "₺180K", "₺510K", "₺240K", "₺620K", "₺310K"],
    },
    {
      label: "Ödemeler",
      values: ["-₺284K", "-₺340K", "-₺260K", "-₺390K", "-₺320K", "-₺275K"],
    },
    {
      label: "Tahmini Dönem Sonu Bakiyesi",
      values: ["₺7,29M", "₺7,08M", "₺7,33M", "₺7,18M", "₺7,48M", "₺7,50M"],
    },
    {
      label: "Tüm Ödemeler ile En Az",
      values: ["₺6,92M", "₺6,75M", "₺6,99M", "₺6,81M", "₺7,08M", "₺7,12M"],
    },
    {
      label: "Tüm Tahsilatlar ile En Fazla",
      values: ["₺7,57M", "₺7,42M", "₺7,70M", "₺7,61M", "₺7,91M", "₺7,88M"],
    },
  ],
};
export const flowTransactions = [
  {
    type: "Tahsilat",
    due: "20.07.2026",
    party: "Atlas Makine",
    description: "Satış faturası",
    out: "—",
    input: "₺420.000",
  },
  {
    type: "Ödeme",
    due: "29.07.2026",
    party: "Marmara Metal",
    description: "Sac alımı",
    out: "₺284.400",
    input: "—",
  },
];
