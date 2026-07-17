export type FinancePreviewPage = {
  id: string;
  label: string;
  route?: string;
  permissionKey?: string;
};

export type FinancePreviewGroup = {
  id: string;
  label: string;
  permissionKey?: string;
  pages: FinancePreviewPage[];
};

export const financeNavigation: FinancePreviewGroup[] = [
  {
    id: "income",
    label: "Gelir Yönetimi",
    permissionKey: "finance.income",
    pages: [
      {
        id: "invoices",
        label: "Faturalar",
        route: "/apps/ebru-preview/finance/income/invoices",
        permissionKey: "finance.income.invoices",
      },
      {
        id: "customers",
        label: "Müşteriler",
        route: "/apps/ebru-preview/finance/income/customers",
        permissionKey: "finance.income.customers",
      },
      {
        id: "collections-report",
        label: "Tahsilat Raporu",
        route: "/apps/ebru-preview/finance/income/collection-report",
        permissionKey: "finance.income.collection_report",
      },
    ],
  },
  {
    id: "expenses",
    label: "Gider Yönetimi",
    permissionKey: "finance.expenses",
    pages: [
      {
        id: "expense-list",
        label: "Gider Listesi",
        route: "/apps/ebru-preview/finance/expense/list",
        permissionKey: "finance.expense.list",
      },
      {
        id: "incoming-invoices",
        label: "Gelen Faturalar",
        route: "/apps/ebru-preview/finance/expense/incoming-invoices",
        permissionKey: "finance.expense.incoming_invoices",
      },
      {
        id: "income-expense-report",
        label: "Gelir-Gider Raporu",
        route: "/apps/ebru-preview/finance/expense/income-expense-report",
        permissionKey: "finance.reports",
      },
      {
        id: "payments-report",
        label: "Ödemeler Raporu",
        route: "/apps/ebru-preview/finance/expense/payments-report",
        permissionKey: "finance.reports",
      },
      {
        id: "vat-report",
        label: "KDV Raporu",
        route: "/apps/ebru-preview/finance/expense/vat-report",
        permissionKey: "finance.reports",
      },
    ],
  },
  {
    id: "purchasing",
    label: "Satın Alma",
    permissionKey: "purchasing.view",
    pages: [
      {
        id: "orders",
        label: "Siparişler",
        route: "/apps/ebru-preview/finance/purchasing/orders",
        permissionKey: "purchasing.view",
      },
      {
        id: "suppliers",
        label: "Tedarikçiler",
        route: "/apps/ebru-preview/finance/purchasing/suppliers",
        permissionKey: "crm.view",
      },
    ],
  },
  {
    id: "cash",
    label: "Kasa",
    permissionKey: "finance.cash",
    pages: [
      {
        id: "cash-accounts",
        label: "Kasa ve Bankalar",
        route: "/apps/ebru-preview/finance/cash/accounts",
        permissionKey: "finance.cash.accounts",
      },
      {
        id: "checks",
        label: "Çekler",
        route: "/apps/ebru-preview/finance/cash/checks",
        permissionKey: "finance.cash.checks",
      },
      {
        id: "cash-bank-report",
        label: "Kasa / Banka Raporu",
        route: "/apps/ebru-preview/finance/cash/cash-bank-report",
        permissionKey: "finance.cash.reports",
      },
      {
        id: "cash-flow",
        label: "Nakit Akış Raporu",
        route: "/apps/ebru-preview/finance/cash/cash-flow-report",
        permissionKey: "finance.cash.reports",
      },
    ],
  },
  {
    id: "inventory",
    label: "Stok Yönetimi",
    permissionKey: "inventory.view",
    pages: [
      {
        id: "products",
        label: "Hizmet ve Ürünler",
        route: "/apps/ebru-preview/finance/inventory/products",
        permissionKey: "inventory.view",
      },
      {
        id: "outgoing-dispatches",
        label: "Giden İrsaliyeler",
        route: "/apps/ebru-preview/finance/inventory/outgoing-dispatches",
        permissionKey: "inventory.view",
      },
      {
        id: "incoming-dispatches",
        label: "Gelen İrsaliyeler",
        route: "/apps/ebru-preview/finance/inventory/incoming-dispatches",
        permissionKey: "inventory.view",
      },
      {
        id: "stock-history",
        label: "Stok Geçmişi",
        route: "/apps/ebru-preview/finance/inventory/history",
        permissionKey: "inventory.view",
      },
      {
        id: "stock-report",
        label: "Stoktaki Ürünler Raporu",
        route: "/apps/ebru-preview/finance/inventory/report",
        permissionKey: "inventory.view",
      },
    ],
  },
];

export const financeOverviewData = {
  receivables: [
    { label: "Toplam Tahsil Edilecek", value: "₺ 3,44M", tone: "blue" },
    { label: "Gecikmiş Tahsilat", value: "₺ 3,34M", tone: "red" },
    { label: "Fatura Yok", value: "₺ 0", tone: "muted" },
  ],
  receivableDetails: [
    { label: "Yazdırılmamış / Gönderilmemiş", value: "0" },
    { label: "Tekrarlayan", value: "0" },
  ],
  payables: [
    { label: "Toplam Ödenecek", value: "₺ 1,62M", tone: "green" },
    { label: "Gecikmiş Ödemeler", value: "₺ 1,30M", tone: "red" },
    { label: "Planlanmamış", value: "₺ 199K", tone: "orange" },
  ],
  payableDetails: [
    { label: "Bu Ay Oluşan KDV", value: "₺ 201.009" },
    { label: "Tekrarlayan", value: "0" },
  ],
  accounts: [
    {
      name: "GARANTİ BBVA",
      balance: "₺ 4.820.000",
      detail: "Vadesiz TL Hesabı",
    },
    { name: "AKBANK", balance: "₺ 2.150.000", detail: "Vadesiz TL Hesabı" },
    { name: "KASA", balance: "₺ 185.300", detail: "Merkez Kasa" },
  ],
  cashFlow: [
    { label: "Toplam Bakiye", value: "₺ 9,83M" },
    { label: "Toplam Tahsilat", value: "₺ 100K", tone: "cyan" },
    { label: "Toplam Ödeme", value: "₺ 118,5K", tone: "orange" },
    { label: "Tahmini Dönem Sonu", value: "₺ 9,81M" },
  ],
  weeks: [
    "Bugün",
    "20 Tem",
    "27 Tem",
    "3 Ağu",
    "10 Ağu",
    "17 Ağu",
    "24 Ağu",
    "31 Ağu",
    "7 Eyl",
    "14 Eyl",
    "21 Eyl",
    "28 Eyl",
  ],
  timeline: [
    { timing: "1 ay sonra", title: "Ödeme: ₺ 540", status: "upcoming" },
    { timing: "1 ay sonra", title: "Ödeme: ₺ 648", status: "upcoming" },
    {
      timing: "15 gün sonra",
      title: "Çek ödemesi: ₺ 100.000",
      status: "upcoming",
    },
    {
      timing: "15 gün sonra",
      title: "Çek tahsilatı: ₺ 100.000",
      status: "upcoming",
    },
    { timing: "248 gün gecikti", title: "Ödeme: ₺ 3.159", status: "overdue" },
    {
      timing: "287 gün gecikti",
      title: "Tahsilat: ₺ 14.920",
      status: "overdue",
    },
    {
      timing: "370 gün gecikti",
      title: "Tahsilat: ₺ 160.397",
      status: "overdue",
    },
    {
      timing: "577 gün gecikti",
      title: "Tahsilat: ₺ 4.820",
      status: "overdue",
    },
  ],
};
