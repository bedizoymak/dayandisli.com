export type CashAccount = {
  name: string;
  iban: string;
  currency: string;
  balance: string;
};

export type Check = {
  issuer: string;
  info: string;
  due: string;
  amount: string;
  status: string;
};

export type CashMovement = {
  type: string;
  date: string;
  party: string;
  name: string;
  amount: string;
};

export type CashFlowRow = {
  label: string;
  values: string[];
};

export type FlowTransaction = {
  type: string;
  due: string;
  party: string;
  description: string;
  out: string;
  input: string;
};

export const cashAccounts: CashAccount[] = [];
export const checks: Check[] = [];
export const cashMovements: CashMovement[] = [];
export const cashChart: number[] = [];
export const cashFlowGrid: { periods: string[]; rows: CashFlowRow[] } = {
  periods: [],
  rows: [],
};
export const flowTransactions: FlowTransaction[] = [];
