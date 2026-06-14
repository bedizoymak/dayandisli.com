-- AUTH-4: remove legacy authorization objects after unified ERP-user verification.
-- This migration fails closed if any effective external dependency remains.

do $$
declare
  dependency_record record;
  dependency_summary text;
begin
  select string_agg(format('%s:%s', dependency.kind, dependency.identity), ', ')
  into dependency_summary
  from (
    select
      'policy'::text as kind,
      schemaname || '.' || tablename || '.' || policyname as identity
    from pg_policies
    where coalesce(qual, '') ~* '(admin_users|allowed_emails|is_email_allowed)'
       or coalesce(with_check, '') ~* '(admin_users|allowed_emails|is_email_allowed)'

    union all

    select
      'view',
      schemaname || '.' || viewname
    from pg_views
    where schemaname not in ('pg_catalog', 'information_schema')
      and definition ~* '(admin_users|allowed_emails|is_email_allowed)'

    union all

    select
      'function',
      namespace.nspname || '.' || procedure.proname
    from pg_proc as procedure
    join pg_namespace as namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname not in ('pg_catalog', 'information_schema')
      and procedure.prokind in ('f', 'p')
      and not (
        namespace.nspname = 'public'
        and procedure.proname = 'is_email_allowed'
      )
      and pg_get_functiondef(procedure.oid)
        ~* '(admin_users|allowed_emails|is_email_allowed)'

    union all

    select
      'trigger',
      namespace.nspname || '.' || relation.relname || '.' || trigger.tgname
    from pg_trigger as trigger
    join pg_class as relation on relation.oid = trigger.tgrelid
    join pg_namespace as namespace on namespace.oid = relation.relnamespace
    where not trigger.tgisinternal
      and pg_get_triggerdef(trigger.oid)
        ~* '(admin_users|allowed_emails|is_email_allowed)'
  ) as dependency;

  if dependency_summary is not null then
    raise exception
      'Legacy authorization cleanup refused. Effective dependencies remain: %',
      dependency_summary;
  end if;

  for dependency_record in
    select
      dependent_namespace.nspname as schema_name,
      dependent_relation.relname as relation_name
    from pg_depend as dependency
    join pg_rewrite as rewrite on rewrite.oid = dependency.objid
    join pg_class as dependent_relation on dependent_relation.oid = rewrite.ev_class
    join pg_namespace as dependent_namespace
      on dependent_namespace.oid = dependent_relation.relnamespace
    where dependency.refobjid in (
      to_regclass('public.admin_users'),
      to_regclass('public.allowed_emails')
    )
      and dependent_relation.oid not in (
        to_regclass('public.admin_users'),
        to_regclass('public.allowed_emails')
      )
  loop
    raise exception
      'Legacy authorization cleanup refused. Database dependency remains: %.%',
      dependency_record.schema_name,
      dependency_record.relation_name;
  end loop;
end $$;

drop function if exists public.is_email_allowed(text);
drop table if exists public.admin_users;
drop table if exists public.allowed_emails;
