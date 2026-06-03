# Phase 28 Operational Observability, Health Monitoring and Platform Management Report

## Repository Summary

Phase 28 moves the ERP from recovery-ready operations into an observable platform foundation. The implementation adds a centralized ERP Health Center, reusable observability metrics helpers, audit log exploration, platform event timeline, alert definitions, governance summaries, and scheduled operations readiness without adding destructive schema changes or new modules outside the existing ERP shell.

Visible ERP UI text added in this phase is Turkish. Code, comments, and documentation remain English.

## Observability Architecture

The new ERP Health Center is implemented at `src/features/erp/observability/ERPHealthCenterPage.tsx` and is available through the `/health` ERP route. Navigation is exposed as `Sağlık Merkezi` from the ERP module registry and from the Reports application group.

The Health Center aggregates existing operational data from:

- ERP database readiness metadata.
- Company and branch context.
- ERP audit logs.
- Notifications and operational signals.
- Payment provider events and provider health.
- Payment reconciliation logs and refund operations.
- Accounting entries and payment statuses.
- Fulfillment, shipment, return, inventory, media, and document records.

The page is intentionally read-only. It does not create operational records, migrations, payment records, accounting entries, or tenant data.

## Monitoring Architecture

The monitoring foundation provides status cards for:

- Application health.
- Database health.
- Edge Function health.
- Payment provider health.
- Webhook health.
- Queue health.
- Storage health.
- Inventory health.

Current health calculations are derived from existing records:

- Failed provider events indicate Edge Function and webhook risk.
- Failed payment statuses and provider health rows indicate payment risk.
- Pending reconciliation and unread notifications indicate queue pressure.
- Missing document/media file paths indicate storage integrity risk.
- Low stock rows indicate inventory operational risk.
- ERP database readiness comes from the existing database status API.

No external paid monitoring service is required.

## Metrics Architecture

Reusable metric helpers were added in `src/features/erp/observability/observabilityMetrics.ts`.

The framework includes common types and utilities for:

- Operational tone mapping.
- Health status summarization.
- Percentage calculation.
- Metric construction.
- Platform timeline sorting.

Initial metrics exposed in the Health Center include:

- İşlem Hacmi.
- Hata Oranı.
- Tekrar Olayları.
- Gecikme Takibi.
- Ödeme Olayları.
- Webhook Hataları.
- ERP Aksiyonları.
- Stok Uyarısı.
- Bekleyen İade.
- Okunmamış Bildirim.

Route, API, database, and Edge Function latency metrics are marked as prepared foundations. Future phases can replace placeholder readiness indicators with persisted timing records.

## Alert Architecture

Alert definitions are implemented as deterministic, local ERP conditions. Initial alert coverage includes:

- Failed payments.
- Webhook failures.
- Synchronization failures.
- Inventory inconsistencies.
- Authentication anomalies.

Alert severity is derived from existing operational counts and presented as Turkish status labels. The architecture is provider-neutral and does not require external alerting. Future delivery channels can subscribe to the same alert definitions.

## Audit Exploration Architecture

The existing audit architecture was expanded with a general `listAuditLogs` API in `src/features/erp/shared/erpApi.ts`.

The Audit Explorer supports:

- Free text search.
- Actor filtering.
- Company filtering.
- Branch filtering.
- Module/entity tracing.
- Action tracing.

The UI displays actor, scope, module, action, timestamp, and description. Company and branch context are resolved from existing company and branch registries. Tenant isolation remains dependent on existing Supabase RLS and scoped query behavior established in earlier phases.

## Platform Event Architecture

The Platform Event Timeline merges operational signals from:

- Payment provider events.
- Fulfillment history.
- Inventory movements.
- ERP audit logs.
- Notifications and automation events.

Each timeline event carries module, title, description, actor/source, company context, branch context, timestamp, and tone. The timeline is read-only and prepared for additional event sources such as scheduled job runs, backup verification, deployment events, and Edge Function execution logs.

## Multi-Company Operational Visibility

Phase 28 uses existing company and branch fields to support:

