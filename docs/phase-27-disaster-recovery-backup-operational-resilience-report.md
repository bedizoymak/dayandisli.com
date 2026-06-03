# Phase 27 Disaster Recovery, Backup and Operational Resilience Report

## Objective

Phase 27 establishes disaster recovery, backup governance and operational resilience procedures for the Phase 0 through Phase 26 platform. This phase does not add user-facing modules and does not make destructive schema changes.

## Backup Architecture

### Database Backups

Primary database backup scope:

- Supabase Postgres data
- Auth user records and identities
- ERP tenant data
- Payment, reconciliation and accounting records
- Audit and governance records
- CMS and commerce records

Backup foundation:

- Use Supabase managed backups as the primary recovery source.
- Export schema and migration history before production deployments.
- Preserve all migration files in Git as the source of schema history.
- Run read-only backup verification SQL after backup restoration tests.

Retention recommendation:

- Daily point-in-time backups: minimum 7 days
- Weekly restore point snapshots: minimum 4 weeks
- Monthly compliance snapshots: minimum 12 months
- Pre-deployment snapshots: retain for at least 30 days

Ownership:

- Technical owner: platform administrator
- Business owner: finance/operations owner for ERP data
- Recovery approval: platform owner plus business owner for production restore

Verification:

- Monthly restore rehearsal in staging
- Row count comparison for critical tables
- Tenant ownership integrity checks
- Accounting and payment consistency checks
- RLS and policy checks from Phase 26 verification queries

### Storage Backups

Storage scope:

- Public website media
- Uploaded documents
- Product media
- ERP attachments and document metadata
- Any future private storage buckets

Backup foundation:

- Inventory all Supabase storage buckets before production launch.
- Separate public media buckets from private ERP document buckets.
- Mirror private buckets to a controlled secondary storage location.
- Verify object count, object path, object metadata and access level after restore.

Retention recommendation:

- Public media: 30-day rolling retention
- Private ERP documents: 12-month minimum retention
- Legal/finance documents: follow business/legal retention policy

### Configuration Backups

Configuration scope:

- Supabase project configuration
- Edge Function secrets
- Edge Function deployment versions
- Auth provider configuration
- SMTP/provider credentials references
- Payment provider configuration
- DNS and domain routing references

Backup foundation:

- Store non-secret configuration in Git where safe.
- Store secrets only in the Supabase dashboard or secret manager.
- Maintain a sealed secret inventory listing secret names, owner and rotation date, without secret values.
- Export Edge Function deployment metadata before major releases.

### Migration Backups

Migration scope:

- `supabase/migrations`
- `supabase/functions`
- `supabase/config.toml`
- Manual SQL references under `supabase/manual`

Backup foundation:

- Git is the canonical migration backup.
- Every production deployment must reference a commit hash.
- Pre-deployment migration checklist must include a rollback decision path.
- Never edit applied migration files after deployment; add corrective migrations.

## Recovery Architecture

### Database Restore Workflow

1. Declare incident severity and freeze writes where possible.
2. Identify restore target: full database, table-level repair or point-in-time restore.
3. Confirm latest safe restore point.
4. Export current production metadata for investigation before restore.
5. Restore to staging first.
6. Run verification queries:
   - RLS policy coverage
   - tenant ownership counts
   - accounting/payment consistency
   - inventory consistency
   - audit log continuity
7. Obtain business approval for production restore.
8. Execute production restore.
9. Re-run verification.
10. Resume operations and publish internal incident summary.

### Storage Restore Workflow

1. Identify affected bucket and object paths.
2. Confirm whether issue is deletion, corruption, permission error or metadata mismatch.
3. Restore objects to staging or temporary bucket first.
4. Verify file count, path, size, MIME type and access level.
5. Restore production bucket objects.
6. Re-link ERP or CMS metadata if needed.
7. Re-run access tests for public/private boundaries.

### Accidental Record Deletion

Preferred order:

1. Restore from audit log if record payload is available.
2. Restore from staging clone or point-in-time backup.
3. Recreate record manually with documented approval.
4. Link recreated record to original tenant, branch and audit context.

Required checks:

- Confirm `company_id` and `branch_id`.
- Confirm financial/accounting side effects.
- Confirm inventory side effects.
- Confirm customer/order/payment side effects.
- Add an incident audit note.

### Failed Migration Rollback

Rollback decision:

- If migration has not reached production, stop deployment and fix forward.
- If migration is applied in production and is non-destructive, add corrective migration.
- If migration causes data loss or severe outage, restore from backup after approval.

Rollback checklist:

- Identify migration file and commit.
- Identify affected tables, policies, functions and triggers.
- Check whether user traffic wrote new data after the migration.
- Prefer forward-only corrective migration.
- Use restore only when forward repair cannot protect data integrity.

### Failed Deployment Rollback

