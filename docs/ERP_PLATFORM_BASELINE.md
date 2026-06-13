# ERP Platform Baseline

## System Overview

`dayandisli.com` is a React and TypeScript platform containing public website, optional commerce, administration, and protected ERP surfaces. Vite builds the frontend, React Router owns navigation, Supabase provides Auth, PostgreSQL, RLS, RPCs, and audit persistence, and GitHub Actions performs quality and FTP deployment workflows.

The baseline date is June 13, 2026. TypeScript, tests, and production build pass. Repository-wide lint retains known debt. Production database changes remain governance-controlled.

## Architecture Diagram (text form)

```text
Browser
  |
  +-- Public routes / optional shop
  |
  +-- ERP routes
        |
        +-- ERPAuthProvider
        |     +-- Supabase Auth session
        |     +-- active admin_users check
        |     +-- erp_users/admin fallback profile
        |     +-- cached roles and permissions
        |
        +-- ProtectedRoute
        |     +-- authentication check
        |     +-- active-admin check
        |     +-- route permission check
        |
        +-- ERP applications and feature pages
              |
              +-- Domain APIs
              |     +-- crmApi.ts
              |     +-- salesApi.ts
              |     +-- inventoryApi.ts
              |     +-- productionApi.ts
              |     +-- erpApi.ts compatibility and remaining domains
              |
              +-- Supabase Data API / RPC
                    +-- PostgreSQL tables
                    +-- tenant-aware RLS
                    +-- audit logs
                    +-- transaction-safe RPCs
```

## Frontend Structure

- `src/App.tsx`: route exposure, lazy loading, providers, legacy redirects, and protected ERP routing.
- `src/features/erp/`: ERP pages grouped by business capability.
- `src/features/erp/apps/applicationRegistry.ts`: 16 application cards and their module links.
- `src/config/erpModules.ts`: dashboard and sidebar module metadata.
- `src/components/erp/`: reusable ERP presentation components.
- `src/contexts/ERPAuthContext.tsx`: centralized ERP authentication state.
- `src/features/erp/shared/`: shared types, permission contracts, formatting, validation, and APIs.
- `src/integrations/supabase/`: Supabase client and generated schema types.

## ERP Modules

The application registry defines Website, Commerce, CRM, Sales, Invoicing, Accounting, Expenses, Inventory, Purchasing, Production, Quality, Maintenance, Repair, HR, Reports, and Settings.

The dashboard/sidebar registry additionally exposes operational entry points such as customers, suppliers, quotations, orders, finance, cargo, calculator, notifications, health, tasks, and notes. Turkish UI labels remain the product language.

## Authentication Flow

1. `ERPAuthProvider` retrieves the Supabase session.
2. The session email must match an active `admin_users` record.
3. `getCurrentERPUser` resolves the ERP profile from `erp_users`, then an admin fallback, then a restricted viewer fallback.
4. Roles and permissions are calculated once and stored in context.
5. `ProtectedRoute` renders a Turkish loading state, redirects unauthenticated or inactive users to `/login`, and redirects denied users to `/apps`.
6. Logout writes a non-blocking audit record and clears the stored redirect path.

## Permission Model

Permissions use string contracts such as `crm.view`, `sales.view`, `inventory.view`, and `production.view`.

- `applicationRegistry.ts` declares application and module permissions.
- `erpModules.ts` declares dashboard/sidebar permissions.
- `getRequiredPermissionForPath` declares route permissions.
- `permissions.test.ts` verifies application, navigation, and route contracts.
- Roles map to permission sets, while explicit user permissions can extend them.
- `admin` bypasses individual permission checks.

## API Layer Structure

