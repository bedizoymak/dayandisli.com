# ERP API Domain Split Plan

`src/features/erp/shared/erpApi.ts` currently combines shared infrastructure and many business domains in one module. Future extraction should preserve the existing `erpApi.ts` import surface through re-exports while moving implementations into:

- `crmApi.ts`
- `salesApi.ts`
- `productionApi.ts`
- `inventoryApi.ts`
- `purchasingApi.ts`
- `financeApi.ts`
- `hrApi.ts`
- `qualityApi.ts`
- `logisticsApi.ts`
- `settingsApi.ts`

## Extraction Rules

- Move one domain per change.
- Keep shared result, error, audit, numbering, tenant-scope, and ownership helpers in a neutral internal module before moving dependent functions.
- Re-export moved functions from `erpApi.ts` until consumers are migrated deliberately.
- Preserve existing function names, payloads, result shapes, Turkish error text, and audit behavior.
- Run typecheck, tests, and build after every domain extraction.

## CRM First Candidate

The first candidate is the contiguous CRM block containing lead, opportunity, task, and activity operations. It currently depends on private helpers and shared functions in `erpApi.ts`, including enterprise-scope resolution, ownership assignment, numbering, audit logging, error normalization, and success/failure result construction.

Moving that block before extracting those shared internals would either duplicate behavior or expose implementation details prematurely. Phase 5 therefore creates the target boundary and records the dependency order without moving production CRUD code.

Recommended order:

1. Extract shared API result/error helpers into an internal module.
2. Extract enterprise-scope and ownership helpers into an internal module.
3. Move CRM lead, opportunity, task, and activity operations to `crmApi.ts`.
4. Re-export CRM functions from `erpApi.ts`.
5. Add focused CRM API tests before migrating direct imports.
