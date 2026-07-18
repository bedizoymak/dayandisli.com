import type { CrmCustomer } from "../crm-preview/crmCustomerTypes";
import type {
  CollectionTransaction,
  CustomerAccountType,
} from "./collectionTypes";

export const collectionDestinations = [
  { id: "cash-main", name: "Kasa Nakit", method: "cash" },
  { id: "garanti-try", name: "Garanti BBVA TL", method: "cash" },
  { id: "isbank-try", name: "Türkiye İş Bankası TL", method: "cash" },
  { id: "yapikredi-try", name: "Yapı Kredi TL", method: "cash" },
  { id: "cheque-portfolio", name: "Çek Portföyü", method: "cheque" },
] as const;

export const accountLabel = (type: CustomerAccountType) =>
  type === "official" ? "Resmi" : "Gayri Resmi";

export const formatTry = (amount: number) =>
  new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(amount);

export const formatPreviewDate = (date: string) =>
  new Intl.DateTimeFormat("tr-TR").format(new Date(`${date}T12:00:00`));

export function getCustomerCollections(
  transactions: CollectionTransaction[],
  customerId: string,
  accountType: CustomerAccountType,
) {
  return transactions.filter(
    (transaction) =>
      transaction.customerId === customerId &&
      transaction.accountType === accountType,
  );
}

export function getCashAccountCollections(
  transactions: CollectionTransaction[],
  accountId?: string,
) {
  return transactions.filter(
    (transaction) =>
      transaction.method === "cash" &&
      transaction.status !== "cancelled" &&
      (!accountId || transaction.destinationAccountId === accountId),
  );
}

export function getIncomingCheques(transactions: CollectionTransaction[]) {
  return transactions.filter(
    (transaction) =>
      transaction.method === "cheque" && transaction.status !== "cancelled",
  );
}

export function calculateCustomerAccountSummary(
  transactions: CollectionTransaction[],
  customerId: string,
  accountType: CustomerAccountType,
  base: {
    planned: string;
    collected: string;
    balance: string;
    overdue: string;
    upcoming: string;
    shares: number[];
  },
) {
  const added = getCustomerCollections(transactions, customerId, accountType)
    .filter((transaction) => transaction.status !== "cancelled")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const numeric = (value: string) =>
    Number(
      value
        .replace(/[^\d,-]/g, "")
        .replace(/\./g, "")
        .replace(",", "."),
    );
  const planned = numeric(base.planned);
  const collected = numeric(base.collected) + added;
  const balance = Math.max(0, numeric(base.balance) - added);
  const overdue = numeric(base.overdue);
  const upcoming = numeric(base.upcoming);
  const paidShare =
    planned > 0 ? Math.min(100, (collected / planned) * 100) : 0;
  const overdueShare = planned > 0 ? (overdue / planned) * 100 : 0;
  return {
    planned: formatTry(planned),
    collected: formatTry(collected),
    balance: formatTry(balance),
    overdue: formatTry(overdue),
    upcoming: formatTry(upcoming),
    shares: [
      paidShare,
      overdueShare,
      Math.max(0, 100 - paidShare - overdueShare),
    ],
  };
}

export function getCollectionActivity(
  transactions: CollectionTransaction[],
  customer: CrmCustomer,
) {
  return transactions
    .filter((transaction) => transaction.customerId === customer.id)
    .map((transaction) => ({
      id: transaction.id,
      text: `${formatTry(transaction.amount)} ${transaction.method === "cash" ? "nakit tahsilat" : "çek tahsilatı"} ${transaction.accountType === "official" ? "Resmi Hesaba" : "Gayri Resmi Hesaba"} eklendi.`,
      timestamp: new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(transaction.createdAt)),
      actor: transaction.createdBy,
      method: transaction.method,
      accountType: transaction.accountType,
    }));
}