1. Stop rollout.
2. Confirm whether schema migration was applied.
3. If no schema migration was applied, redeploy previous frontend/Edge Function version.
4. If schema migration was applied, verify backward compatibility.
5. If incompatible, deploy fix-forward patch or restore according to database workflow.
6. Run smoke checks for ERP login, reporting, checkout, payment creation and webhook receipt.

## Operational Runbooks

### Authentication Failures

Symptoms:

- ERP users cannot log in.
- Customer portal sessions fail.
- Authenticated API calls return 401/403.

Actions:

- Check Supabase Auth service status.
- Verify user account exists and is active.
- Verify `admin_users`, `erp_users` and `company_memberships`.
- Verify JWT freshness and session expiry.
- Confirm RLS policies were not changed in the latest migration.
- Escalate if multiple companies or all users are affected.

### Payment Provider Outages

Symptoms:

- Payment sessions cannot be created.
- Provider health shows degraded/down.
- Customers report failed checkout payment.

Actions:

- Check `payment_provider_health`.
- Check latest `payment_provider_events`.
- Switch affected orders to ERP review/manual follow-up.
- Notify operations and finance.
- Keep order/invoice/payment/accounting state unchanged until provider result is verified.
- Reconcile after provider recovery.

### Webhook Failures

Symptoms:

- Payments do not reconcile.
- Duplicate or failed provider events increase.
- Webhook endpoint returns 400/500.

Actions:

- Check provider dashboard delivery logs.
- Check signature secret configuration.
- Review `payment_provider_events` failed rows.
- Confirm duplicate and payload hash behavior.
- Replay only verified provider events.
- Do not manually mark payment paid without invoice/payment/accounting consistency review.

### Email Delivery Failures

Symptoms:

- Order confirmation, quotation or notification emails fail.
- SMTP errors appear in Edge Function logs.

Actions:

- Verify SMTP credentials and sender limits.
- Check `notification-dispatch` logs.
- Confirm recipient email address and template data.
- Queue manual follow-up for finance/customer-facing emails.
- Rotate SMTP app password if compromise is suspected.

### Inventory Synchronization Issues

Symptoms:

- Stock reservation mismatch.
- Inventory current stock differs from order/reservation state.
- Branch or warehouse stock appears inconsistent.

Actions:

- Freeze affected item movements.
- Compare `inventory_items`, `inventory_movements`, `shop_inventory_reservations` and order items.
- Verify company, branch and warehouse ownership.
- Reconcile with physical stock if needed.
- Add audit note for manual adjustments.

### Supabase Service Incidents

Symptoms:

- Database unavailable.
- Auth unavailable.
- Edge Functions unavailable.
- Storage unavailable.

Actions:

- Check Supabase status page.
- Classify incident as read-only degradation, write outage or full outage.
- Pause risky operations such as payment reconciliation and inventory writes.
- Communicate operational status internally.
- Resume with data integrity checks after service recovery.

## Business Continuity Foundation

Recovery priorities:

1. Authentication and administrator access
2. Tenant isolation and RLS safety
3. Payment/webhook/accounting integrity
4. Commerce order capture
5. Inventory and fulfillment continuity
6. CRM/sales workflows
7. CMS/public content updates
8. Reporting and analytics

Company-level outage:

- Confirm whether outage is tenant data, user membership, branch data or provider-specific.
- Keep unaffected companies operating if tenant isolation is intact.
- Avoid global restore unless multiple tenants are corrupted.

Branch-level outage:

- Isolate branch workflows.
- Keep company-level finance and other branches running.
- Recover branch inventory, users and documents with branch ownership checks.

Commerce interruption:

- Disable payment capture if provider state cannot be verified.
- Preserve carts and order attempts.
- Reconcile customer-facing status after recovery.

ERP interruption:

- Keep public commerce read surfaces available if safe.
- Freeze manual finance operations until audit integrity is confirmed.

## Monitoring and Alerting Strategy

No paid tooling is required for the foundation.

Application monitoring:

- Use frontend error logs and deployment logs.
- Track build/deploy status per commit.
- Add future health endpoint for ERP shell and public website.

Database monitoring:

- Use Supabase dashboard metrics.
- Monitor connection count, query latency and database size.
- Run scheduled verification queries in staging and before major releases.

Payment monitoring:

- Monitor `payment_provider_health`.
- Track failed `payment_provider_events`.
- Track pending `payment_reconciliation_logs`.
- Alert finance on manual review queue growth.

Webhook monitoring:

- Track failed webhook rows.
- Track duplicate event rows.
- Track provider delivery dashboard failures.
- Verify secret rotation dates.

Commerce monitoring:

- Track checkout failure events.
- Track inventory reservation mismatches.
- Track pending fulfillment and returns.
- Track email notification failures.

Future-ready architecture:

- Supabase logs for operational triage
- SQL views/RPCs for health summaries
- GitHub Actions for build/deploy status
- Provider dashboards for payment/webhook status
- Manual alert checklist until automated alerting is introduced

## Data Integrity Verification

### Accounting Consistency

