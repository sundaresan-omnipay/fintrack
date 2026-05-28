-- FinTrack Database Schema
-- Run this in your Supabase SQL editor

-- Enable RLS
alter default privileges in schema public grant all on tables to postgres, anon, authenticated, service_role;

-- Transactions table
create table if not exists transactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  amount decimal(12, 2) not null check (amount > 0),
  description text not null,
  category text not null check (category in ('food','transport','shopping','bills','health','entertainment','travel','education','other')),
  date date not null default current_date,
  notes text,
  created_at timestamptz default now() not null
);

-- Budgets table
create table if not exists budgets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users(id) on delete cascade not null,
  category text not null check (category in ('food','transport','shopping','bills','health','entertainment','travel','education','other')),
  amount decimal(12, 2) not null check (amount >= 0),
  month text not null, -- format: YYYY-MM
  created_at timestamptz default now() not null,
  unique(user_id, category, month)
);

-- Enable Row Level Security
alter table transactions enable row level security;
alter table budgets enable row level security;

-- RLS Policies for transactions
create policy "Users can view own transactions"
  on transactions for select
  using (auth.uid() = user_id);

create policy "Users can insert own transactions"
  on transactions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own transactions"
  on transactions for update
  using (auth.uid() = user_id);

create policy "Users can delete own transactions"
  on transactions for delete
  using (auth.uid() = user_id);

-- RLS Policies for budgets
create policy "Users can view own budgets"
  on budgets for select
  using (auth.uid() = user_id);

create policy "Users can insert own budgets"
  on budgets for insert
  with check (auth.uid() = user_id);

create policy "Users can update own budgets"
  on budgets for update
  using (auth.uid() = user_id);

create policy "Users can delete own budgets"
  on budgets for delete
  using (auth.uid() = user_id);

-- Indexes for performance
create index if not exists transactions_user_id_idx on transactions(user_id);
create index if not exists transactions_date_idx on transactions(date);
create index if not exists transactions_category_idx on transactions(category);
create index if not exists budgets_user_id_idx on budgets(user_id);
create index if not exists budgets_month_idx on budgets(month);
