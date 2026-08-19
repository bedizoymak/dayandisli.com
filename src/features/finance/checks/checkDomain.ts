import type {
  CheckCurrency,
  CheckDirection,
  CheckEffectiveStatus,
  CheckListRow,
  CheckParty,
  CheckSort,
} from "./types";
import { formatMoney } from "@/lib/finance/financeLabels";

export const CHECK_EFFECTIVE_STATUS_LABELS: Record<CheckEffectiveStatus, string> = {
  open: "Açık",
  upcoming: "Vadesi Yaklaşıyor",
  due_today: "Bugün Vadeli",
  overdue: "Gecikmiş",
  paid: "Ödendi",
  cancelled: "İptal",
  returned: "İade",
};

export function effectiveStatusLabel(status: CheckEffectiveStatus): string {
  return CHECK_EFFECTIVE_STATUS_LABELS[status];
}

export function checkDirectionLabel(direction: CheckDirection | null): string {
  if (direction === "received") return "Alınan Çek";
  if (direction === "issued") return "Verilen Çek";
  return "Yön bilinmiyor";
}

export function formatCheckMoney(amount: number | null, currency: CheckCurrency | null): string {
  return amount === null || currency === null ? "—" : formatMoney(amount, currency);
}

export function checkPartyLabel(party: CheckParty): string {
  if (!party.assigned) return "Taraf atanmadı";
  return party.name ?? "Taraf adı alınamadı";
}

export function istanbulTodayIso(referenceDate = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(referenceDate);
}

function addCalendarDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function isTerminal(row: CheckListRow): boolean {
  return row.effectiveStatus === "paid" || row.effectiveStatus === "cancelled" || row.effectiveStatus === "returned";
}

/**
 * Default business order from the check-module specification:
 * due today/within seven calendar days, overdue, later or undated open rows,
 * then terminal rows. Dates within a bucket are ascending and missing dates
 * are always last.
 */
export function defaultCheckBucket(row: CheckListRow, today = istanbulTodayIso()): number {
  if (isTerminal(row)) return 3;
  const dueDate = row.dueDate;
  if (!dueDate) return 2;
  if (row.effectiveStatus === "overdue" || dueDate < today) return 1;
  if (dueDate <= addCalendarDays(today, 7)) return 0;
  return 2;
}

function compareNullableDate(left: string | null, right: string | null, direction: "asc" | "desc"): number {
  if (!left && !right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  const comparison = left.localeCompare(right);
  return direction === "asc" ? comparison : -comparison;
}

function compareNullableNumber(left: number | null, right: number | null, direction: "asc" | "desc"): number {
  if (left === null && right === null) return 0;
  if (left === null) return 1;
  if (right === null) return -1;
  const comparison = left - right;
  return direction === "asc" ? comparison : -comparison;
}

function compareNumber(left: number, right: number, direction: "asc" | "desc"): number {
  const comparison = left - right;
  return direction === "asc" ? comparison : -comparison;
}

const STATUS_SORT_ORDER: Record<CheckEffectiveStatus, number> = {
  overdue: 0,
  due_today: 1,
  upcoming: 2,
  open: 3,
  paid: 4,
  returned: 5,
  cancelled: 6,
};

export function defaultSortChecks(rows: CheckListRow[], today = istanbulTodayIso()): CheckListRow[] {
  return [...rows].sort((left, right) => {
    const bucket = defaultCheckBucket(left, today) - defaultCheckBucket(right, today);
    if (bucket) return bucket;
    const dueDate = compareNullableDate(left.dueDate, right.dueDate, "asc");
    if (dueDate) return dueDate;
    return left.id.localeCompare(right.id, "tr-TR");
  });
}

export function sortChecks(rows: CheckListRow[], sort?: CheckSort, today = istanbulTodayIso()): CheckListRow[] {
  if (!sort) return defaultSortChecks(rows, today);
  return [...rows].sort((left, right) => {
    let comparison = 0;
    if (sort.field === "dueDate") {
      // Explicit due sorting is purely chronological; it intentionally
      // overrides the default business buckets. Missing dates remain last.
      comparison = compareNullableDate(left.dueDate, right.dueDate, sort.direction);
    } else if (sort.field === "originalAmount") {
      comparison = compareNullableNumber(left.originalAmount, right.originalAmount, sort.direction);
    } else if (sort.field === "remainingAmount") {
      comparison = compareNullableNumber(left.remainingAmount, right.remainingAmount, sort.direction);
    } else {
      comparison = compareNumber(
        STATUS_SORT_ORDER[left.effectiveStatus],
        STATUS_SORT_ORDER[right.effectiveStatus],
        sort.direction,
      );
    }
    return comparison || left.id.localeCompare(right.id, "tr-TR");
  });
}

export type CheckReminder = {
  checkId: string;
  dueDate: string;
  title: string;
  body: string;
  urgency: "today" | "upcoming" | "overdue";
};

/** Pure projection only; it never creates a notification or writes data. */
export function buildCheckReminder(row: CheckListRow, today = istanbulTodayIso()): CheckReminder | null {
  if (isTerminal(row) || !row.dueDate) return null;
  const partyName = checkPartyLabel(row.party);
  const reference = row.checkNumber || row.id;
  if (row.dueDate < today || row.effectiveStatus === "overdue") {
    return {
      checkId: row.id,
      dueDate: row.dueDate,
      title: "Gecikmiş çek",
      body: `${reference} · ${partyName}`,
      urgency: "overdue",
    };
  }
  if (row.dueDate > addCalendarDays(today, 7)) return null;
  const isToday = row.dueDate === today;
  return {
    checkId: row.id,
    dueDate: row.dueDate,
    title: isToday ? "Bugün vadeli çek" : "Vadesi yaklaşan çek",
    body: `${reference} · ${partyName}`,
    urgency: isToday ? "today" : "upcoming",
  };
}
