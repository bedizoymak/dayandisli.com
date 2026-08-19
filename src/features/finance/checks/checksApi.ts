import { supabase } from "@/integrations/supabase/client";
import type {
  ApiResult,
  CheckDetailResponse,
  CheckDirection,
  CheckEffectiveStatus,
  CheckHistoryEntry,
  CheckListQuery,
  CheckListResponse,
  CheckListRow,
  CheckPartyOption,
  CheckTerminalStatus,
  CheckWriteInput,
} from "./types";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numericValue(value: unknown): number | null {
  const amount = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : Number.NaN;
  return Number.isFinite(amount) ? amount : null;
}

const EFFECTIVE_STATUSES = new Set<CheckEffectiveStatus>([
  "open",
  "upcoming",
  "due_today",
  "overdue",
  "paid",
  "cancelled",
  "returned",
]);

export function normalizeCheckListRow(value: unknown): CheckListRow | null {
  if (!isRecord(value)) return null;
  const id = textValue(value.id);
  const source = value.source === "parasut" || value.source === "erp" ? value.source : null;
  const direction: CheckDirection | null = value.direction === "received" || value.direction === "issued" ? value.direction : null;
  if (!id || !source) return null;

  const partyValue = isRecord(value.party) ? value.party : {};
  const assigned = partyValue.assigned === true;
  const effectiveStatus = EFFECTIVE_STATUSES.has(value.effectiveStatus as CheckEffectiveStatus)
    ? (value.effectiveStatus as CheckEffectiveStatus)
    : "open";
  const rawCurrency = textValue(value.currency)?.toUpperCase();
  const currency = rawCurrency === "TRL" || rawCurrency === "TRY"
    ? "TRY"
    : rawCurrency === "USD" || rawCurrency === "EUR"
      ? rawCurrency
      : null;

  return {
    id,
    source,
    sourceLabel: source === "parasut" ? "Paraşüt" : "ERP",
    direction,
    party: {
      parasutId: assigned ? textValue(partyValue.parasutId) : null,
      localQuoteCustomerId: assigned ? textValue(partyValue.localQuoteCustomerId) : null,
      // Never infer a party from a bank, serial number, note or any other
      // display field. A name is shown only when the backend marks the real
      // relationship as assigned.
      name: assigned ? textValue(partyValue.name) : null,
      assigned,
    },
    bankName: textValue(value.bankName),
    checkNumber: textValue(value.checkNumber),
    issueDate: textValue(value.issueDate),
    dueDate: textValue(value.dueDate),
    currency,
    originalAmount: numericValue(value.originalAmount),
    remainingAmount: numericValue(value.remainingAmount),
    settlementStatus: textValue(value.settlementStatus) ?? "open",
    effectiveStatus,
    paidAt: textValue(value.paidAt),
    notes: textValue(value.notes),
    syncedAt: textValue(value.syncedAt),
    createdAt: textValue(value.createdAt),
    updatedAt: textValue(value.updatedAt),
    editable: value.editable === true,
    statusEditable: value.statusEditable === true,
    partyLinkEditable: value.partyLinkEditable === true,
  };
}

function normalizeHistory(value: unknown): CheckHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!isRecord(item)) return [];
    return [{
      id: textValue(item.id) ?? `history-${index}`,
      eventType: textValue(item.eventType) ?? textValue(item.action) ?? "Güncelleme",
      fromStatus: textValue(item.fromStatus) ?? textValue(item.previous_settlement_status),
      toStatus: textValue(item.toStatus) ?? textValue(item.new_settlement_status),
      note: textValue(item.note),
      createdAt: textValue(item.createdAt) ?? textValue(item.occurred_at),
    }];
  });
}

function errorMessage(data: unknown, error: unknown, fallback: string): string {
  if (isRecord(data)) {
    const message = textValue(data.error) ?? textValue(data.message);
    if (message) return message;
  }
  if (isRecord(error)) {
    const message = textValue(error.message);
    if (message) return message;
  }
  return fallback;
}

async function invokeChecks(body: UnknownRecord): Promise<ApiResult<unknown>> {
  try {
    const { data, error } = await supabase.functions.invoke("checks-api", { body });
    if (error || (isRecord(data) && typeof data.error === "string")) {
      return { ok: false, message: errorMessage(data, error, "Çek işlemi tamamlanamadı.") };
    }
    return { ok: true, data };
  } catch (error) {
    return { ok: false, message: errorMessage(null, error, "Çek servisine ulaşılamadı.") };
  }
}

