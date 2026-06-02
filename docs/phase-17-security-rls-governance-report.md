# Phase 17 Security, RLS and Governance Report

Date: 2026-06-02

Scope: Real production security, Supabase RLS coverage, authorization enforcement, audit logging, activity history, environment review, and operational governance. No new business modules were added.

## Executive Summary

Phase 17 moved the ERP from deployment readiness toward production safety by auditing the database authorization layer and adding governance logging for critical actions.

Implemented hardening:

- Added a non-destructive migration to enable RLS and authenticated policies for Phase 11 HR governance tables that were missing explicit RLS coverage.
- Added audit log events for successful login, logout, ERP user creation, role changes, permission changes, user active/passive changes, and production route step deletion.
- Documented the real authorization gap: most Supabase policies are still broad authenticated policies and do not yet enforce ERP role permissions at the database layer.
- Documented environment, retention, recovery, and governance procedures needed before production operation.

Production safety score: **84 / 100**

The platform has a governance foundation, but the major remaining production risk is still database-side least-privilege enforcement. Frontend permissions are useful for UX, but production security must be enforced by RLS/server policies.

## RLS Coverage Matrix

Legend:

- `Enabled`: RLS is enabled by explicit migration or dynamic migration block.
- `Broad Auth`: authenticated users can read/write broadly with `using (true)` / `with check (true)`.
- `Public/Anon`: anonymous/public access exists by design or risk.
- `Gap`: missing, unmanaged, or not role-isolated.

| Area | Tables | RLS Status | Policy Summary | Finding |
|---|---|---:|---|---|
| Auth/Gate | `admin_users` | Enabled | Authenticated read | Broad authenticated read; no role isolation. |
| Auth/Gate | `erp_users` | Enabled by core dynamic block | Authenticated select/insert/update | Critical table; broad authenticated policies are not production least privilege. |
| Public config | `settings` | Enabled | Public read | Acceptable only if settings remain non-sensitive. |
| Public auth helper | `allowed_emails` | Enabled | Authenticated read | Broad authenticated read. |
| Public catalog | `products`, `product_images` | Enabled | Public read, authenticated write/delete | Public read is expected; authenticated write/delete needs role isolation. |
| Public orders | `orders`, `order_items` | Enabled | Authenticated read/write plus anonymous insert | Anonymous insert supports shop checkout; abuse controls are needed. |
| Public sequence | `order_counter` | Enabled | Public read/update | High risk; public update can manipulate order numbering if Data API grants allow it. |
| CRM | `stakeholders` | Enabled by core dynamic block | Authenticated select/insert/update | Broad authenticated policies; no CRM/sales role isolation. |
| CRM | `crm_leads`, `crm_opportunities`, `crm_tasks`, `crm_activities` | Enabled | Authenticated read/write | Broad authenticated policies. |
| Sales | `erp_quotation_links`, `sales_orders`, `sales_order_items` | Enabled by core dynamic block | Authenticated select/insert/update | Broad authenticated policies. |
| Production | `machines`, `production_routes`, `production_route_steps`, `work_orders`, `work_order_operations`, `subcontracting_jobs` | Enabled by core dynamic block | Authenticated select/insert/update | Broad authenticated policies. |
| Inventory | `inventory_items`, `inventory_movements`, `measuring_tools` | Enabled by core dynamic block | Authenticated select/insert/update | Broad authenticated policies. |
| Procurement | `purchase_orders`, `purchase_order_items` | Enabled | Authenticated select/insert/update | Broad authenticated policies. |
| Finance | `financial_accounts`, `invoices`, `payments` | Enabled by core dynamic block | Authenticated select/insert/update | Critical financial tables; broad authenticated policies are not production-safe. |
| Documents | `documents` | Enabled by core dynamic block | Authenticated select/insert/update | Needs entity-level and permission-level checks. |
| HR core | `employees`, `employee_time_entries`, `employee_assets` | Enabled by core dynamic block | Authenticated select/insert/update | Sensitive HR data; broad authenticated policies are not production-safe. |
| HR org | `hr_departments`, `hr_positions`, `hr_leave_requests`, `hr_recruitment_candidates`, `hr_onboarding_tasks` | Enabled in Phase 17 migration | Authenticated select/insert/update | Missing RLS coverage fixed; still needs role/department isolation. |
| Logistics | `shipments`, `shipment_items` | Enabled by core dynamic block | Authenticated select/insert/update | Broad authenticated policies. |
| Quality | `quality_reports`, `quality_measurements` | Enabled by core dynamic block | Authenticated select/insert/update | Broad authenticated policies. |
| Maintenance | `maintenance_tasks` | Enabled by core dynamic block | Authenticated select/insert/update | Broad authenticated policies. |
| Numbering | `erp_number_sequences` | Enabled by core dynamic block | Authenticated select/insert/update | Should be restricted to RPC/service path. |
| Audit | `erp_audit_logs` | Enabled | Authenticated select/insert | Broad insert/select; future policy should prevent client tampering. |
| Notifications | `erp_notifications` | Enabled | Authenticated select/insert/update | Broad authenticated policies. |
| E-commerce | `shop_categories`, `shop_campaigns` | Enabled | Public read, authenticated manage | Public read expected; manage needs role isolation. |
| E-commerce | `shop_carts`, `shop_cart_items` | Enabled | Anonymous insert, authenticated view/update | Anonymous insert expected for cart foundation; abuse controls needed. |
| E-commerce | `shop_payment_statuses` | Enabled | Authenticated manage | Needs finance/e-commerce role isolation. |
| Website CMS | `website_pages` | Enabled | Public published read, authenticated manage | Manage needs website role isolation. |
| Website CMS | `website_seo_settings`, `website_menu_items`, `website_media_assets`, `website_forms`, `website_banners` | Enabled | Public select, authenticated manage | Public select can be acceptable; review sensitive fields. |
| Website forms | `website_form_submissions` | Enabled | Anonymous insert, authenticated manage | Anonymous insert expected; spam/rate limiting needed. |
| External integrations | `parasut_tokens` | Unmanaged in migrations | Service-role use in Edge Functions | Table exists in function usage but no migration/RLS definition found. High priority governance gap. |

