-- Backfill parasut.contacts.{trl_balance,usd_balance,eur_balance,gbp_balance}
-- (numeric columns added by 20260723103525_parasut_full_apidocs_schema_expansion.sql,
-- never populated by any write path until now — see server/parasut/upsert-resource.ts's
-- numericAttributeFields) from the already-synced `attributes` jsonb.
--
-- Why this is needed: the Paraşüt sync is a content-hash upsert — a row whose
-- Paraşüt data hasn't changed since its last sync is only touched
-- (last_seen_at bump), never rewritten, so the new typed-column write added
-- alongside this migration will never reach any customer/supplier already
-- mirrored before today. Without this one-time backfill, the customer list's
-- balance-sort fix would silently not apply to a single existing row until
-- that contact's balance happens to change again in Paraşüt.
--
-- Safety: additive only (no column added/dropped/altered — the columns
-- already exist as `numeric`), touches only parasut.contacts,
-- resource_type = 'contacts' rows, and only backfills a column that is
-- currently NULL, so it can never overwrite a value someone already has.
-- The `~ '^-?\d+(\.\d+)?$'` guard skips (leaves NULL) any value that isn't a
-- clean canonical decimal string rather than risking a failed cast on an
-- unexpected value.
update parasut.contacts
set
  trl_balance = case when (attributes->>'trl_balance') ~ '^-?\d+(\.\d+)?$' then (attributes->>'trl_balance')::numeric else trl_balance end,
  usd_balance = case when (attributes->>'usd_balance') ~ '^-?\d+(\.\d+)?$' then (attributes->>'usd_balance')::numeric else usd_balance end,
  eur_balance = case when (attributes->>'eur_balance') ~ '^-?\d+(\.\d+)?$' then (attributes->>'eur_balance')::numeric else eur_balance end,
  gbp_balance = case when (attributes->>'gbp_balance') ~ '^-?\d+(\.\d+)?$' then (attributes->>'gbp_balance')::numeric else gbp_balance end
where
  resource_type = 'contacts'
  and (trl_balance is null or usd_balance is null or eur_balance is null or gbp_balance is null);
