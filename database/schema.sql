-- FinanceOps Dashboard v1 database schema
-- Run in Supabase SQL editor after creating the project.

create extension if not exists "uuid-ossp";

create table if not exists allowed_users (
  id uuid primary key default uuid_generate_v4(),
  email text not null unique,
  login_id text unique,
  internal_email text unique,
  name text,
  role text not null check (role in ('admin', 'finance', 'executive', 'viewer')),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table if not exists bank_account_master (
  id text primary key,
  bank_name text not null,
  account_name text not null,
  account_no_masked text not null,
  business_unit text not null check (business_unit in ('광고사업부', '플랫폼', '대외협력', '공통사용분', '미배분')),
  purpose text,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists card_policy_master (
  id uuid primary key default uuid_generate_v4(),
  card_budget_group text not null,
  default_business_unit text not null check (default_business_unit in ('광고사업부', '플랫폼', '대외협력', '공통사용분', '미배분')),
  common_policy text,
  memo text,
  created_at timestamptz not null default now()
);

create table if not exists upload_batches (
  id uuid primary key default uuid_generate_v4(),
  upload_type text not null check (upload_type in ('bank', 'card', 'pharos', 'balance')),
  file_name text not null,
  status text not null default 'uploaded' check (status in ('uploaded', 'previewed', 'validated', 'confirmed', 'rejected')),
  uploaded_by text,
  uploaded_at timestamptz not null default now()
);

create table if not exists transactions (
  id uuid primary key default uuid_generate_v4(),
  upload_batch_id uuid references upload_batches(id),
  transaction_date date not null,
  source text not null check (source in ('은행', '카드', '파로스', '수기입력')),
  business_unit text not null check (business_unit in ('광고사업부', '플랫폼', '대외협력', '공통사용분', '미배분')),
  account_id text references bank_account_master(id),
  card_budget_group text,
  vendor text,
  description text,
  amount numeric not null,
  cash_flow_type text not null check (cash_flow_type in ('입금', '출금', '내부이체', '제외')),
  main_category text,
  sub_category text,
  detail_category text,
  talent_investment_type text,
  expense_basis text check (expense_basis in ('비용성', '자산성', '해당없음')),
  is_internal_transfer boolean not null default false,
  is_common_use boolean not null default false,
  common_policy text,
  journal_status text check (journal_status in ('미분개', '분개완료', '확인필요')),
  journal_business_unit text check (journal_business_unit in ('광고사업부', '플랫폼', '대외협력', '공통사용분', '미배분')),
  review_status text not null default '확인필요' check (review_status in ('정상', '확인필요', '보류', '확정')),
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists balance_movements (
  id uuid primary key default uuid_generate_v4(),
  month text not null,
  statement_type text not null check (statement_type in ('자산', '부채')),
  category text not null,
  opening_amount numeric not null default 0,
  increase_amount numeric not null default 0,
  decrease_amount numeric not null default 0,
  memo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists mapping_rules (
  id uuid primary key default uuid_generate_v4(),
  rule_name text not null,
  source text,
  keyword text not null,
  business_unit text,
  main_category text,
  sub_category text,
  detail_category text,
  expense_basis text,
  priority integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists audit_logs (
  id uuid primary key default uuid_generate_v4(),
  table_name text not null,
  row_id text not null,
  action text not null,
  old_value jsonb,
  new_value jsonb,
  reason text,
  changed_by text,
  changed_at timestamptz not null default now()
);

alter table allowed_users enable row level security;
alter table bank_account_master enable row level security;
alter table card_policy_master enable row level security;
alter table upload_batches enable row level security;
alter table transactions enable row level security;
alter table balance_movements enable row level security;
alter table mapping_rules enable row level security;
alter table audit_logs enable row level security;

-- Initial broad policies for internal app MVP.
-- Tighten these after login is connected and roles are tested.
create policy "allowed users can read allowed_users" on allowed_users for select using (auth.email() in (select email from allowed_users where status = 'active'));
create policy "allowed users can read bank accounts" on bank_account_master for select using (auth.email() in (select email from allowed_users where status = 'active'));
create policy "allowed users can read card policies" on card_policy_master for select using (auth.email() in (select email from allowed_users where status = 'active'));
create policy "allowed users can read uploads" on upload_batches for select using (auth.email() in (select email from allowed_users where status = 'active'));
create policy "allowed users can read transactions" on transactions for select using (auth.email() in (select email from allowed_users where status = 'active'));
create policy "allowed users can read balance" on balance_movements for select using (auth.email() in (select email from allowed_users where status = 'active'));
create policy "allowed users can read rules" on mapping_rules for select using (auth.email() in (select email from allowed_users where status = 'active'));
create policy "allowed users can read audit" on audit_logs for select using (auth.email() in (select email from allowed_users where status = 'active'));
