// Platform-independent business logic for the checks-api Edge Function.
// The repository port is implemented in index.ts so these exact handlers can
// be exercised by Vitest without importing Deno or a real Supabase client.
//
// Source boundary:
// - parasut.checks is authoritative for every Paraşüt financial field.
// - payment_instruments rows with source=parasut_mirror are optional ERP-only
//   overlays. They may supply an explicit party link, but never override the
//   mirror's amount, currency, dates, bank, number, status or notes.
// - provider writes are not represented anywhere in this module.


export type CheckDirection = "received" | "issued";
export type CheckCurrency = "TRY" | "USD" | "EUR";
export type LocalSettlementStatus = "open" | "paid" | "cancelled" | "returned";
export type EffectiveCheckStatus = "upcoming" | "due_today" | "overdue" | "paid" | "cancelled" | "returned";
export type CheckSource = "parasut" | "erp";

export interface MirrorCheckRow {
  parasut_id: string;
  company_id: string;
  attributes: Record<string, unknown> | null;
  relationships?: Record<string, unknown> | null;
  source_archived: boolean | null;
  synced_at?: string | null;
  last_seen_at?: string | null;
  net_total?: number | string | null;
  remaining?: number | string | null;
  issued_by_parasut_id?: string | null;
  given_to_parasut_id?: string | null;
}