export async function listChecks(query: CheckListQuery = {}): Promise<ApiResult<CheckListResponse>> {
  const result = await invokeChecks({ action: "list", ...query });
  if (result.ok === false) return result;
  if (!isRecord(result.data) || !Array.isArray(result.data.rows)) {
    return { ok: false, message: "Çek listesi beklenmeyen bir yanıt döndürdü." };
  }
  const rows = result.data.rows.map(normalizeCheckListRow).filter((row): row is CheckListRow => row !== null);
  return {
    ok: true,
    data: {
      rows,
      total: numericValue(result.data.total) ?? 0,
      page: Math.max(1, numericValue(result.data.page) ?? query.page ?? 1),
      pageSize: Math.max(1, numericValue(result.data.pageSize) ?? query.pageSize ?? 100),
      latestSyncAt: textValue(result.data.latestSyncAt),
    },
  };
}

export async function listAllChecks(
  query: Omit<CheckListQuery, "page" | "pageSize"> = {},
): Promise<ApiResult<CheckListRow[]>> {
  const pageSize = 100;
  const first = await listChecks({ ...query, page: 1, pageSize });
  if (first.ok === false) return first;
  const rows = [...first.data.rows];
  const pageCount = Math.ceil(first.data.total / first.data.pageSize);
  for (let page = 2; page <= pageCount; page += 1) {
    const next = await listChecks({ ...query, page, pageSize });
    if (next.ok === false) return next;
    rows.push(...next.data.rows);
  }
  return { ok: true, data: rows };
}

export async function getCheckDetail(id: string): Promise<ApiResult<CheckDetailResponse>> {
  const result = await invokeChecks({ action: "detail", id });
  if (result.ok === false) return result;
  if (!isRecord(result.data)) return { ok: false, message: "Çek detayı beklenmeyen bir yanıt döndürdü." };
  const record = normalizeCheckListRow(result.data.record);
  if (!record) return { ok: false, message: "Çek kaydı bulunamadı." };
  return { ok: true, data: { record, history: normalizeHistory(result.data.history) } };
}

async function mutationResult(body: UnknownRecord): Promise<ApiResult<CheckListRow>> {
  const result = await invokeChecks(body);
  if (result.ok === false) return result;
  const record = normalizeCheckListRow(isRecord(result.data) && "record" in result.data ? result.data.record : result.data);
  return record ? { ok: true, data: record } : { ok: false, message: "Kaydedilen çek yanıtı okunamadı." };
}

export function createCheck(input: CheckWriteInput): Promise<ApiResult<CheckListRow>> {
  return mutationResult({ action: "create", input });
}

export function updateCheck(id: string, input: CheckWriteInput): Promise<ApiResult<CheckListRow>> {
  return mutationResult({ action: "update", id, input });
}

export function setCheckStatus(
  id: string,
  status: CheckTerminalStatus,
  note?: string,
): Promise<ApiResult<CheckListRow>> {
  return mutationResult({ action: "set-status", id, status, ...(note?.trim() ? { note: note.trim() } : {}) });
}

export function linkCheckParty(id: string, contactParasutId: string): Promise<ApiResult<CheckListRow>> {
  return mutationResult({ action: "link-party", id, contactParasutId });
}

export function unlinkCheckParty(id: string): Promise<ApiResult<CheckListRow>> {
  return mutationResult({ action: "unlink-party", id });
}

export async function searchCheckParties(direction: CheckDirection, search = ""): Promise<ApiResult<CheckPartyOption[]>> {
  const resource = direction === "received" ? "customers" : "suppliers";
  try {
    const { data, error } = await supabase.functions.invoke("parasut-api", {
      body: { action: "list", resource, page: 1, pageSize: 50, search: search.trim() },
    });
    if (error || !isRecord(data) || !Array.isArray(data.rows)) {
      return { ok: false, message: errorMessage(data, error, "Taraf listesi alınamadı.") };
    }
    const accountType = direction === "received" ? "customer" : "supplier";
    const rows = data.rows.flatMap((row) => {
      if (!isRecord(row)) return [];
      const parasutId = textValue(row.parasut_id);
      const attributes = isRecord(row.attributes) ? row.attributes : {};
      const name = textValue(attributes.name);
      if (!parasutId || !name) return [];
      return [{ parasutId, name, accountType } satisfies CheckPartyOption];
    });
    return { ok: true, data: rows };
  } catch (error) {
    return { ok: false, message: errorMessage(null, error, "Taraf listesi alınamadı.") };
  }
}

export async function refreshParasutChecks(): Promise<ApiResult<null>> {
  try {
    const { data, error } = await supabase.functions.invoke("parasut-write-api", {
      body: { action: "resync", resource: "checks" },
    });
    if (error || (isRecord(data) && typeof data.error === "string")) {
      return { ok: false, message: errorMessage(data, error, "Paraşüt çekleri yenilenemedi.") };
    }
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, message: errorMessage(null, error, "Paraşüt çekleri yenilenemedi.") };
  }
}
