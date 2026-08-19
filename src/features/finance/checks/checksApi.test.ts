import { describe, expect, it } from "vitest";
import { normalizeCheckListRow } from "./checksApi";

describe("normalizeCheckListRow", () => {
  it("never guesses a party from an unassigned name, bank or check number", () => {
    const row = normalizeCheckListRow({
      id: "parasut:42",
      source: "parasut",
      direction: "received",
      party: { assigned: false, name: "Tahmini Firma" },
      bankName: "0062",
      checkNumber: "AB123",
      currency: "TRL",
      originalAmount: "1000",
      remainingAmount: "500",
      settlementStatus: "open",
      effectiveStatus: "upcoming",
      paidAt: null,
      editable: false,
      statusEditable: false,
    });

    expect(row?.party).toEqual({
      parasutId: null,
      localQuoteCustomerId: null,
      name: null,
      assigned: false,
    });
    expect(row?.bankName).toBe("0062");
    expect(row?.checkNumber).toBe("AB123");
    expect(row?.currency).toBe("TRY");
  });

  it("preserves absent mirror financial fields instead of inventing values", () => {
    const row = normalizeCheckListRow({
      id: "parasut:missing-fields",
      source: "parasut",
      direction: null,
      party: { assigned: false },
      currency: null,
      originalAmount: null,
      remainingAmount: null,
      settlementStatus: "open",
      effectiveStatus: "upcoming",
      partyLinkEditable: false,
    });

    expect(row).toMatchObject({
      direction: null,
      currency: null,
      originalAmount: null,
      remainingAmount: null,
      partyLinkEditable: false,
    });
  });
});
