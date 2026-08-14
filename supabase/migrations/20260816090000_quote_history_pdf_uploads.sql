-- "Geçmiş Teklif Ekle" gains a required PDF attachment: a private Storage
-- bucket for the files, plus the columns on quote_history_entries needed
-- to locate/describe each one. Additive only — no existing table altered
-- destructively, no existing row touched.

begin;

alter table public.quote_history_entries
  add column if not exists file_path text null,
  add column if not exists file_name text null,
  add column if not exists file_mime text null,
  add column if not exists file_size bigint null;

-- Nullable: rows created before this migration (note-only entries) have no
-- file. The application layer, not a DB constraint, requires a file for
-- every NEW entry going forward — a NOT NULL here would either break on
-- historical rows or require a destructive backfill, neither appropriate.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('quote-documents', 'quote-documents', false, 20971520, array['application/pdf'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Same "trusted authenticated ERP staff" model as every other table in
-- this module (see 20260814120000's RLS section) — scoped strictly to
-- this one bucket via bucket_id, so it grants nothing on any other
-- bucket. No public/anon access at any point; every read goes through a
-- short-lived signed URL (application code), never a public URL.
drop policy if exists "quote-documents authenticated read" on storage.objects;
create policy "quote-documents authenticated read"
on storage.objects for select
to authenticated
using (bucket_id = 'quote-documents');

drop policy if exists "quote-documents authenticated insert" on storage.objects;
create policy "quote-documents authenticated insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'quote-documents');

drop policy if exists "quote-documents authenticated update" on storage.objects;
create policy "quote-documents authenticated update"
on storage.objects for update
to authenticated
using (bucket_id = 'quote-documents')
with check (bucket_id = 'quote-documents');

drop policy if exists "quote-documents authenticated delete" on storage.objects;
create policy "quote-documents authenticated delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'quote-documents');

commit;
