-- Backfill parasut.sales_invoices.gross_total (numeric column added by
-- 20260723103525_parasut_full_apidocs_schema_expansion.sql) from the
-- already-synced `attributes` jsonb, for the same reason as
-- 20260725151238_backfill_parasut_contacts_balance_columns.sql: the sync is
-- a content-hash upsert, so a row whose Paraşüt data hasn't changed since its
-- last sync is only touched (last_seen_at bump), never rewritten. Live
-- production verification of the "Tutar" numeric-sort fix found exactly this
-- gap: the most recently synced invoice (parasut_id 1093897762,
-- gross_total "46000.0" in attributes) had gross_total = NULL in the typed
-- column and sorted to the very bottom of a descending sort instead of its
-- correct rank, while most other invoices already carried a populated value
-- from an earlier write path.
--
-- Safety: additive only (the column already exists as `numeric`), touches
-- only parasut.sales_invoices, and only backfills rows where gross_total is
-- currently NULL, so it can never overwrite a value already present. The
-- `~ '^-?\d+(\.\d+)?$'` guard skips (leaves NULL) any value that isn't a
-- clean canonical decimal string rather than risking a failed cast.
update parasut.sales_invoices
set gross_total = (attributes->>'gross_total')::numeric
where
  gross_total is null
  and (attributes->>'gross_total') ~ '^-?\d+(\.\d+)?$';