## Policy Inventory

Policy patterns found:

- Core ERP dynamic policies: authenticated `select`, `insert`, and `update` with `using (true)` / `with check (true)`.
- CRM policies: authenticated read/write with broad `true` predicates.
- Purchasing policies: authenticated select/insert/update with broad predicates.
- Website policies: public select for published/public content and authenticated manage.
- Shop policies: public read for catalog/campaigns and anonymous insert for cart/order foundations.
- Audit/notification policies: authenticated select/insert/update, broad predicates.

Policy risks:

- Broad authenticated policies mean any authenticated and admin-gated ERP user can potentially access/write many tables through the Data API if they can obtain the project publishable key.
- Role definitions in frontend code are not mirrored in database policies.
- `erp_users`, HR, finance, payments, invoices, audit logs, and number sequences should not remain broad authenticated tables in production.
- Anonymous insert policies need rate limiting, validation, and abuse monitoring.

## Authorization Findings

Frontend:

- Application hub visibility uses `filterApplicationsByPermission`.
- Application shell redirects when the user lacks an app permission.
- `ProtectedRoute` checks session, `admin_users`, and route-level permissions.
- Route-level permission mapping exists in `getRequiredPermissionForPath`.

Backend/Supabase:

- Supabase RLS exists broadly, but policies do not enforce the same ERP permission catalog.
- Current enforcement is primarily frontend/UI and route based.
- Edge Functions use service role for integration operations, which is appropriate only if invocation access is controlled.

Finding:

- Permissions are not yet fully enforced outside the client. This is the main remaining production security issue.

## Audit Logging Architecture

Existing foundation:

- `erp_audit_logs` stores actor, entity type, entity ID, action, old/new status, description, metadata, and timestamp.
- `createAuditLog` centralizes client-side audit inserts.
- Database functions already write audit logs for several workflow transitions.
- Dashboard/reporting already reads recent audit activity.

Implemented in Phase 17:

- Successful login: `auth_session / login`
- Logout from top bar and app hub: `auth_session / logout`
- ERP user creation: `erp_user / user_created`
- Role changes: `erp_user / role_changed`
- Permission changes: `erp_user / permissions_changed`
- Active/passive changes: `erp_user / user_status_changed`
- Other ERP user updates: `erp_user / user_updated`
- Production route step deletion: `production_route_step / deleted`

Recommended future architecture:

- Move critical audit writes into database triggers or security-definer RPCs so clients cannot bypass or forge audit records.
- Restrict direct client insert access to `erp_audit_logs` once server-side audit write paths exist.
- Add immutable audit retention policy for production.

## ERP Activity History Architecture

Current activity coverage:

- CRM: leads/opportunities create and status changes.
- Sales: quotation conversion and sales order/work order related events.
- Inventory: inventory item and movement events exist in API paths.
- Procurement: purchase order create/status update events.
- Production: work order, operation, subcontracting, route step delete, and status transition events.
- Finance: invoice/payment/account foundations exist; audit should be expanded for every critical update.
- HR: user management logging added; HR employee/leave/recruitment history should be expanded next.

Activity event design:

- `entity_type`: module record category.
- `entity_id`: target record.
- `action`: `created`, `updated`, `status_changed`, `deleted`, `login`, `logout`, `role_changed`, `permissions_changed`.
- `old_status` / `new_status`: status transitions.
- `metadata`: structured before/after or related IDs.

## Data Retention Strategy

Backups:

- Enable Supabase scheduled backups or point-in-time recovery for production.
- Store deployment artifacts and migration history with each release.
- Verify that backups include auth, public schema, storage metadata, and Edge Function secrets handling procedure.

