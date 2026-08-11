export type ReportDistribution = {
  name: string;
  amount: string;
  share: number;
};

export type AgingBucket = {
  label: string;
  value: number;
};

export type PendingPayment = {
  name: string;
  issue: string;
  due: string;
  delay: string;
  amount: string;
};

export type VatMonth = {
  month: string;
  calculated: string;
  deductible: string;
  net: string;
};

export type VatDetail = {
  type: string;
  no: string;
  name: string;
  party: string;
  date: string;
  vat: string;
};

export const incomeExpenseReport: {
  income: ReportDistribution[];
  expense: ReportDistribution[];
  totals: { income: string; expense: string; net: string };
} = {
  income: [],
  expense: [],
  totals: { income: "—", expense: "—", net: "—" },
};

export const paymentAging: AgingBucket[] = [];
export const pendingPayments: PendingPayment[] = [];
export const vatMonths: VatMonth[] = [];
export const vatDetails: VatDetail[] = [];