| File | Ownership and responsibility |
| --- | --- |
| `crmApi.ts` | Stakeholders, leads, opportunities, CRM tasks, activities, and lead conversion. |
| `salesApi.ts` | Quotations, stakeholder linking, Sales orders/items, and quotation-to-order conversion. |
| `inventoryApi.ts` | Warehouses, inventory items, movements, legacy movement workflow, and feature-flagged Inventory RPC adapter. |
| `productionApi.ts` | Machines, routes/steps, work orders/operations, Sales-to-work-order conversion, and subcontracting. |
| `erpApi.ts` | Backward-compatible re-exports plus remaining shared and unsplit domains: governance, users, HR, logistics, quality, maintenance, finance, purchasing, commerce, website, documents, reporting, and observability. |

`api/internal.ts` owns shared error normalization, audit logging, enterprise scope, ownership, and sequence helpers. Existing feature imports through `erpApi.ts` remain compatible.

## Supabase Architecture

Supabase provides:

- Auth sessions and user administration.
- PostgreSQL business tables.
- Data API access through `supabase-js`.
- RLS-backed tenant isolation.
- `SECURITY INVOKER` workflow RPCs.
- ERP audit, notification, operational metric, event, alert, and automation persistence.
- Local Docker development and CLI-managed migrations.

Frontend clients use public/publishable credentials only. Service-role credentials are restricted to isolated integration harnesses and must never enter browser code or Git.

## Multi-Tenant Model

Tenant ownership is represented primarily by `company_id` and optional `branch_id`. `company_memberships` links authenticated users to company-wide or branch-scoped access. Shared API helpers resolve enterprise scope, apply filters, and attach ownership to new records.

Database RLS is the final authorization boundary. Client filtering is convenience and defense in depth, not a replacement for RLS.

## RLS Strategy

- Public business tables use RLS.
- Authenticated access resolves through active company membership and branch scope.
- Child operation access resolves through parent work orders where direct tenant columns are insufficient.
- Anonymous access to ERP workflow RPCs is revoked.
- RPCs use `SECURITY INVOKER` so caller RLS remains effective.
- Phase 22 locally verified work-order-operation policies, explicit tenant predicates, and uniqueness prerequisites.
- Phase 25 found production policies active and migration history matched, while the manual unique index remained absent.

## Transaction Strategy

Ordinary CRUD uses Supabase client calls with normalized errors and audit logging. Multi-write workflows remain client-side only where no verified RPC is active.

Atomic workflows belong in PostgreSQL RPCs with row locking, validation, critical writes, and audit insertion in one transaction. RPC errors must not trigger automatic legacy fallback because that could duplicate writes.

## RPC Inventory

| Workflow | Functions | Designed | Local Verified | Staging Verified | Production Deployed |
| --- | --- | --- | --- | --- | --- |
| Inventory RPC | `erp_create_inventory_movement` | Yes | Yes | No | Not approved or verified |
| Production RPC | `erp_create_work_order_from_sales_order`, `erp_create_operations_from_route` | Yes | Yes | No | No; review drafts only |

The Inventory RPC is packaged in migration `20260613042605_inventory_movement_rpc.sql` and guarded by a frontend feature flag. Production migration history must not be treated as deployment approval without explicit evidence.

## Feature Flags

| Flag/configuration | Default | Purpose and risk |
| --- | --- | --- |
| `VITE_ENABLE_INVENTORY_RPC` | `false` or absent | Enables the atomic Inventory RPC only for exact value `true`. Enabling before verified deployment causes runtime failure. |
| `VITE_APP_TARGET` | `erp` | Selects application target and routing behavior. Incorrect values can expose the wrong route surface. |
| `VITE_PUBLIC_BASE_URL` | Production public URL | Controls public-domain routing. |
| `VITE_ERP_BASE_URL` | Production ERP URL | Controls ERP redirects and domain separation. |
| `VITE_SHOP_BASE_URL` | Optional | Controls shop-domain routing where configured. |
| `SHOP_FEATURE_ENABLED` | `false` in source | Disables public shop routes and cart provider behavior. |

Supabase URL and publishable/anonymous keys are environment configuration, not feature flags.

## Migration Strategy