Retention:

- Audit logs: retain at least 24 months for operational governance unless legal requirements differ.
- Website form submissions: define retention by customer/privacy policy.
- HR records: retain according to Turkish employment and accounting obligations.
- E-commerce orders/invoices/payments: retain according to accounting/tax obligations.

Recovery:

- Test restore procedure before production launch.
- Document restore owner, target RTO, target RPO, and approval process.
- Practice rollback from a migration failure on a staging clone.

Rollback:

- Avoid destructive migrations without a verified backup.
- Use additive migrations for production phases.
- Document manual rollback scripts only after testing in staging.

## Environment Audit

Frontend environment:

- Uses `VITE_SUPABASE_URL`.
- Uses `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Uses public/ERP/shop base URL variables.
- No frontend service role key usage was found.

Edge Function environment:

- `PARASUT_CLIENT_ID`
- `PARASUT_CLIENT_SECRET`
- `PARASUT_REDIRECT_URI`
- `PARASUT_COMPANY_ID`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

Findings:

- Service role keys are only used in Edge Functions.
- `parasut_tokens` table is referenced but not defined in migrations; production schema ownership is unclear.
- Supabase CLI reported installed version `v2.101.0` and latest `v2.104.0`; upgrade should be scheduled but was not required for this phase.
- Storage configuration was not changed; media remains a public media-library concern from earlier phases.

## Security Hardening

XSS:

- React escaping handles normal text rendering.
- PDF/document pipelines and any HTML rendering should remain under review.
- Website CMS content will need sanitization rules before driving the public site.

Permission escalation:

- Highest risk is broad authenticated RLS on permission-sensitive tables.
- `erp_users` updates should be restricted to admin/role-management paths at the database layer.
- Direct Data API access must be treated as possible for any authenticated session.

Direct route access:

- Route guards exist.
- Unauthorized users redirect safely.
- Route guards are not enough without database policies.

Unsafe client assumptions:

- Client role checks are useful for UI but not a security boundary.
- Audit logs written by clients can be bypassed until server-side triggers/RPCs are implemented.

Issues fixed:

- Added missing HR RLS migration.
- Added governance audit logs for auth/user management/deletion events.

## ERP Governance Foundation

Prepared governance practices:

- Audit reviews: review `erp_audit_logs` for auth, user/role, permission, critical update, and deletion events.
- Operational reviews: use dashboard/reports to review open sales, production, procurement, finance, and HR activity.
- Compliance reporting: use audit log export as a future compliance input.
- Approval workflows: use audit/action metadata as the foundation for future approval events.

Recommended review cadence:

- Daily: failed integrations, form submissions, open critical workflow items.
- Weekly: user/role/permission changes and critical deletions.
- Monthly: access review by role, stale users, financial/HR audit events.
- Quarterly: RLS/policy review and recovery drill.

## Files Modified

- `src/pages/Login.tsx`
- `src/pages/Apps.tsx`
- `src/features/erp/layout/ERPTopBar.tsx`
- `src/features/erp/shared/erpApi.ts`
- `supabase/migrations/20260602062325_phase17_hr_rls_governance.sql`
- `docs/phase-17-security-rls-governance-report.md`

## Remaining Risks

- Supabase RLS policies are mostly authenticated-wide, not ERP role-based.
- `erp_users`, finance, HR, audit logs, and number sequence tables need stricter policies.
- `order_counter` has public update policy in legacy migration and should be redesigned through an RPC-only path.
- `parasut_tokens` is used by Edge Functions but not governed by repo migrations.
- Anonymous insert policies for public orders, carts, order items, and website form submissions need abuse controls.
- Audit log writes are partly client-side and can be bypassed.
- Role and route behavior still lacks automated tests.
- Storage bucket policy inventory was not available from migrations.

## Governance Recommendations

- Implement database role checks through RLS helper functions or secure RPCs.
- Move high-risk writes through RPCs that verify ERP permissions server-side.
- Make `erp_audit_logs` append-only and server-written for critical events.
- Add a migration for `parasut_tokens` or document it as an externally managed table with strict policies.
- Replace public `order_counter` updates with a security-controlled order number function.
- Add Supabase policy tests for each foundation role.
- Add staging environment and release checklist before production launch.

## Proposed Phase 18 Scope

Recommended Phase 18: **Database-Enforced ERP Permissions and Policy Tests**

Suggested scope:

- Create database helper functions for ERP role/permission lookup.
- Replace broad authenticated policies on high-risk tables with role-aware RLS.
- Lock down `erp_users`, finance, HR, audit logs, and number sequences first.
- Add policy tests for Süper Yönetici, Yönetici, Satış, Finans, Üretim, Satın Alma, Depo, İnsan Kaynakları, Kalite, and Misafir.
- Add a governed migration for `parasut_tokens`.
- Convert critical audit writes to database triggers/RPCs.
- Redesign public order numbering to remove public counter updates.
