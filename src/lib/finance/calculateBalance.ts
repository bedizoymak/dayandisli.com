import type {
  AccountType,
  FinanceDashboardSummary,
  FinancialTransaction,
  FinancialTransactionType,
  PartyFinancialSummary,
  PartyType,
} from "./financeTypes";

function transactionSign(partyType: PartyType, transactionType: FinancialTransactionType) {
  if (partyType === "customer") {
    if (transactionType === "debit" || transactionType === "payment_out") return 1;
    if (transactionType === "credit" || transactionType === "payment_in" || transactionType === "refund") return -1;
    return 1;
  }

  if (partyType === "supplier") {
    if (transactionType === "debit" || transactionType === "payment_out") return -1;
    if (transactionType === "credit" || transactionType === "payment_in" || transactionType === "refund") return 1;
    return -1;
  }

  return transactionType === "payment_in" || transactionType === "credit" ? -1 : 1;
}

export function getSignedAmount(transaction: Pick<FinancialTransaction, "party_type" | "transaction_type" | "amount" | "status">) {
  if (transaction.status === "cancelled") return 0;
  return Number(transaction.amount || 0) * transactionSign(transaction.party_type, transaction.transaction_type);
}

export function calculatePartyFinancialSummary(transactions: FinancialTransaction[]): PartyFinancialSummary {
  const activeTransactions = transactions.filter((transaction) => transaction.status !== "cancelled");
  const currentBalance = activeTransactions.reduce((sum, transaction) => sum + getSignedAmount(transaction), 0);
  const officialBalance = activeTransactions
    .filter((transaction) => transaction.account_type === "official")
    .reduce((sum, transaction) => sum + getSignedAmount(transaction), 0);
  const operationalBalance = activeTransactions
    .filter((transaction) => transaction.account_type === "operational")
    .reduce((sum, transaction) => sum + getSignedAmount(transaction), 0);
  const totalDebit = activeTransactions
    .filter((transaction) => transaction.transaction_type === "debit")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const totalCredit = activeTransactions
    .filter((transaction) => transaction.transaction_type === "credit")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const totalPayment = activeTransactions
    .filter((transaction) => transaction.transaction_type === "payment_in" || transaction.transaction_type === "payment_out")
    .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
  const lastTransactionDate = activeTransactions
    .map((transaction) => transaction.transaction_date)
    .sort()
    .at(-1) || null;

  return {
    totalDebit,
    totalCredit,
    totalPayment,
    currentBalance,
    officialBalance,
    operationalBalance,
    lastTransactionDate,
    statusLabel: currentBalance > 0 ? "Alacak" : currentBalance < 0 ? "Borç" : "Kapalı",
  };
}

export function calculateFinanceDashboardSummary(transactions: FinancialTransaction[]): FinanceDashboardSummary {
  const today = new Date().toISOString().slice(0, 10);
  const activeTransactions = transactions.filter((transaction) => transaction.status !== "cancelled");
  const balanceByAccount = (accountType: AccountType) =>
    activeTransactions
      .filter((transaction) => transaction.account_type === accountType)
      .reduce((sum, transaction) => sum + getSignedAmount(transaction), 0);

  const netBalance = activeTransactions.reduce((sum, transaction) => sum + getSignedAmount(transaction), 0);

  return {
    totalReceivable: Math.max(netBalance, 0),
    totalPayable: Math.abs(Math.min(netBalance, 0)),
    collected: activeTransactions
      .filter((transaction) => transaction.transaction_type === "payment_in")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
    paid: activeTransactions
      .filter((transaction) => transaction.transaction_type === "payment_out")
      .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0),
    pendingPayments: activeTransactions.filter((transaction) => transaction.status === "pending" || transaction.status === "planned").length,
    overduePayments: activeTransactions.filter((transaction) => transaction.due_date && transaction.due_date < today && transaction.status !== "completed").length,
    officialBalance: balanceByAccount("official"),
    operationalBalance: balanceByAccount("operational"),
  };
}
