import { describe, expect, it } from "vitest";
import {
  projectPartyCheckLedger,
  type CheckProjectionInput,
} from "./checkProjections";
import { buildCheckReminder } from "./checkDomain";

function check(overrides: Partial<CheckProjectionInput> = {}): CheckProjectionInput {
  return {
    id: "erp:11111111-1111-4111-8111-111111111111",
    source: "erp",
    sourceLabel: "ERP",
    direction: "received",
    party: {
      parasutId: "customer-1",
      localQuoteCustomerId: null,
      name: "Gerçek Müşteri",
      assigned: true,
    },
    bankName: "ISBANK",
    checkNumber: "CHK-1",
    issueDate: "2026-08-10",
    dueDate: "2026-08-20",
    currency: "TRY",
    originalAmount: 1_000,
    remainingAmount: 1_000,
    settlementStatus: "open",
    effectiveStatus: "upcoming",
    paidAt: null,
    notes: null,
    syncedAt: null,
    editable: true,
    statusEditable: true,
    ...overrides,
  };
}

describe("check projections", () => {
  it("links a cheque to a ledger only by its exact persisted Paraşüt party id", () => {
    const rows = [
      check(),
      check({
        id: "parasut:unassigned",
        source: "parasut",
        sourceLabel: "Paraşüt",
        party: { parasutId: null, localQuoteCustomerId: null, name: null, assigned: false },
      }),
      check({
        id: "erp:other",
        party: { parasutId: "customer-2", localQuoteCustomerId: null, name: "Başka Müşteri", assigned: true },
      }),
    ];

    expect(projectPartyCheckLedger(rows, "customer-1", "received").map((row) => row.id)).toEqual([
      "erp:11111111-1111-4111-8111-111111111111",
    ]);
  });

  it("shows an open received cheque without treating it as a settled collection", () => {
    const [row] = projectPartyCheckLedger([check()], "customer-1", "received");
    expect(row.documentType).toBe("Alınan Çek");
    expect(row.credit).toBe(0);
    expect(row.remainingAmount).toBe(1_000);
  });

  it("records a paid local cheque separately while a paid mirror cheque remains informational", () => {
    const paidLocal = check({
      id: "erp:paid",
      settlementStatus: "paid",
      effectiveStatus: "paid",
      remainingAmount: 0,
      paidAt: "2026-08-15T12:00:00Z",
    });
    const paidMirror = check({
      id: "parasut:paid",
      source: "parasut",
      sourceLabel: "Paraşüt",
      settlementStatus: "paid",
      effectiveStatus: "paid",
      remainingAmount: 0,
      paidAt: "2026-08-15T12:00:00Z",
    });

    const rows = projectPartyCheckLedger([paidLocal, paidMirror], "customer-1", "received");
    expect(rows.find((row) => row.id === "erp:paid")?.credit).toBe(1_000);
    expect(rows.find((row) => row.id === "parasut:paid")?.credit).toBe(0);
  });

  it("keeps paid foreign-currency or unknown-amount cheques informational without guessing a TRY ledger value", () => {
    const foreign = check({
      id: "erp:usd-paid",
      currency: "USD",
      settlementStatus: "paid",
      effectiveStatus: "paid",
      remainingAmount: 0,
    });
    const unknown = check({
      id: "erp:unknown-paid",
      originalAmount: null,
      settlementStatus: "paid",
      effectiveStatus: "paid",
      remainingAmount: 0,
    });
    const rows = projectPartyCheckLedger([foreign, unknown], "customer-1", "received");
    expect(rows.map((row) => row.credit)).toEqual([0, 0]);
  });

  it("builds reminders only for open overdue, today and next-seven-day cheques", () => {
    const rows = [
      check({ id: "overdue", dueDate: "2026-08-14", effectiveStatus: "overdue" }),
      check({ id: "today", dueDate: "2026-08-15" }),
      check({ id: "soon", dueDate: "2026-08-22" }),
      check({ id: "later", dueDate: "2026-08-23" }),
      check({ id: "paid", dueDate: "2026-08-15", settlementStatus: "paid", effectiveStatus: "paid", remainingAmount: 0 }),
    ];

    expect(rows.flatMap((row) => {
      const reminder = buildCheckReminder(row, "2026-08-15");
      return reminder ? [[row.id, reminder.urgency]] : [];
    })).toEqual([
      ["overdue", "overdue"],
      ["today", "today"],
      ["soon", "upcoming"],
    ]);
  });

  it("projects issued local cheques as supplier-side payments only after paid", () => {
    const supplierParty = { parasutId: "supplier-1", localQuoteCustomerId: null, name: "Gerçek Tedarikçi", assigned: true };
    const open = check({ id: "open-issued", direction: "issued", party: supplierParty });
    const paid = check({
      id: "paid-issued",
      direction: "issued",
      party: supplierParty,
      settlementStatus: "paid",
      effectiveStatus: "paid",
      remainingAmount: 0,
      paidAt: "2026-08-16T08:00:00Z",
    });

    const rows = projectPartyCheckLedger([open, paid], "supplier-1", "issued");
    expect(rows.find((row) => row.id === "open-issued")?.debit).toBe(0);
    expect(rows.find((row) => row.id === "paid-issued")?.debit).toBe(1_000);
  });
});
