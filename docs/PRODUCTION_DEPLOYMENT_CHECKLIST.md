# Production Deployment Checklist

## Change Information

- [ ] Owner:
- [ ] Operator:
- [ ] Reviewer:
- [ ] Approved commit:
- [ ] Migration versions:
- [ ] Manual SQL artifacts:
- [ ] Deployment window:
- [ ] Rollback owner:

## Before Deployment

- [ ] Explicit production owner approval exists.
- [ ] A current backup or restore point exists.
- [ ] Production project ref and name are independently confirmed.
- [ ] Migration list is reviewed.
- [ ] Effective policies and indexes are captured.
- [ ] Dedicated staging validation is complete.
- [ ] Generated Supabase types are reviewed and committed.
- [ ] TypeScript, tests, build, and SQL verifiers pass.
- [ ] Required integration tests pass.
- [ ] Turkish UI and validation smoke tests pass.
- [ ] Duplicate and data-integrity prerequisite queries pass.
- [ ] Feature flags and their default values are documented.
- [ ] Rollback plan is approved.
- [ ] Monitoring and incident owners are available.

## During Deployment

- [ ] Record the start time.
- [ ] Reconfirm the linked production identity.
- [ ] Apply only the approved transactional migration.
- [ ] Verify migration history immediately.
- [ ] Apply approved manual index SQL separately and without a transaction wrapper.
- [ ] Regenerate types only when explicitly included in the approved change.
- [ ] Review the generated type diff.
- [ ] Run database and application smoke tests.
- [ ] Keep new feature flags disabled until database verification passes.
- [ ] Record every command and result without secrets.

## After Deployment

- [ ] Verify RLS is enabled on scoped tables.
- [ ] Verify effective policy names, roles, predicates, and checks.
- [ ] Verify expected indexes, uniqueness, and predicates.
- [ ] Verify RPC ownership, execution mode, and grants.
- [ ] Verify feature flags match the approved state.
- [ ] Verify tenant isolation with approved test accounts.
- [ ] Verify production workflow smoke tests.
- [ ] Verify audit logs are written and tenant-scoped.
- [ ] Check application and database monitoring.
- [ ] Record completion time and final result.
- [ ] Remove temporary deployment environment variables.
- [ ] Obtain owner sign-off.

## Rollback

- [ ] Stop feature activation and further migrations.
- [ ] Disable affected feature flags when appropriate.
- [ ] Deploy the approved application rollback when appropriate.
- [ ] Use a reviewed forward corrective migration for database changes.
- [ ] Do not disable RLS or rewrite migration history.
- [ ] Verify policies, indexes, audit logs, and application behavior.
- [ ] Reconcile affected business records.
- [ ] Open and document an incident when required.
