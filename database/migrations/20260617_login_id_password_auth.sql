-- FinanceOps v3 login-id/password auth migration
-- Run this after the original schema.sql/seed.sql.

alter table allowed_users add column if not exists login_id text;
alter table allowed_users add column if not exists internal_email text;

update allowed_users
set login_id = lower(regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9._-]', '', 'g'))
where login_id is null;

update allowed_users
set internal_email = case
  when email like '%@financeops.local' then email
  else login_id || '@financeops.local'
end
where internal_email is null and login_id is not null;

create unique index if not exists allowed_users_login_id_unique on allowed_users(login_id);
create unique index if not exists allowed_users_internal_email_unique on allowed_users(internal_email);

-- Keep RLS enabled.
alter table allowed_users enable row level security;
alter table bank_account_master enable row level security;
alter table card_policy_master enable row level security;
alter table upload_batches enable row level security;
alter table transactions enable row level security;
alter table balance_movements enable row level security;
alter table mapping_rules enable row level security;
alter table audit_logs enable row level security;

-- Recreate read policies so they work with internal login emails.
do $$
begin
  execute 'drop policy if exists "allowed users can read allowed_users" on allowed_users';
  execute 'drop policy if exists "allowed users can read bank accounts" on bank_account_master';
  execute 'drop policy if exists "allowed users can read card policies" on card_policy_master';
  execute 'drop policy if exists "allowed users can read uploads" on upload_batches';
  execute 'drop policy if exists "allowed users can read transactions" on transactions';
  execute 'drop policy if exists "allowed users can read balance" on balance_movements';
  execute 'drop policy if exists "allowed users can read rules" on mapping_rules';
  execute 'drop policy if exists "allowed users can read audit" on audit_logs';
end $$;

create policy "allowed users can read allowed_users" on allowed_users
for select using (auth.email() in (select email from allowed_users where status = 'active'));
create policy "allowed users can read bank accounts" on bank_account_master
for select using (auth.email() in (select email from allowed_users where status = 'active'));
create policy "allowed users can read card policies" on card_policy_master
for select using (auth.email() in (select email from allowed_users where status = 'active'));
create policy "allowed users can read uploads" on upload_batches
for select using (auth.email() in (select email from allowed_users where status = 'active'));
create policy "allowed users can read transactions" on transactions
for select using (auth.email() in (select email from allowed_users where status = 'active'));
create policy "allowed users can read balance" on balance_movements
for select using (auth.email() in (select email from allowed_users where status = 'active'));
create policy "allowed users can read rules" on mapping_rules
for select using (auth.email() in (select email from allowed_users where status = 'active'));
create policy "allowed users can read audit" on audit_logs
for select using (auth.email() in (select email from allowed_users where status = 'active'));