export interface PaymentInstrumentRow {
  id: string;
  company_id: string;
  source: "erp_local" | "parasut_mirror";
  external_parasut_id: string | null;
  instrument_type: "check";
  direction: CheckDirection;
  contact_parasut_id: string | null;
  local_quote_customer_id: string | null;
  contact_snapshot_name: string | null;
  bank_name: string | null;
  check_number: string | null;
  issue_date: string | null;
  due_date: string;
  currency: CheckCurrency;
  original_amount: number | string;
  remaining_amount: number | string;
  settlement_status: LocalSettlementStatus;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentInstrumentEventRow {
  id: string;
  payment_instrument_id: string;
  company_id: string;
  event_type: string;
  previous_settlement_status: LocalSettlementStatus | null;
  new_settlement_status: LocalSettlementStatus | null;
  actor_user_id: string | null;
  note: string | null;
  changes: Record<string, unknown>;
  occurred_at: string;
}

export interface MirrorContactRow {
  parasut_id: string;
  company_id: string;
  attributes: Record<string, unknown> | null;
  source_archived: boolean | null;
}

export interface UnifiedCheck {
  id: string;
  localId: string | null;
  externalParasutId: string | null;
  source: CheckSource;
  sourceLabel: "Paraşüt" | "ERP";
  direction: CheckDirection | null;
  party: {
    parasutId: string | null;
    localQuoteCustomerId: string | null;
    name: string | null;
    assigned: boolean;
  };
  bankName: string | null;
  checkNumber: string | null;
  issueDate: string | null;
  dueDate: string | null;
  currency: CheckCurrency | null;
  originalAmount: number | null;
  remainingAmount: number | null;
  settlementStatus: LocalSettlementStatus;
  effectiveStatus: EffectiveCheckStatus;
  paidAt: string | null;
  notes: string | null;
  syncedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  editable: boolean;
  statusEditable: boolean;
  partyLinkEditable: boolean;
}

export interface UnifiedCheckHistoryEvent {
  id: string;
  eventType: string;
  fromStatus: LocalSettlementStatus | null;
  toStatus: LocalSettlementStatus | null;
  note: string | null;
  createdAt: string;
}

export interface ChecksRepository {
  listMirrorChecks(companyId: string): Promise<MirrorCheckRow[]>;
  listLocalInstruments(companyId: string): Promise<PaymentInstrumentRow[]>;
  getMirrorCheck(companyId: string, parasutId: string): Promise<MirrorCheckRow | null>;
  getLocalInstrument(companyId: string, id: string): Promise<PaymentInstrumentRow | null>;
  getMirrorOverlay(companyId: string, parasutId: string): Promise<PaymentInstrumentRow | null>;
  listMirrorContacts(companyId: string, parasutIds: string[]): Promise<MirrorContactRow[]>;
  getMirrorContact(companyId: string, parasutId: string): Promise<MirrorContactRow | null>;
  getLatestSuccessfulChecksSyncAt(companyId: string): Promise<string | null>;
  listEvents(companyId: string, instrumentId: string): Promise<PaymentInstrumentEventRow[]>;
  insertInstrument(values: Record<string, unknown>): Promise<PaymentInstrumentRow>;
  updateInstrument(companyId: string, id: string, values: Record<string, unknown>): Promise<PaymentInstrumentRow>;
  transitionInstrument(id: string, targetStatus: Exclude<LocalSettlementStatus, "open">, note: string | null): Promise<PaymentInstrumentRow>;
}

export class ChecksApiError extends Error {
  constructor(
    message: string,
    public readonly httpStatus = 400,
  ) {
    super(message);
    this.name = "ChecksApiError";
  }
}

export interface CheckListFilters {
  source?: CheckSource | "parasut_mirror" | "erp_local";
  direction?: CheckDirection;
  effectiveStatus?: EffectiveCheckStatus | "open";
  dueFrom?: string;
  dueTo?: string;
  contactParasutId?: string;
  /** Exact contact id alias used by the finance UI. */
  partyId?: string;
  /** Optional explicit party-name filter; list search also covers party name. */
  partySearch?: string;
  bank?: string;
  currency?: CheckCurrency;
  openOnly?: boolean;
}

export interface CheckListParams {
  page?: unknown;
  pageSize?: unknown;
  search?: unknown;
  filters?: CheckListFilters;
  sort?: {
    field?: "dueDate" | "originalAmount" | "remainingAmount" | "effectiveStatus";
    direction?: "asc" | "desc";
  };
}

export interface CheckListResult {
  rows: UnifiedCheck[];
  total: number;
  page: number;
  pageSize: number;
  latestSyncAt: string | null;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function number(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function date(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate || !DATE_PATTERN.test(candidate)) return null;
  const parsed = new Date(`${candidate}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== candidate ? null : candidate;
}

function currency(value: unknown): CheckCurrency | null {
  if (value === "TRY" || value === "TRL") return "TRY";
  return value === "USD" || value === "EUR" ? value : null;
}

function mirrorDirection(attributes: Record<string, unknown>): CheckDirection | null {
  if (attributes.is_in === true) return "received";
  if (attributes.is_out === true) return "issued";
  return null;
}

function mirrorSettlement(attributes: Record<string, unknown>, remainingAmount: number | null): LocalSettlementStatus {
  const status = text(attributes.payment_status)?.toLowerCase();
  if (remainingAmount !== null && remainingAmount <= 0) return "paid";
  if (attributes.is_cashed === true || status === "paid") return "paid";
  if (status === "cancelled" || status === "canceled") return "cancelled";
  if (status === "returned") return "returned";
  return "open";
}

function effectiveStatus(
  settlementStatus: LocalSettlementStatus,
  remainingAmount: number | null,
  dueDate: string | null,
  today: string,
): EffectiveCheckStatus {
  if (settlementStatus === "paid" || (remainingAmount !== null && remainingAmount <= 0)) return "paid";
  if (settlementStatus === "cancelled") return "cancelled";
  if (settlementStatus === "returned") return "returned";
  if (!dueDate || dueDate > today) return "upcoming";
  if (dueDate === today) return "due_today";
  return "overdue";
}

function partyFromOverlay(overlay: PaymentInstrumentRow | null): UnifiedCheck["party"] {
  const parasutId = overlay?.contact_parasut_id ?? null;
  const localQuoteCustomerId = overlay?.local_quote_customer_id ?? null;
  return {
    parasutId,
    localQuoteCustomerId,
    name: overlay?.contact_snapshot_name ?? null,
    assigned: Boolean(parasutId || localQuoteCustomerId),
  };
}

function relationshipContactId(relationships: Record<string, unknown> | null | undefined, key: string): string | null {
  const relationship = relationships && isRecord(relationships[key]) ? relationships[key] : null;
  const data = relationship && isRecord(relationship.data) ? relationship.data : null;
  const resourceType = data ? text(data.type) : null;
  if (!data || (resourceType && resourceType !== "contacts")) return null;
  return text(data.id);
}

function partyFromMirror(
  row: MirrorCheckRow,
  direction: CheckDirection | null,
  contact: MirrorContactRow | null,
): UnifiedCheck["party"] {
  const parasutId = direction === "received"
    ? text(row.issued_by_parasut_id) ?? relationshipContactId(row.relationships, "issued_by")
    : direction === "issued"
      ? text(row.given_to_parasut_id) ?? relationshipContactId(row.relationships, "given_to")
      : null;
  const expectedAccountType = direction === "received" ? "customer" : direction === "issued" ? "supplier" : null;
  const contactMatches = Boolean(
    parasutId
      && contact?.parasut_id === parasutId
      && contact.source_archived !== true
      && contact.attributes?.account_type === expectedAccountType,
  );
  return {
    parasutId,
    localQuoteCustomerId: null,
    name: contactMatches && contact
      ? text(contact.attributes?.name)
      : null,
    assigned: Boolean(parasutId),
  };
}

function currentIstanbulDate(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function normalizeMirrorCheck(
  row: MirrorCheckRow,
  overlay: PaymentInstrumentRow | null,
  today: string,
  sourceContact: MirrorContactRow | null = null,
): UnifiedCheck {
  const attributes = row.attributes ?? {};
  const direction = mirrorDirection(attributes);
  const mirrorParty = partyFromMirror(row, direction, sourceContact);
  const originalAmount = number(attributes.net_total) ?? number(row.net_total);
  // remaining_in_trl is an exchange-rate projection. Never substitute it
  // for the nominal remaining balance in the cheque's own currency.
  const remainingAmount = number(attributes.remaining) ?? number(row.remaining);
  const settlementStatus = mirrorSettlement(attributes, remainingAmount);
  const dueDate = date(attributes.due_date);
  const bankName = text(attributes.bank_name) ?? text(attributes.bank_identifier);

  return {
    id: `parasut:${row.parasut_id}`,
    localId: overlay?.id ?? null,
    externalParasutId: row.parasut_id,
    source: "parasut",
    sourceLabel: "Paraşüt",
    direction,
    party: mirrorParty.assigned ? mirrorParty : partyFromOverlay(overlay),
    bankName,
    checkNumber: text(attributes.serial_number),
    issueDate: date(attributes.issue_date),
    dueDate,
    currency: currency(attributes.currency),
    originalAmount,
    remainingAmount,
    settlementStatus,
    effectiveStatus: effectiveStatus(settlementStatus, remainingAmount, dueDate, today),
    paidAt: null,
    notes: text(attributes.description),
    syncedAt: text(row.synced_at) ?? text(row.last_seen_at),
    createdAt: null,
    updatedAt: null,
    editable: false,
    statusEditable: false,
    partyLinkEditable: !mirrorParty.assigned,
  };
}

export function normalizeLocalCheck(row: PaymentInstrumentRow, today: string): UnifiedCheck {
  const remainingAmount = number(row.remaining_amount);
  const originalAmount = number(row.original_amount);
  return {
    id: `erp:${row.id}`,
    localId: row.id,
    externalParasutId: null,
    source: "erp",
    sourceLabel: "ERP",
    direction: row.direction,
    party: partyFromOverlay(row),
    bankName: text(row.bank_name),
    checkNumber: text(row.check_number),
    issueDate: date(row.issue_date),
    dueDate: date(row.due_date),
    currency: currency(row.currency),
    originalAmount,
    remainingAmount,
    settlementStatus: row.settlement_status,
    effectiveStatus: effectiveStatus(row.settlement_status, remainingAmount, row.due_date, today),
    paidAt: text(row.paid_at),
    notes: text(row.notes),
    syncedAt: null,
    createdAt: text(row.created_at),
    updatedAt: text(row.updated_at),
    editable: row.settlement_status === "open",
    statusEditable: row.settlement_status === "open",
    partyLinkEditable: true,
  };
}

function parsePage(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 1;
}

function parsePageSize(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 25;
  return Math.min(Math.floor(parsed), 100);
}

function isOpenEffective(status: EffectiveCheckStatus): boolean {
  return status === "upcoming" || status === "due_today" || status === "overdue";
}

function normalizedSearch(value: unknown): string {
  return typeof value === "string" ? value.trim().toLocaleLowerCase("tr-TR") : "";
}

function includesSearch(row: UnifiedCheck, search: string): boolean {
  if (!search) return true;
  return [row.checkNumber, row.party.name, row.bankName, row.notes]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLocaleLowerCase("tr-TR").includes(search));
}

function matchesFilters(row: UnifiedCheck, filters: CheckListFilters): boolean {
  const requestedSource = filters.source === "parasut_mirror" ? "parasut" : filters.source === "erp_local" ? "erp" : filters.source;
  if (requestedSource && row.source !== requestedSource) return false;
  if (filters.direction && row.direction !== filters.direction) return false;
  if (filters.effectiveStatus === "open" && !isOpenEffective(row.effectiveStatus)) return false;
  if (filters.effectiveStatus && filters.effectiveStatus !== "open" && row.effectiveStatus !== filters.effectiveStatus) return false;
  if (filters.openOnly === true && !isOpenEffective(row.effectiveStatus)) return false;
  if (filters.dueFrom && (!row.dueDate || row.dueDate < filters.dueFrom)) return false;
  if (filters.dueTo && (!row.dueDate || row.dueDate > filters.dueTo)) return false;
  const requestedPartyId = filters.contactParasutId ?? filters.partyId;
  if (requestedPartyId && row.party.parasutId !== requestedPartyId) return false;
  if (filters.partySearch && !(row.party.name ?? "").toLocaleLowerCase("tr-TR").includes(filters.partySearch.trim().toLocaleLowerCase("tr-TR"))) return false;
  if (filters.bank && !(row.bankName ?? "").toLocaleLowerCase("tr-TR").includes(filters.bank.trim().toLocaleLowerCase("tr-TR"))) return false;
  if (filters.currency && row.currency !== filters.currency) return false;
  return true;
}

const STATUS_SORT_RANK: Record<EffectiveCheckStatus, number> = {
  due_today: 0,
  overdue: 1,
  upcoming: 2,
  paid: 3,
  returned: 4,
  cancelled: 5,
};

function compareNullable(left: string | number | null, right: string | number | null): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  if (typeof left === "number" && typeof right === "number") return left - right;
  return String(left).localeCompare(String(right));
}

function addDays(isoDate: string, days: number): string {
  const value = new Date(`${isoDate}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function defaultBucket(row: UnifiedCheck, today: string): number {
  if (!isOpenEffective(row.effectiveStatus)) return 3;
  const upcomingLimit = addDays(today, 7);
  if (row.dueDate && row.dueDate >= today && row.dueDate <= upcomingLimit) return 0;
  if (row.dueDate && row.dueDate < today) return 1;
  return 2;
}

function defaultCompare(left: UnifiedCheck, right: UnifiedCheck, today: string): number {
  const leftBucket = defaultBucket(left, today);
  const rightBucket = defaultBucket(right, today);
  const statusOrder = leftBucket - rightBucket;
  if (statusOrder !== 0) return statusOrder;
  // Bucket 0: today through seven days, nearest first. Bucket 1: overdue,
  // least overdue first. Bucket 2: later/undated open rows, dated first.
  // Bucket 3: every terminal state, always after all open rows.
  if (leftBucket === 1) return compareNullable(right.dueDate, left.dueDate) || left.id.localeCompare(right.id);
  return compareNullable(left.dueDate, right.dueDate) || left.id.localeCompare(right.id);
}

function sortRows(rows: UnifiedCheck[], sort: CheckListParams["sort"], today: string): UnifiedCheck[] {
  if (!sort?.field) return [...rows].sort((left, right) => defaultCompare(left, right, today));
  const multiplier = sort.direction === "desc" ? -1 : 1;
  return [...rows].sort((left, right) => {
    let comparison = 0;
    if (sort.field === "dueDate") comparison = compareNullable(left.dueDate, right.dueDate);
    if (sort.field === "originalAmount") comparison = compareNullable(left.originalAmount, right.originalAmount);
    if (sort.field === "remainingAmount") comparison = compareNullable(left.remainingAmount, right.remainingAmount);
    if (sort.field === "effectiveStatus") comparison = STATUS_SORT_RANK[left.effectiveStatus] - STATUS_SORT_RANK[right.effectiveStatus];
    return comparison === 0 ? left.id.localeCompare(right.id) : comparison * multiplier;
  });
}

export function combineChecks(
  mirrorRows: MirrorCheckRow[],
  localRows: PaymentInstrumentRow[],
  today: string,
  contactByParasutId: ReadonlyMap<string, MirrorContactRow> = new Map(),
): UnifiedCheck[] {
  const overlayByExternalId = new Map(
    localRows
      .filter((row) => row.source === "parasut_mirror" && row.external_parasut_id)
      .map((row) => [row.external_parasut_id as string, row]),
  );
  const mirror = mirrorRows
    .filter((row) => row.source_archived !== true)
    .map((row) => {
      const direction = mirrorDirection(row.attributes ?? {});
      const sourceParty = partyFromMirror(row, direction, null);
      const sourceContact = sourceParty.parasutId ? contactByParasutId.get(sourceParty.parasutId) ?? null : null;
      return normalizeMirrorCheck(row, overlayByExternalId.get(row.parasut_id) ?? null, today, sourceContact);
    });
  const local = localRows.filter((row) => row.source === "erp_local").map((row) => normalizeLocalCheck(row, today));
  return [...mirror, ...local];
}

export async function handleChecksList(
  repository: ChecksRepository,
  companyId: string,
  params: CheckListParams,
  today = currentIstanbulDate(),
): Promise<CheckListResult> {
  const [mirrorRows, localRows, latestSyncAt] = await Promise.all([
    repository.listMirrorChecks(companyId),
    repository.listLocalInstruments(companyId),
    repository.getLatestSuccessfulChecksSyncAt(companyId),
  ]);
  const sourcePartyIds = [...new Set(mirrorRows.flatMap((row) => {
    const party = partyFromMirror(row, mirrorDirection(row.attributes ?? {}), null);
    return party.parasutId ? [party.parasutId] : [];
  }))];
  const sourceContacts = sourcePartyIds.length
    ? await repository.listMirrorContacts(companyId, sourcePartyIds)
    : [];
  const contactByParasutId = new Map(sourceContacts.map((contact) => [contact.parasut_id, contact]));
  const filters = params.filters ?? {};
  const search = normalizedSearch(params.search);
  const rows = sortRows(
    combineChecks(mirrorRows, localRows, today, contactByParasutId)
      .filter((row) => includesSearch(row, search) && matchesFilters(row, filters)),
    params.sort,
    today,
  );
  const page = parsePage(params.page);
  const pageSize = parsePageSize(params.pageSize);
  const from = (page - 1) * pageSize;
  return { rows: rows.slice(from, from + pageSize), total: rows.length, page, pageSize, latestSyncAt };
}

export type ParsedCheckId = { source: CheckSource; rawId: string };

export function parseCheckId(value: unknown): ParsedCheckId {
  if (typeof value !== "string") throw new ChecksApiError("Çek kimliği gerekli.", 400);
  const separator = value.indexOf(":");
  const prefix = separator > 0 ? value.slice(0, separator) : "";
  const rawId = separator > 0 ? value.slice(separator + 1).trim() : "";
  if ((prefix !== "parasut" && prefix !== "erp") || !rawId) throw new ChecksApiError("Geçersiz çek kimliği.", 400);
  return { source: prefix, rawId };
}

async function resolveCheck(
  repository: ChecksRepository,
  companyId: string,
  parsed: ParsedCheckId,
  today: string,
): Promise<{ record: UnifiedCheck; localRow: PaymentInstrumentRow | null; mirrorRow: MirrorCheckRow | null }> {
  if (parsed.source === "erp") {
    const localRow = await repository.getLocalInstrument(companyId, parsed.rawId);
    if (!localRow || localRow.source !== "erp_local") throw new ChecksApiError("Çek bulunamadı.", 404);
    return { record: normalizeLocalCheck(localRow, today), localRow, mirrorRow: null };
  }
  const [mirrorRow, overlay] = await Promise.all([
    repository.getMirrorCheck(companyId, parsed.rawId),
    repository.getMirrorOverlay(companyId, parsed.rawId),
  ]);
  if (!mirrorRow || mirrorRow.source_archived === true) throw new ChecksApiError("Çek bulunamadı.", 404);
  const sourceParty = partyFromMirror(mirrorRow, mirrorDirection(mirrorRow.attributes ?? {}), null);
  const sourceContact = sourceParty.parasutId
    ? await repository.getMirrorContact(companyId, sourceParty.parasutId)
    : null;
  return { record: normalizeMirrorCheck(mirrorRow, overlay, today, sourceContact), localRow: overlay, mirrorRow };
}

export async function handleChecksDetail(
  repository: ChecksRepository,
  companyId: string,
  id: unknown,
  today = currentIstanbulDate(),
): Promise<{ record: UnifiedCheck; history: UnifiedCheckHistoryEvent[] }> {
  const resolved = await resolveCheck(repository, companyId, parseCheckId(id), today);
  const rawHistory = resolved.localRow ? await repository.listEvents(companyId, resolved.localRow.id) : [];
  const history = rawHistory.map((event) => ({
    id: event.id,
    eventType: event.event_type,
    fromStatus: event.previous_settlement_status,
    toStatus: event.new_settlement_status,
    note: event.note,
    createdAt: event.occurred_at,
  }));
  return { record: resolved.record, history };
}

function requireDirection(value: unknown): CheckDirection {
  if (value !== "received" && value !== "issued") throw new ChecksApiError("Geçerli çek türü gerekli.");
  return value;
}

function requireCurrency(value: unknown): CheckCurrency {
  const parsed = currency(value);
  if (!parsed) throw new ChecksApiError("Para birimi TRY, USD veya EUR olmalıdır.");
  return parsed;
}

function requireDate(value: unknown, label: string): string {
  const parsed = date(value);
  if (!parsed) throw new ChecksApiError(`${label} geçerli bir tarih olmalıdır.`);
  return parsed;
}

function requirePositiveAmount(value: unknown): number {
  const parsed = number(value);
  if (parsed === null || parsed <= 0) throw new ChecksApiError("Tutar sıfırdan büyük olmalıdır.");
  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function nullableText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string") throw new ChecksApiError("Metin alanı geçersiz.");
  return text(value);
}

function optionalUuidLike(value: unknown, label: string): string | null {
  const parsed = nullableText(value);
  if (!parsed) return null;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(parsed)) {
    throw new ChecksApiError(`${label} geçersiz.`);
  }
  return parsed;
}

async function validateContact(
  repository: ChecksRepository,
  companyId: string,
  parasutId: string,
  direction: CheckDirection,
): Promise<{ id: string; name: string }> {
  const contact = await repository.getMirrorContact(companyId, parasutId);
  if (!contact || contact.source_archived === true) throw new ChecksApiError("Seçilen müşteri/tedarikçi bulunamadı.", 422);
  const attributes = contact.attributes ?? {};
  const expectedAccountType = direction === "received" ? "customer" : "supplier";
  if (attributes.account_type !== expectedAccountType) {
    throw new ChecksApiError(
      direction === "received"
        ? "Alınan çek yalnız Paraşüt müşterisine bağlanabilir."
        : "Verilen çek yalnız Paraşüt tedarikçisine bağlanabilir.",
      422,
    );
  }
  const name = text(attributes.name);
  if (!name) throw new ChecksApiError("Seçilen tarafın adı bulunamadı.", 422);
  return { id: contact.parasut_id, name };
}

function createInput(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new ChecksApiError("Çek bilgileri gerekli.");
  return value;
}

export async function handleCreateCheck(
  repository: ChecksRepository,
  companyId: string,
  inputValue: unknown,
  today = currentIstanbulDate(),
): Promise<{ record: UnifiedCheck }> {
  const input = createInput(inputValue);
  const direction = requireDirection(input.direction);
  const contactParasutId = nullableText(input.contactParasutId);
  const localQuoteCustomerId = optionalUuidLike(input.localQuoteCustomerId, "Yerel müşteri kimliği");
  if (contactParasutId && localQuoteCustomerId) throw new ChecksApiError("Yalnız bir taraf kaynağı seçilebilir.");
  if (localQuoteCustomerId) {
    throw new ChecksApiError("Yerel teklif müşterileri henüz şirket bazlı olmadığı için çeke bağlanamaz.", 422);
  }
  const contact = contactParasutId ? await validateContact(repository, companyId, contactParasutId, direction) : null;
  const originalAmount = requirePositiveAmount(input.originalAmount);
  const issueDate = input.issueDate === null || input.issueDate === undefined || input.issueDate === "" ? null : requireDate(input.issueDate, "Düzenleme tarihi");
  const requestedStatus = input.settlementStatus ?? "open";
  if (requestedStatus !== "open" && requestedStatus !== "paid") {
    throw new ChecksApiError("Yeni çek durumu open veya paid olmalıdır.");
  }

  const row = await repository.insertInstrument({
    company_id: companyId,
    source: "erp_local",
    external_parasut_id: null,
    instrument_type: "check",
    direction,
    contact_parasut_id: contact?.id ?? null,
    // The display name is always derived from the validated Paraşüt contact.
    // An unassigned cheque must not acquire a caller-provided/guessed party.
    contact_snapshot_name: contact?.name ?? null,
    bank_name: nullableText(input.bankName),
    check_number: nullableText(input.checkNumber),
    issue_date: issueDate,
    due_date: requireDate(input.dueDate, "Vade tarihi"),
    currency: requireCurrency(input.currency),
    original_amount: originalAmount,
    remaining_amount: requestedStatus === "paid" ? 0 : originalAmount,
    settlement_status: requestedStatus,
    notes: nullableText(input.notes),
  });

  return { record: normalizeLocalCheck(row, today) };
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

export async function handleUpdateCheck(
  repository: ChecksRepository,
  companyId: string,
  id: unknown,
  inputValue: unknown,
  today = currentIstanbulDate(),
): Promise<{ record: UnifiedCheck }> {
  const parsed = parseCheckId(id);
  if (parsed.source !== "erp") throw new ChecksApiError("Paraşüt çeklerinin finansal alanları ERP içinde değiştirilemez.", 409);
  const current = await repository.getLocalInstrument(companyId, parsed.rawId);
  if (!current || current.source !== "erp_local") throw new ChecksApiError("Çek bulunamadı.", 404);
  if (current.settlement_status !== "open") throw new ChecksApiError("Kapanmış çek düzenlenemez.", 409);
  const input = createInput(inputValue);
  for (const forbidden of ["source", "externalParasutId", "companyId", "settlementStatus", "remainingAmount", "paidAt", "localQuoteCustomerId"]) {
    if (hasOwn(input, forbidden)) throw new ChecksApiError(`'${forbidden}' alanı bu işlemle değiştirilemez.`);
  }

  const patch: Record<string, unknown> = {};
  const nextDirection = hasOwn(input, "direction") ? requireDirection(input.direction) : current.direction;
  if (hasOwn(input, "direction")) {
    patch.direction = nextDirection;
  }
  if (hasOwn(input, "contactParasutId")) {
    const contactParasutId = nullableText(input.contactParasutId);
    const contact = contactParasutId
      ? await validateContact(repository, companyId, contactParasutId, nextDirection)
      : null;
    patch.contact_parasut_id = contact?.id ?? null;
    patch.contact_snapshot_name = contact?.name ?? null;
  } else if (hasOwn(input, "direction") && current.contact_parasut_id) {
    // A direction edit can change the required party kind even when the form
    // leaves the current party untouched, so revalidate the persisted link.
    await validateContact(repository, companyId, current.contact_parasut_id, nextDirection);
  }
  if (hasOwn(input, "bankName")) patch.bank_name = nullableText(input.bankName);
  if (hasOwn(input, "checkNumber")) patch.check_number = nullableText(input.checkNumber);
  if (hasOwn(input, "issueDate")) {
    patch.issue_date = input.issueDate === null || input.issueDate === "" ? null : requireDate(input.issueDate, "Düzenleme tarihi");
  }
  if (hasOwn(input, "dueDate")) patch.due_date = requireDate(input.dueDate, "Vade tarihi");
  if (hasOwn(input, "currency")) patch.currency = requireCurrency(input.currency);
  if (hasOwn(input, "originalAmount")) {
    if (current.settlement_status !== "open") throw new ChecksApiError("Kapanmış çekin tutarı değiştirilemez.", 409);
    const originalAmount = requirePositiveAmount(input.originalAmount);
    patch.original_amount = originalAmount;
  }
  if (hasOwn(input, "notes")) patch.notes = nullableText(input.notes);
  if (Object.keys(patch).length === 0) throw new ChecksApiError("Güncellenecek alan bulunamadı.");

  const row = await repository.updateInstrument(companyId, current.id, patch);
  return { record: normalizeLocalCheck(row, today) };
}

export async function handleSetCheckStatus(
  repository: ChecksRepository,
  companyId: string,
  id: unknown,
  targetStatus: unknown,
  noteValue: unknown,
  today = currentIstanbulDate(),
): Promise<{ record: UnifiedCheck }> {
  const parsed = parseCheckId(id);
  if (parsed.source !== "erp") throw new ChecksApiError("Paraşüt çekinin durumu ERP içinde değiştirilemez.", 409);
  const current = await repository.getLocalInstrument(companyId, parsed.rawId);
  if (!current || current.source !== "erp_local") throw new ChecksApiError("Çek bulunamadı.", 404);
  if (targetStatus !== "paid" && targetStatus !== "cancelled" && targetStatus !== "returned") {
    throw new ChecksApiError("Hedef durum paid, cancelled veya returned olmalıdır.");
  }
  const note = nullableText(noteValue);
  if ((targetStatus === "cancelled" || targetStatus === "returned") && !note) {
    throw new ChecksApiError("İptal ve iade işlemlerinde açıklama zorunludur.");
  }
  const row = await repository.transitionInstrument(current.id, targetStatus, note);
  return { record: normalizeLocalCheck(row, today) };
}

async function overlayValues(
  mirror: MirrorCheckRow,
  contact: { id: string; name: string },
  today: string,
): Promise<Record<string, unknown>> {
  const normalized = normalizeMirrorCheck(mirror, null, today);
  if (!normalized.direction || !normalized.dueDate || !normalized.currency || normalized.originalAmount === null || normalized.remainingAmount === null) {
    throw new ChecksApiError("Paraşüt çekinin zorunlu alanları eksik; taraf ilişkisi güvenle kaydedilemedi.", 422);
  }
  return {
    company_id: mirror.company_id,
    source: "parasut_mirror",
    external_parasut_id: mirror.parasut_id,
    instrument_type: "check",
    direction: normalized.direction,
    contact_parasut_id: contact.id,
    contact_snapshot_name: contact.name,
    bank_name: normalized.bankName,
    check_number: normalized.checkNumber,
    issue_date: normalized.issueDate,
    due_date: normalized.dueDate,
    currency: normalized.currency,
    original_amount: normalized.originalAmount,
    remaining_amount: normalized.remainingAmount,
    settlement_status: normalized.settlementStatus,
    notes: normalized.notes,
  };
}

export async function handleLinkParty(
  repository: ChecksRepository,
  companyId: string,
  id: unknown,
  contactParasutIdValue: unknown,
  today = currentIstanbulDate(),
): Promise<{ record: UnifiedCheck }> {
  const parsed = parseCheckId(id);
  const contactParasutId = text(contactParasutIdValue);
  if (!contactParasutId) throw new ChecksApiError("Müşteri/tedarikçi seçimi gerekli.");
  const resolved = await resolveCheck(repository, companyId, parsed, today);
  if (!resolved.record.partyLinkEditable) {
    throw new ChecksApiError("Paraşüt taraf ilişkisi kaynak veride mevcut; ERP içinde değiştirilemez.", 409);
  }
  if (!resolved.record.direction) throw new ChecksApiError("Çekin yönü belirlenemedi; taraf atanamaz.", 422);
  const contact = await validateContact(repository, companyId, contactParasutId, resolved.record.direction);

  let linked: PaymentInstrumentRow;
  if (parsed.source === "erp") {
    if (!resolved.localRow) throw new ChecksApiError("Çek bulunamadı.", 404);
    linked = await repository.updateInstrument(companyId, resolved.localRow.id, {
      contact_parasut_id: contact.id,
      contact_snapshot_name: contact.name,
    });
    return { record: normalizeLocalCheck(linked, today) };
  }

  if (!resolved.mirrorRow) throw new ChecksApiError("Çek bulunamadı.", 404);
  linked = resolved.localRow
    ? await repository.updateInstrument(companyId, resolved.localRow.id, {
        contact_parasut_id: contact.id,
        contact_snapshot_name: contact.name,
      })
    : await repository.insertInstrument(await overlayValues(resolved.mirrorRow, contact, today));
  return { record: normalizeMirrorCheck(resolved.mirrorRow, linked, today) };
}

export async function handleUnlinkParty(
  repository: ChecksRepository,
  companyId: string,
  id: unknown,
  today = currentIstanbulDate(),
): Promise<{ record: UnifiedCheck }> {
  const parsed = parseCheckId(id);
  const resolved = await resolveCheck(repository, companyId, parsed, today);
  if (!resolved.record.partyLinkEditable) {
    throw new ChecksApiError("Paraşüt taraf ilişkisi kaynak veride mevcut; ERP içinde kaldırılamaz.", 409);
  }
  if (!resolved.localRow) return { record: resolved.record };
  const unlinked = await repository.updateInstrument(companyId, resolved.localRow.id, {
    contact_parasut_id: null,
    contact_snapshot_name: null,
  });
  return {
    record: resolved.mirrorRow
      ? normalizeMirrorCheck(resolved.mirrorRow, unlinked, today)
      : normalizeLocalCheck(unlinked, today),
  };
}
