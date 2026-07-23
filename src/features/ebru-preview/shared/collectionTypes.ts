export type CustomerAccountType = "official" | "unofficial";
export type CollectionMethod = "cash" | "cheque";
export type CollectionStatus =
  "received" | "pending" | "cleared" | "bounced" | "cancelled";

export type CollectionTransaction = {
  id: string;
  customerId: string;
  accountType: CustomerAccountType;
  method: CollectionMethod;
  transactionDate: string;
  dueDate?: string;
  amount: number;
  currency: "TRY" | "USD" | "EUR";
  description?: string;
  destinationAccountId: string;
  destinationAccountName: string;
  chequeNumber?: string;
  chequeBank?: string;
  chequeBranch?: string;
  drawerName?: string;
  relatedInvoiceId?: string;
  relatedProjectId?: string;
  status: CollectionStatus;
  createdAt: string;
  createdBy: string;
};

export type NewCollectionTransaction = Omit<
  CollectionTransaction,
  "id" | "createdAt" | "status"
>;
