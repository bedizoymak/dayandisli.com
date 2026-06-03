# Phase 29 Persisted Observability, Scheduled Jobs and Alert Workflow Report

## Summary

Phase 29 moves the Phase 28 Health Center from read-only computed observability toward durable operational monitoring. It adds persisted observability tables, tenant-scoped RLS, alert lifecycle APIs, scheduled job run records, server-side summary access, and audit search indexes.

Visible ERP UI added or changed in this phase remains Turkish. Code, documentation, migration names, database fields, and commit text remain English.

## Persisted Observability Tables

Migration:

- `supabase/migrations/20260603143000_phase29_persisted_observability_alert_workflow.sql`

New tables:

- `platform_metrics`
- `platform_events`
- `platform_alerts`
- `scheduled_job_runs`

Each table includes:

- `company_id`
- `branch_id`
- severity or status fields
- source/module fields
- timestamps
- `metadata jsonb`

All tables are non-destructive additions. No existing data is deleted or rewritten.

## RLS And Tenant Safety

RLS is enabled on every new table.

Access model:

- `anon` receives no table access.
- `authenticated` receives table-level select/insert/update grants.
- Row visibility and writes require an active `company_memberships` row matching `company_id`.
- Branch-scoped rows are visible only when the user has matching branch membership or company-level membership with `branch_id` null.
- `company_id` is required on new persisted observability rows, preventing global null-company visibility.

This preserves the Phase 25/26 tenant isolation posture and avoids cross-company observability leakage.

## Scheduled Job Records

`scheduled_job_runs` tracks non-destructive job records for:

- reconciliation checks
- inventory verification
- webhook cleanup
- backup verification
- RLS control checks

No cron job, destructive cleanup, rollback automation, or external scheduler was added. The implementation stores run records and makes the Health Center ready to display them when jobs begin writing durable runs.

## Alert Workflow

The ERP API now supports:

- alert creation through `createPlatformAlert`
- alert acknowledgement through `acknowledgePlatformAlert`
- alert resolution through `resolvePlatformAlert`
- alert history through related `platform_events`

Acknowledgement and resolution both create platform event history records. The Health Center displays persisted alerts when available and exposes Turkish action buttons:

- `Onayla`
- `Çöz`

If no persisted alerts exist, the Health Center continues to show computed Phase 28 alert conditions.

## Server-Side Metrics Aggregation

The API now exposes `listPlatformOperationalSummary`, which loads persisted metrics, events, alerts, and scheduled job runs through tenant-scoped queries. The Health Center consumes this summary and prefers durable rows over heavy local aggregation where data exists.

Phase 28 computed signals remain as fallback until scheduled jobs and Edge Functions begin writing durable metrics/events.

## Audit Search Improvement

The migration adds audit search foundations:

- `idx_erp_audit_logs_scope_search`
- `idx_erp_audit_logs_text_search`

These prepare indexed/server-side audit search by company, branch, entity, action, timestamp, actor, and description text. The existing Audit Explorer remains compatible and can move from bounded client filtering to indexed RPC or SQL view search in a future phase.

## Health Center Integration

Updated files:

- `src/features/erp/observability/ERPHealthCenterPage.tsx`
- `src/features/erp/shared/erpApi.ts`
- `src/features/erp/shared/types.ts`

Health Center behavior:

- loads persisted operational summary
- displays persisted metrics when available
- merges persisted platform events into the event timeline
- shows persisted alert workflow records when available
- displays persisted scheduled job runs when available
- keeps computed observability as fallback

The ERP database readiness inventory now includes the four Phase 29 tables.

## Supabase Mapping

New tables are in the public schema and protected by RLS.

Important Supabase notes:

- The local machine does not have the Supabase CLI installed, so `supabase migration new` could not be used.
- The migration was created manually using the repository's existing timestamped migration naming pattern.
- Because recent Supabase Data API settings can require explicit table grants, the migration grants `select`, `insert`, and `update` to `authenticated` while keeping `anon` revoked and RLS enforced.

## SQL Verification Queries

After applying the migration, run:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('platform_metrics', 'platform_events', 'platform_alerts', 'scheduled_job_runs');
```

```sql
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('platform_metrics', 'platform_events', 'platform_alerts', 'scheduled_job_runs')
order by tablename, policyname;
```

```sql
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename in ('platform_metrics', 'platform_events', 'platform_alerts', 'scheduled_job_runs', 'erp_audit_logs')
order by tablename, indexname;
```

Tenant isolation smoke test:

```sql
-- As an authenticated user with membership in company A only,
-- rows for company B should not be returned.
select id, company_id
from public.platform_alerts;
```

## Risks

- The migration has not been applied in this local environment because Supabase CLI is unavailable.
- Persisted observability rows require a valid company context; users without default or explicit company scope cannot create rows from the frontend.
- Durable metrics depend on future jobs, Edge Functions, or admin workflows writing records.
- Audit Explorer still performs bounded client filtering until a future indexed RPC/search endpoint is added.
- Existing build warnings remain: stale Browserslist data, pdf.js `eval`, and large chunks.

## Recommendations

- Apply the migration in Supabase and run the verification queries above.
- Add Edge Function writes for payment/webhook provider metrics.
- Add scheduled job writers for reconciliation, inventory verification, backup verification, webhook cleanup, and RLS checks.
- Add indexed RPC audit search after observing real audit volume.
- Consider an alert acknowledgement permission gate if non-admin report viewers should not manage operational alerts.
- Add retention policy planning before metrics/events become high volume.

## Proposed Phase 30 Scope

Recommended Phase 30 scope:

- Scheduled job execution automation.
- Edge Function observability emitters.
- Alert notification delivery.
- Indexed audit search RPC.
- Metrics retention and archive strategy.
- Operational dashboards by company and branch.
- Production migration verification and RLS test scripts.

## Validation

- `npm run build`: Passed.
- Supabase CLI: unavailable on this machine, so migration generation/application via CLI was not executed.
- `git status`: captured before commit.
