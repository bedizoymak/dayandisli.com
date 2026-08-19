import type { CheckListRow } from "./types";

export type CheckProjectionDirection = "received" | "issued";

/**
 * The intentionally small, structural contract consumed by customer,
 * supplier and dashboard projections. The checks feature's API row can carry
 * more fields, but these projections never need (or infer) a party relation
 * beyond the exact provider id persisted by the API.
 */
export type CheckProjectionInput = CheckListRow;

export interface PartyCheckLedgerProjection extends CheckProjectionInput {
  date: string;
  documentType: "Alınan Çek" | "Verilen Çek";
  /**
   * Only a paid ERP-local cheque has a financial ledger effect here. Open
   * cheques remain separately visible as expected cash movements, while
   * Paraşüt mirror cheques are informational so existing mirrored payments
   * cannot be counted twice.
   */
  debit: number;
  credit: number;
}

function isExactPartyMatch(
  row: CheckProjectionInput,
  contactParasutId: string,
  direction: CheckProjectionDirection,
) {
  return row.direction === direction && row.party.parasutId === contactParasutId;
}

export function projectPartyCheckLedger(
  rows: readonly CheckProjectionInput[],
  contactParasutId: string,
  direction: CheckProjectionDirection,
): PartyCheckLedgerProjection[] {
  return rows
    .filter((row) => isExactPartyMatch(row, contactParasutId, direction))
    .map((row): PartyCheckLedgerProjection => {
      const settledLocally = row.source === "erp" && row.settlementStatus === "paid" && row.currency === "TRY";
      // A missing mirror/local amount is unknown, not zero. Keep the row
      // informational, but never create a ledger effect from an unknown value.
      const settledAmount = settledLocally && row.originalAmount !== null ? row.originalAmount : 0;
      return {
        ...row,
        date: row.paidAt?.slice(0, 10) || row.issueDate || row.dueDate || "",
        documentType: direction === "received" ? "Alınan Çek" : "Verilen Çek",
        debit: direction === "issued" ? settledAmount : 0,
        credit: direction === "received" ? settledAmount : 0,
      };
    })
    .sort((left, right) => left.date.localeCompare(right.date) || left.id.localeCompare(right.id));
}
