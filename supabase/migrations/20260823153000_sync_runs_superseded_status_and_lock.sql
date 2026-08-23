-- Additive only: widens parasut.sync_runs.status to add "superseded",
-- a distinct terminal state for a run killed by enforceSingleRunner's FIFO
-- concurrency election before it made any request or wrote any row. It was
-- previously recorded as "failed", identical to a genuine error — that made
-- alerting on "failed" fire on routine, benign cron overlap as often as on
-- real failures, exactly how the underlying P0 sync gap stayed invisible.
--
-- Also adds a partial unique index enforcing at most one "running" row for
-- the new statement_refresh_lock resource_type per company at a time — the
-- invocation-level overlap guard for the statement-refresh cron job uses
-- this as an atomic acquire-or-fail lease (a plain read-then-insert has a
-- check-then-act race; a database-enforced uniqueness constraint does not).
-- Scoped specifically to resource_type = 'statement_refresh_lock' so it has
-- no effect on the existing six-resource sync loop's own FIFO election,
-- which intentionally still allows transient overlapping "running" rows.

alter table parasut.sync_runs
  drop constraint if exists sync_runs_status_check;
alter table parasut.sync_runs
  add constraint sync_runs_status_check
  check (status in ('running', 'completed', 'partial', 'failed', 'superseded'));

create unique index if not exists sync_runs_statement_refresh_lock_singleton
  on parasut.sync_runs (company_id, parasut_company_id)
  where resource_type = 'statement_refresh_lock' and status = 'running';
