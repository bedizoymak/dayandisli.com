-- Keep these mirrors compatible with the shared JSON:API upsert envelope.
-- Additive only; no existing financial row is rewritten or deleted.
alter table parasut.transaction_history_items
  add column if not exists included jsonb not null default '[]'::jsonb;

alter table parasut.opening_balances
  add column if not exists included jsonb not null default '[]'::jsonb;
