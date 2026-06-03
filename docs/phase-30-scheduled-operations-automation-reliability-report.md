# Phase 30 Scheduled Operations, Automation and Reliability Report

## Summary

Phase 30 converts the recovery, observability, and persisted alert foundations from Phases 27-29 into an executable operational automation layer. The implementation introduces a tenant-scoped scheduled operations engine, reusable job registration and execution framework, automation rule/execution storage, alert automation integration, reliability dashboard visibility, SLA-ready metrics, and expanded audit/event history.

No external scheduler was introduced. All execution is currently invoked from the ERP Health Center or ERP API.

## Job Engine Architecture

The job engine is implemented in `src/features/erp/shared/erpApi.ts`.

Registered jobs:

- reconciliation checks
- inventory verification
- backup verification
- webhook cleanup
- tenant isolation verification
- RLS control checks
- observability aggregation

Execution lifecycle:

- queued
- running
- completed
- failed
- cancelled

Compatibility statuses from Phase 29, including `scheduled` and `success`, remain accepted for existing records.

Execution behavior:

- creates a `scheduled_job_runs` record
- marks the run as running
- executes the registered handler
- writes platform metrics
- writes platform events
- writes alerts when a risk is detected
- writes ERP audit logs
- stores duration, retry count, failure reason, and next retry timestamp

The job engine is intentionally non-destructive. The webhook cleanup job records duplicate and failed webhook risk but does not delete provider event records.

## Automation Architecture

Migration:

- `supabase/migrations/20260603150000_phase30_scheduled_operations_automation_reliability.sql`

New tables:

- `automation_rules`
- `automation_executions`

Automation rule fields include:

- tenant scope (`company_id`, `branch_id`)
- `rule_key`
- trigger event
- condition JSON
- action JSON
- status
- severity
- module/source
- metadata

Automation execution fields include:

- rule linkage
- trigger event
- execution status
- retry counts
- duration
- event/alert/job/audit links
- failure reason
- metadata

The ERP API exposes:

- `listAutomationRules`
- `createAutomationRule`
- `listAutomationExecutions`
- `triggerAutomationEvent`

Supported action foundation:

- run a registered operational job
- create an alert
- send an ERP notification

Example rule patterns prepared:

- Payment Received -> Reconciliation Check
- Shipment Delivered -> Customer Notification
- Inventory Threshold Reached -> Alert Creation

## Alert Automation Architecture

Phase 30 integrates directly with Phase 29 alert workflow:

- jobs create alerts when verification detects risk
- automation rules can create alerts
- failed jobs create critical alerts when retry capacity is exhausted
- alert lifecycle remains handled through `platform_alerts`
- alert history is written to `platform_events`

Automatic escalation is represented through:

- critical severity
- retry exhaustion
- platform event history
- audit log records

Automatic resolution checks are prepared through scheduled operation handlers and alert workflow APIs. Full closed-loop resolution rules should be implemented after production metrics volume is observed.

## Reliability Architecture

The ERP Health Center now includes a `Güvenilirlik` tab with Turkish UI.

It displays:

- job success rate
- job failure rate
- retry count
- automation success rate
- automation failure rate
- registered job list
- job execution history
- automation execution history
- SLA readiness notes

Operators can run registered operational jobs from the Health Center. Jobs use the selected company/branch filter when provided, otherwise the API requires the user's default company scope. No global cross-tenant run is created.

## Audit Integration

Audit expansion includes:

- scheduled job completion
- scheduled job retry queueing
- scheduled job failure
- automation completion
- automation failure
- alert creation through job and automation outcomes

Audit rows include company and branch scope. Platform events and scheduled job records also link to related audit rows when available.

## Tenant Isolation Review

Phase 30 preserves the Phase 29 tenant model:

- `automation_rules` and `automation_executions` have required `company_id`.
- RLS is enabled on both new tables.
- `anon` has no access.
- authenticated access requires active company membership.
- branch rows require matching branch membership unless the membership is company-level.
- job execution refuses to run without company scope.

Operational jobs and automation actions write scoped records only. There is no cross-company execution path.

## Supabase Mapping

Phase 30 updates Supabase through one non-destructive migration:

- expands `scheduled_job_runs.status`
- expands `scheduled_job_runs.job_type`
- adds queue/retry/audit fields to `scheduled_job_runs`
- creates `automation_rules`
- creates `automation_executions`
- adds operational indexes
- enables RLS and tenant policies

The Supabase CLI remains unavailable on this local machine, so the migration was created manually following the repository's timestamped migration naming pattern.

## Performance Review

Database impact:

- new indexes target scope/status/time lookups for jobs and automation
- alert and metric writes are append-heavy and should receive retention policies later

Job execution impact:

- current jobs run in foreground from ERP API calls
- no external worker or scheduler is active yet
- long-running jobs should move to Edge Functions or background execution in a later phase

Alert volume impact:

- risk-based alert creation can create duplicate alerts if jobs are run repeatedly
- deduplication or alert coalescing should be added before high-frequency scheduling

Observability impact:

- metrics and events are durable but may grow quickly
- retention, archive, and rollup strategy should be added before production automation scales

## Risks

- The migration has not been applied locally because Supabase CLI is unavailable.
- Foreground job execution is acceptable for controlled manual runs but not ideal for heavy automation.
- Alert deduplication is not yet implemented.
- Automation condition evaluation is intentionally simple key/value matching.
- No external scheduler, queue worker, or cron execution exists yet.
- Existing build warnings remain: stale Browserslist data, pdf.js `eval`, and large chunks.

## Recommendations

- Apply Phase 29 and Phase 30 migrations in Supabase before using the Reliability tab actions.
- Add alert deduplication keyed by company, branch, alert key, and open status.
- Move job execution to Edge Functions before enabling unattended schedules.
- Add retry execution pickup for `next_retry_at`.
- Add automation rule templates for payment, shipment, and inventory events.
- Add retention policies for platform metrics, events, and automation executions.
- Add production RLS verification SQL for automation tables.

## Proposed Phase 31 Scope

Recommended Phase 31 scope:

- Edge Function backed job runner.
- Cron or queue integration after controlled validation.
- Alert deduplication and escalation policy tables.
- Automation rule template management UI.
- Retry pickup and dead-letter handling.
- Metrics retention and rollup automation.
- Production migration verification scripts.
- Operational permission gates for job execution.

## Validation

- `npm run build`: Passed.
- `git status`: captured before commit.
- Supabase CLI: unavailable locally, so migration application was not executed from this machine.