- Company-level audit tracing.
- Branch-level audit tracing.
- Consolidated health and metric summaries.
- Timeline scope visibility.

The Health Center does not bypass authorization or tenant isolation. Data visibility remains governed by the existing ERP API calls and Supabase policies. Future enhancements should add persisted observability tables with explicit `company_id` and `branch_id` fields for every metric, alert, and scheduled job execution record.

## Governance Reporting

The Governance tab provides summaries for:

- Security audit events.
- Operational event volume.
- Backup verification readiness.
- Incident signal count.

The implementation reuses Phase 27 recovery and backup readiness as a visible operational checkpoint while avoiding new backup automation side effects.

## Scheduled Operations Foundation

The scheduled operations foundation documents initial operational jobs in the Health Center:

- Reconciliation check.
- Inventory verification.
- Webhook cleanup.
- Backup verification.
- RLS control.

These jobs are presented as platform management definitions only. No scheduler, cron migration, or destructive automation was added in this phase.

## Performance Visibility Strategy

Initial performance visibility is prepared for:

- Route performance through future client-side timing capture.
- API performance through Supabase result/error tracking.
- Database performance through readiness checks and future query metrics.
- Edge Function performance through provider event, webhook, and failure records.

Build output still reports existing large chunks:

- `Kargo-DUTh3l9y.js`
- `index-COK3rIDN.js`
- main application chunk above 500 kB
- `ReportsPage` remains large but below the largest application bundles

The build also reports:

- Browserslist data is 12 months old.
- `pdfjs-dist/build/pdf.js` uses `eval`.

These are not new Phase 28 blockers, but they remain production hardening items.

## Supabase Mapping

Phase 28 reads from existing Supabase-backed structures only:

- `erp_audit_logs`
- company and branch tables
- notification tables
- payment provider event and health tables
- payment reconciliation and refund tables
- accounting entries
- commerce payment, shipment, fulfillment, and return records
- inventory items and movements
- website media and document metadata

No migration was created. No RLS policy was modified. No Edge Function was changed.

## Security Findings

The Health Center is exposed through the ERP route system and the `reports.view` navigation permission.

Security posture:

- Read-only operational view.
- No payment provider secret exposure.
- No webhook payload mutation.
- No refund or accounting mutation.
- No service-role client usage in frontend.
- Company and branch visibility follows existing scoped APIs and RLS.

Remaining security considerations:

- Persisted observability metrics should include tenant context and RLS policies before write-side observability is added.
- Alert acknowledgements should be role-restricted when implemented.
- Audit search should remain bounded and paginated for production-scale datasets.

## Risks

- Health Center aggregation currently loads several datasets in parallel and may need server-side summaries as data grows.
- Some performance metrics are readiness indicators rather than persisted timing measurements.
- Alert definitions are local computed conditions and do not yet create durable alert events.
- Audit Explorer uses client-side filtering after bounded retrieval.
- Existing build warnings for large chunks, stale Browserslist data, and pdf.js `eval` remain.

## Recommendations

- Add persisted `platform_metrics`, `platform_events`, `platform_alerts`, and `scheduled_job_runs` tables with company and branch context in a future migration.
- Add RLS policy tests for the future observability tables before write-side event ingestion.
- Move high-volume audit and timeline filtering to server-side RPC or indexed SQL views.
- Add lightweight route and API timing capture.
- Split large route chunks, especially cargo/PDF/reporting dependencies.
- Update Browserslist data during a dependency maintenance phase.
- Review pdf.js usage and isolate PDF worker dependencies where possible.

## Proposed Phase 29 Scope

Recommended Phase 29 scope:

- Persisted observability event store.
- Scheduled job execution records.
- Alert acknowledgement workflow.
- Server-side metrics aggregation.
- Route/API latency capture.
- Indexed audit search.
- Tenant-scoped observability RLS policies.
- Optional email/in-app notification delivery for critical platform alerts.

## Validation

- `npm run build`: Passed.
- `git status`: To be captured after final file review and before commit.
