# ERP API layer (post-Phase-5A state)

The god-module `erpApi.ts` was deleted in Phase 11 after its live surface was
extracted. What remains here is the LIVE infrastructure module:

- `internal.ts` — shared result/error helpers (`success`, `failure`,
  `isMissingTableError`), ERP number sequences (`getNextERPNumber`) and the
  audit trail writer (`createAuditLog`). Used by the auth context, login,
  `shared/auth.ts`, and the quotes/finance feature modules.

The unwired domain scaffolds (`salesApi`, `productionApi`, `crmApi`,
`inventoryApi`) were removed in Phase 11/15: they had zero importers, and
several referenced retired table generations (`stakeholders`, `quotations`,
`erp_quotation_links`). Live feature modules own their data access directly
(`features/sales/quotesApi.ts`, `features/finance/checks/checksApi.ts`,
`features/public-cms/api.ts`, …) — that is the pattern new code must follow.

Rules for future domain extraction:
- One domain per change; consumers migrated deliberately.
- Shared helpers stay in `internal.ts`.
- New modules live next to their feature (`features/<domain>/api.ts`), not
  in this folder.