Verify:

- Paid orders have invoice, payment and accounting entry linkage.
- Refunds have refund operation and accounting entry linkage.
- No duplicate posted accounting entries for the same payment/refund.

Procedure:

- Run payment/accounting reconciliation query after restore or migration.
- Review mismatches before marking incident resolved.

### Payment Consistency

Verify:

- Provider event exists for provider payment state.
- `shop_payment_statuses` aligns with `orders.payment_status`.
- Reconciliation status is not stuck in pending/manual review without owner.

### Inventory Consistency

Verify:

- Inventory item stock matches movement/reservation history.
- Reservations are released after rollback.
- Warehouse and branch ownership are preserved.

### Tenant Isolation Consistency

Verify:

- Restored rows retain `company_id` and `branch_id`.
- Membership records still match ERP user assignments.
- RLS broad policies do not reappear.
- Null-company rows are only approved legacy exceptions.

### Audit Log Consistency

Verify:

- Critical manual recovery actions have audit notes.
- Payment, refund and accounting changes are traceable.
- Incident actions are linked to company/branch where applicable.

## Deployment Governance

### Pre-Deployment Checklist

- Confirm clean Git status.
- Confirm build passes.
- Review migration files for destructive operations.
- Confirm backup/restore point availability.
- Confirm Edge Function secrets exist in target environment.
- Confirm RLS/security migration impact.
- Confirm rollback path.
- Notify stakeholders for high-risk deployments.

### Migration Checklist

- Read migration SQL end to end.
- Confirm no accidental drop/truncate/destructive update.
- Confirm RLS policies do not broaden tenant access.
- Confirm public grants are intentional.
- Apply to staging first.
- Run Phase 26 verification SQL.
- Record migration commit hash.

### Post-Deployment Checklist

- Confirm ERP login.
- Confirm tenant-scoped ERP data load.
- Confirm reporting filters.
- Confirm checkout creation.
- Confirm payment provider health.
- Confirm webhook endpoint response.
- Confirm notification/email path.
- Confirm `git status` and deployed commit.

### Rollback Checklist

- Identify whether schema changed.
- If no schema change, redeploy previous app/functions.
- If schema changed, decide fix-forward vs restore.
- Do not delete migrations.
- Preserve logs and audit evidence.
- Confirm finance/payment/accounting integrity after rollback.

## Security Incident Response

Incident classification:

- SEV-1: active data leak, tenant isolation bypass, credential compromise, payment/accounting corruption
- SEV-2: partial outage, provider failure, failed migration with recoverable impact
- SEV-3: degraded performance, isolated branch issue, non-critical workflow failure
- SEV-4: documentation/configuration issue with no production impact

Escalation workflow:

1. Identify incident owner.
2. Preserve logs and current state.
3. Stop further damage.
4. Notify business owner.
5. Notify finance/security stakeholders if payment or accounting is involved.
6. Decide containment, recovery and communication plan.

Investigation workflow:

- Capture commit, migration and deployment details.
- Review Supabase logs.
- Review Edge Function logs.
- Review audit logs.
- Review provider dashboard logs.
- Verify tenant boundaries.

Audit review workflow:

- Confirm what changed.
- Confirm who initiated the action.
- Confirm affected company/branch/customer/order/payment records.
- Record root cause and corrective action.

## Multi-Company Recovery Review

Recovery must preserve:

- `companies`
- `company_branches`
- `warehouses`
- `company_memberships`
- `company_id` and `branch_id` on operational records
- Accounting and payment ownership relationships

Rules:

- Never restore one company by overwriting another company.
- Prefer table/row-level repair for isolated tenant damage.
- Validate memberships before reopening tenant access.
- Validate branch ownership before reopening branch operations.
- Backups must preserve ownership relationships and foreign keys.

## Risks

- Supabase CLI is not installed locally, so live advisor checks require Supabase Dashboard or another machine.
- Legacy null-company data remains a recovery and tenant-isolation risk until backfilled.
- Storage bucket posture must be confirmed in the live Supabase project.
- Payment provider timestamp-window replay validation should be strengthened with real provider payloads.
- Manual runbooks depend on disciplined incident ownership until automated alerting is implemented.

## Recommendations

- Run monthly staging restore rehearsals.
- Run Phase 26 verification SQL after each security or migration deployment.
- Create a sealed secret inventory with rotation dates.
- Backfill legacy company/branch ownership before strict enterprise launch.
- Add automated daily integrity checks for accounting, payments, inventory and tenant isolation.
- Add provider-specific webhook timestamp validation.
- Add branch/warehouse-aware inventory reconciliation views.

## Proposed Phase 28 Scope

Recommended Phase 28 scope:

- Automated integrity verification jobs
- Scheduled operational health summaries
- Tenant ownership backfill execution
- Storage bucket governance implementation
- Provider-specific webhook replay window hardening
- Production deployment checklist automation
- Staging restore rehearsal evidence pack
