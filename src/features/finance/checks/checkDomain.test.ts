import { describe, expect, it } from "vitest";
import {
  buildCheckReminder,
  defaultCheckBucket,
  defaultSortChecks,
  sortChecks,
  formatCheckMoney,
} from "./checkDomain";
import type { CheckListRow } from "./types";

function row(id: string, dueDate: string | null, effectiveStatus: CheckListRow["effectiveStatus"]): CheckListRow {
  return {
    id,
    source: "erp",
    sourceLabel: "ERP",
    direction: "received",
    party: { parasutId: null, localQuoteCustomerId: null, name: null, assigned: false },
    bankName: null,
    checkNumber: id,
    issueDate: null,
    dueDate,
    currency: "TRY",
    originalAmount: 100,
    remainingAmount: effectiveStatus === "paid" ? 0 : 100,
    settlementStatus: effectiveStatus,
    effectiveStatus,
    paidAt: null,
    notes: null,
    syncedAt: null,
    editable: true,
    statusEditable: true,
  };
}

describe("check default business order", () => {
  const today = "2026-08-15";

  it("places today-through-day-7 first, then overdue, later/undated open, then terminal", () => {
    const rows = [
      row("terminal", "2026-08-10", "paid"),
      row("later", "2026-08-23", "upcoming"),
      row("overdue", "2026-08-14", "overdue"),
      row("day-seven", "2026-08-22", "upcoming"),
      row("today", "2026-08-15", "due_today"),
      row("undated", null, "open"),
    ];

    expect(defaultSortChecks(rows, today).map((item) => item.id)).toEqual([
      "today",
      "day-seven",
      "overdue",
      "later",
      "undated",
      "terminal",
    ]);
    expect(defaultCheckBucket(rows[3], today)).toBe(0);
    expect(defaultCheckBucket(rows[1], today)).toBe(2);
  });

  it("documents the seven-calendar-day reminder threshold", () => {
    expect(buildCheckReminder(row("day-seven", "2026-08-22", "upcoming"), today)?.urgency).toBe("upcoming");
    expect(buildCheckReminder(row("day-eight", "2026-08-23", "upcoming"), today)).toBeNull();
  });

  it("does not render an unknown amount or currency as zero TRY", () => {
    expect(formatCheckMoney(null, "TRY")).toBe("—");
    expect(formatCheckMoney(100, null)).toBe("—");
    expect(formatCheckMoney(100, "TRY")).toContain("100");
  });

  it("explicit due asc/desc is purely chronological and overrides default buckets", () => {
    const rows = [
      row("paid-old", "2026-08-01", "paid"),
      row("near", "2026-08-18", "upcoming"),
      row("overdue", "2026-08-10", "overdue"),
      row("undated", null, "open"),
    ];
    expect(sortChecks(rows, { field: "dueDate", direction: "asc" }, today).map((item) => item.id)).toEqual([
      "paid-old",
      "overdue",
      "near",
      "undated",
    ]);
    expect(sortChecks(rows, { field: "dueDate", direction: "desc" }, today).map((item) => item.id)).toEqual([
      "near",
      "overdue",
      "paid-old",
      "undated",
    ]);
  });
});
