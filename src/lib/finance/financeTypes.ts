export type PartyType = "customer" | "supplier" | "both";
export type PartyEntityType = "individual" | "company";
export type AccountType = "official" | "operational";
export type FinancialTransactionType = "debit" | "credit" | "payment_in" | "payment_out" | "refund" | "adjustment";
export type FinancialDirection = "in" | "out";
export type PaymentMethod = "cash" | "bank_transfer" | "credit_card" | "cheque" | "promissory_note" | "other";
export type TransactionStatus = "planned" | "pending" | "completed" | "cancelled";
export type PaymentDocumentType = "cheque" | "promissory_note" | "receipt" | "bank_receipt" | "other";
export type PaymentDocumentStatus = "pending" | "collected" | "paid" | "cancelled" | "returned";

export type Party = {
  id: string;
  party_type: PartyType;
  entity_type: PartyEntityType;
  title: string;
  contact_name: string | null;
  tax_or_identity_no: string | null;
  tax_office: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  district: string | null;
  default_account_type: AccountType;
  currency: string;
  payment_term_days: number;
  risk_limit: number;
  category: string | null;
  tags: string[] | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type FinancialTransaction = {
  id: string;
  party_id: string;
  party_type: Exclude<PartyType, "both">;
  account_type: AccountType;
  transaction_type: FinancialTransactionType;
  direction: FinancialDirection;
  amount: number;
  currency: string;
  transaction_date: string;
  due_date: string | null;
  payment_method: PaymentMethod | null;
  order_id: string | null;
  quotation_id: string | null;
  reference_no: string | null;
  description: string | null;
  status: TransactionStatus;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  party?: Pick<Party, "title" | "party_type"> | null;
};

export type PaymentDocument = {
  id: string;
  party_id: string;
  transaction_id: string | null;
  document_type: PaymentDocumentType;
  document_no: string | null;
  bank_name: string | null;
  branch_name: string | null;
  due_date: string | null;
  amount: number;
  currency: string;
  status: PaymentDocumentStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  party?: Pick<Party, "title" | "party_type"> | null;
};

export type PartyNote = {
  id: string;
  party_id: string;
  note: string;
  created_at: string;
  created_by: string | null;
};

export type PartyFinancialSummary = {
  totalDebit: number;
  totalCredit: number;
  totalPayment: number;
  currentBalance: number;
  officialBalance: number;
  operationalBalance: number;
  lastTransactionDate: string | null;
  statusLabel: "Alacak" | "Borç" | "Kapalı";
};

export type FinanceDashboardSummary = {
  totalReceivable: number;
  totalPayable: number;
  collected: number;
  paid: number;
  pendingPayments: number;
  overduePayments: number;
  officialBalance: number;
  operationalBalance: number;
};

export type PartyFilters = {
  type?: PartyType | "all";
  search?: string;
  active?: "all" | "active" | "passive";
  accountType?: AccountType | "all";
  balance?: "all" | "receivable" | "payable" | "zero";
};

export type FinanceFilters = {
  partyId?: string;
  accountType?: AccountType | "all";
  status?: TransactionStatus | "all";
};