- The repository contains 23 ordered migration files.
- Applied migrations are immutable; corrections require a new migration.
- Standard migrations contain transaction-safe SQL.
- `CREATE UNIQUE INDEX CONCURRENTLY` remains a separately reviewed manual step.
- Local destructive verification is allowed.
- Staging requires an approved dedicated project and passing `npm run staging:preflight`.
- Production push, repair, RLS changes, manual indexes, RPC activation, and feature-flag enablement require explicit owner approval.

## CI/CD Pipeline

`quality.yml` runs on pull requests and `main` pushes using Node 20:

1. `npm ci`
2. TypeScript
3. Vitest
4. Production build
5. Non-blocking lint debt report

`deploy.yml` runs on `main`, builds with Node 18, and incrementally uploads `dist/` to FTP. Deployment secrets are supplied through GitHub Actions. Aligning deployment Node/install behavior with the quality workflow remains recommended.

## Testing Strategy

- Vitest and React Testing Library provide 134 tests across 5 files.
- Permission contract tests align cards, modules, and routes.
- `ProtectedRoute` tests cover loading, logged-out, inactive, denied, and allowed states.
- Sales, Inventory, and Production API tests use mocked Supabase behavior.
- Local integration harnesses verify RLS, concurrency, rollback, anonymous denial, and cleanup.
- Static SQL verifiers check RPC and prerequisite safety.
- Remote staging integration is intentionally blocked until dedicated remote-safe harness variants exist.

## Environment Matrix

| Environment | Identity | Allowed | Forbidden/status |
| --- | --- | --- | --- |
| Local | Supabase Docker at `127.0.0.1` | Destructive tests, resets, SQL experiments, rollback verification | Must remain local-only |
| Production | `meauutjsnnggzcigyvfp` / `dayandisli.com` | Read-only audit unless separately approved | Automatic writes, push, repair, indexes, RLS/RPC/flag changes |
| Future Staging | Recommended `dayandisli.com-staging` | Approved pushes, types, integration, manual-index tests | Does not yet exist |

## Deployment Flow

1. Develop and verify locally.
2. Pass typecheck, tests, build, SQL verifiers, and relevant local integrations.
3. Provision and link dedicated staging.
4. Set explicit staging identity variables and run `npm run staging:preflight`.
5. Apply reviewed migrations and manual steps to staging.
6. Regenerate types, run remote-safe integrations, and complete UI smoke tests.
7. Obtain separate production approval with backup and rollback plans.
8. Deploy, verify policies/indexes/audit logs, then separately approve feature flags.

## Known Technical Debt

| Priority | Item |
| --- | --- |
| P0 | No current confirmed tenant-isolation or data-loss defect. Treat any discovered RLS bypass or production integrity issue as P0. |
| P1 | Dedicated staging is absent, blocking rollout evidence. |
| P1 | Production lacks `uq_work_orders_sales_order_id_not_null`, leaving direct writers without database uniqueness protection. |
| P1 | Current integration harnesses are not fully remote-safe; Production harnesses mutate local schema and Inventory rollback testing requires Docker SQL. |
| P2 | Repository lint has 32 errors and 40 warnings. |
| P2 | `erpApi.ts` remains approximately 3,142 lines with multiple unsplit domains. |
| P2 | Generated Supabase types may lag the complete deployed ERP schema. |
| P2 | Deployment uses Node 18 and `npm install`, while quality uses Node 20 and `npm ci`. |
| P3 | Build reports stale Browserslist data, PDF.js `eval`, and large chunks. |
| P3 | Some modules are planned or hidden and require product completion and smoke coverage. |

## Future Roadmap

1. Provision dedicated staging and complete remote-safe rollout evidence.
2. Separate remote-safe integration cases from local schema-mutation cases.
3. Apply and verify the manual partial unique index in staging before any production decision.
4. Regenerate and review Supabase types from staging.
5. Reduce lint debt and make lint blocking.
6. Continue extracting coherent domains from `erpApi.ts`.
7. Align deployment runtime and dependency installation with CI.
8. Add focused browser smoke tests only after stable staging exists.
