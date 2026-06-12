# Phase 6 — CRM API Extraction

## Objective

Extract clearly CRM-owned Supabase data-access functions from the monolithic ERP API while preserving the existing `erpApi.ts` import surface and runtime behavior.

## Starting Findings

- `src/features/erp/shared/erpApi.ts` contains approximately 4,700 lines across many ERP domains.
- Phase 5 established the target `src/features/erp/shared/api/` directory and identified CRM as the first extraction candidate.
- The working tree contains pre-existing Supabase link, migration, and backup changes that are outside this phase and will remain untouched.

## Files Inspected

- `src/features/erp/shared/erpApi.ts`
- `src/features/erp/shared/types.ts`
- `src/features/erp/shared/demoFallback.ts`
- `src/features/erp/shared/api/README.md`
- CRM page and component imports under `src/features/erp/apps/crm/`
- Repository scripts and TypeScript, test, build, and lint configuration

## CRM Functions Identified

- Stakeholders: `listStakeholders`, `createStakeholder`, `updateStakeholder`, `getStakeholderById`
- Leads: `listCRMLeads`, `createCRMLead`, `updateCRMLead`
- Opportunities: `listCRMOpportunities`, `createCRMOpportunity`, `updateCRMOpportunity`, `convertLeadToOpportunity`
- Tasks: `listCRMTasks`, `createCRMTask`, `updateCRMTask`
- Activities: `listCRMActivities`, `createCRMActivity`

## Shared Dependencies

- CRM operations depend on the shared Supabase client, ERP API result types, enterprise ownership and query scoping, sequence number generation, audit logging, error normalization, and demo fallback behavior.
- These dependencies were moved without behavioral changes to `src/features/erp/shared/api/internal.ts`.
- `erpApi.ts` still imports the stakeholder list/create functions internally because existing Sales and purchasing flows use them.

## Changes Made

- Added `src/features/erp/shared/api/crmApi.ts` and moved the 16 clearly CRM-owned functions into it.
- Added `src/features/erp/shared/api/internal.ts` for the small set of helpers needed by both the monolith and the extracted CRM module.
- Removed the moved implementations from `erpApi.ts`; no CRM logic is duplicated.
- Preserved existing Turkish audit descriptions and all Supabase query behavior.

## Backward Compatibility

- `erpApi.ts` re-exports every extracted CRM function, so existing feature imports remain valid.
- `createAuditLog`, `getNextERPNumber`, and `EnterpriseQueryScope` also retain their existing exports from `erpApi.ts`.
- No feature page import was changed.
- Type checking and the production build validate the compatibility layer.

## Validation Results

- `npm run typecheck`: passed.
- `npm run test`: passed, 109 tests across 2 test files.
- `npm run build`: passed.
- `npx eslint src/features/erp/shared/erpApi.ts src/features/erp/shared/api/crmApi.ts src/features/erp/shared/api/internal.ts`: passed.
- `npm run lint`: failed on the known repository backlog with 72 findings (32 errors and 40 warnings); the extracted files produced no findings.
- The build retained existing non-blocking warnings for Browserslist data, PDF.js `eval`, and large chunks.

## Remaining Risks

- CRM data-access behavior is covered indirectly by type checking, build validation, and existing tests; dedicated mocked Supabase tests do not yet exist.
- The remaining ERP domains still share a large monolithic API file.
- `api/internal.ts` is now a shared dependency and should remain implementation-only rather than becoming a feature import surface.
- Stakeholders are CRM-owned for this extraction but remain consumed by other ERP domains through the compatibility module.

## Next Recommended Phase

Add focused unit tests for CRM query construction and error handling, then extract the next cohesive domain from `erpApi.ts` using the same compatibility pattern.
