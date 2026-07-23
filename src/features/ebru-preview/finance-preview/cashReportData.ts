export const cashAccounts: { name: string; iban: string; currency: string; balance: string }[] = [];
export const checks: { issuer: string; info: string; due: string; amount: string; status: string }[] = [];
export const cashMovements: { type: string; date: string; party: string; name: string; amount: string }[] = [];
export const cashChart: number[] = [];
export const cashFlowGrid = {
  periods: [] as string[],
  rows: [] as { label: string; values: string[] }[],
};
export const flowTransactions: { type: string; due: string; party: string; description: string; out: string; input: string }[] = [];
