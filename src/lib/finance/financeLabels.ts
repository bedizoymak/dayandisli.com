import type {
  AccountType,
  FinancialTransactionType,
  PaymentDocumentStatus,
  PaymentDocumentType,
  PaymentMethod,
  TransactionStatus,
} from "./financeTypes";

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  official: "Resmi Hesap",
  operational: "Operasyonel Takip",
};

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Nakit",
  bank_transfer: "Banka Havalesi/EFT",
  credit_card: "Kredi Kartı",
  cheque: "Çek",
  promissory_note: "Senet",
  other: "Diğer",
};

export const TRANSACTION_TYPE_LABELS: Record<FinancialTransactionType, string> = {
  debit: "Borçlandırma",
  credit: "Alacaklandırma",
  payment_in: "Tahsilat",
  payment_out: "Ödeme",
  refund: "İade",
  adjustment: "Düzeltme",
};

export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  planned: "Planlandı",
  pending: "Bekliyor",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

export const PAYMENT_DOCUMENT_TYPE_LABELS: Record<PaymentDocumentType, string> = {
  cheque: "Çek",
  promissory_note: "Senet",
  receipt: "Makbuz",
  bank_receipt: "Banka Dekontu",
  other: "Diğer",
};

export const PAYMENT_DOCUMENT_STATUS_LABELS: Record<PaymentDocumentStatus, string> = {
  pending: "Bekliyor",
  collected: "Tahsil Edildi",
  paid: "Ödendi",
  cancelled: "İptal",
  returned: "İade",
};

export function formatMoney(amount: number, currency = "TRY") {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}
