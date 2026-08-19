export type CheckSource = "parasut" | "erp";
export type CheckDirection = "received" | "issued";
export type CheckCurrency = "TRY" | "USD" | "EUR";

export type CheckEffectiveStatus =
  | "open"
  | "upcoming"
  | "due_today"
  | "overdue"
  | "paid"
  | "cancelled"
  | "returned";

export type CheckTerminalStatus = "paid" | "cancelled" | "returned";
export type CheckSortField = "dueDate" | "originalAmount" | "remainingAmount" | "effectiveStatus";
export type CheckSortDirection = "asc" | "desc";

export type CheckParty = {
  parasutId: string | null;
  localQuoteCustomerId: string | null;
  name: string | null;
  assigned: boolean;
};

export type CheckListRow = {
  id: string;
  source: CheckSource;
  sourceLabel: "Paraşüt" | "ERP";
  direction: CheckDirection | null;
  party: CheckParty;
  bankName: string | null;
  checkNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: CheckCurrency | null;
  originalAmount: number | null;
  remainingAmount: number | null;
  settlementStatus: string;
  effectiveStatus: CheckEffectiveStatus;
  paidAt: string | null;
  notes: string | null;
  syncedAt: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  editable: boolean;
  statusEditable: boolean;
  partyLinkEditable?: boolean;
};

export type CheckListFilters = {
  source?: CheckSource;
  direction?: CheckDirection;
  effectiveStatus?: CheckEffectiveStatus;
  dueFrom?: string;
  dueTo?: string;
  partyId?: string;
  contactParasutId?: string | null;
  partySearch?: string;
  bank?: string;
  currency?: CheckCurrency;
  openOnly?: boolean;
};

export type CheckSort = {
  field: CheckSortField;
  direction: CheckSortDirection;
};

export type CheckListQuery = {
  page?: number;
  pageSize?: number;
  search?: string;
  filters?: CheckListFilters;
  sort?: CheckSort;
  companyId?: string;
};

export type CheckListResponse = {
  rows: CheckListRow[];
  total: number;
  page: number;
  pageSize: number;
  latestSyncAt: string | null;
};

export type CheckDetailResponse = {
  record: CheckListRow;
  history: CheckHistoryEntry[];
};

export type CheckHistoryEntry = {
  id: string;
  eventType: string;
  fromStatus: string | null;
  toStatus: string | null;
  note: string | null;
  createdAt: string | null;
};

export type CheckPartyOption = {
  parasutId: string;
  name: string;
  accountType: "customer" | "supplier";
};

export type CheckWriteInput = {
  direction: CheckDirection;
  contactParasutId?: string | null;
  localQuoteCustomerId?: string;
  contactSnapshotName?: string | null;
  bankName?: string;
  checkNumber?: string;
  issueDate?: string;
  dueDate?: string;
  currency: CheckCurrency;
  originalAmount: number;
  settlementStatus?: "open" | "paid";
  notes?: string;
};

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string };
