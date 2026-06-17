-- FinanceOps Dashboard v2 auth policy patch
-- Run this after database/schema.sql and database/seed.sql.
-- It replaces the self-referencing allowed_users policy with a safer own-row policy.

drop policy if exists "allowed users can read allowed_users" on allowed_users;
create policy "users can read their own allowed_user row"
  on allowed_users
  for select
  using (auth.email() = email and status = 'active');

-- Basic write policies for MVP. Admin/finance users can insert upload batches and transactions.
drop policy if exists "admin finance can insert uploads" on upload_batches;
create policy "admin finance can insert uploads"
  on upload_batches
  for insert
  with check (
    auth.email() in (
      select email from allowed_users
      where status = 'active' and role in ('admin', 'finance')
    )
  );

drop policy if exists "admin finance can insert transactions" on transactions;
create policy "admin finance can insert transactions"
  on transactions
  for insert
  with check (
    auth.email() in (
      select email from allowed_users
      where status = 'active' and role in ('admin', 'finance')
    )
  );

drop policy if exists "admin finance can update transactions" on transactions;
create policy "admin finance can update transactions"
  on transactions
  for update
  using (
    auth.email() in (
      select email from allowed_users
      where status = 'active' and role in ('admin', 'finance')
    )
  )
  with check (
    auth.email() in (
      select email from allowed_users
      where status = 'active' and role in ('admin', 'finance')
    )
  );
