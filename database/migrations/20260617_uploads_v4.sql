-- FinanceOps v4 upload MVP migration
-- Run this in Supabase SQL Editor before using the new upload screen.

create table if not exists upload_raw_rows (
  id uuid primary key default uuid_generate_v4(),
  upload_batch_id uuid not null references upload_batches(id) on delete cascade,
  row_index integer not null,
  raw_data jsonb not null,
  normalized_data jsonb,
  parse_status text not null default '확인필요' check (parse_status in ('정상', '확인필요', '오류')),
  memo text,
  created_at timestamptz not null default now()
);

create index if not exists idx_upload_raw_rows_batch on upload_raw_rows(upload_batch_id);
create index if not exists idx_transactions_upload_batch on transactions(upload_batch_id);
create index if not exists idx_upload_batches_uploaded_at on upload_batches(uploaded_at desc);

alter table upload_raw_rows enable row level security;

drop policy if exists "allowed users can read upload raw rows" on upload_raw_rows;
create policy "allowed users can read upload raw rows"
on upload_raw_rows
for select
using (auth.email() in (select email from allowed_users where status = 'active'));

-- The app writes upload data through server-side service role routes.
-- Client-side users only need read access for now.
