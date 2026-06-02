-- ============================================================
-- Finwin — Feature Tables Schema
-- Run this in the Supabase SQL editor
-- ============================================================

-- ------------------------------------------------------------
-- 1. incomes — monthly salary / income tracking
-- ------------------------------------------------------------
create table if not exists incomes (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  amount       decimal(12, 2) not null,
  source       text not null default 'Salary',
  month        text not null,           -- YYYY-MM
  notes        text,
  created_at   timestamptz not null default now(),
  unique (user_id, source, month)
);

alter table incomes enable row level security;

create policy "Users own incomes"
  on incomes for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists incomes_user_id_idx on incomes (user_id);

-- ------------------------------------------------------------
-- 2. recurring_transactions — recurring expense templates
-- ------------------------------------------------------------
create table if not exists recurring_transactions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  description   text not null,
  amount        decimal(12, 2) not null,
  category      text not null,
  day_of_month  int not null check (day_of_month between 1 and 28),
  is_active     boolean not null default true,
  notes         text,
  created_at    timestamptz not null default now()
);

alter table recurring_transactions enable row level security;

create policy "Users own recurring_transactions"
  on recurring_transactions for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists recurring_transactions_user_id_idx on recurring_transactions (user_id);

-- ------------------------------------------------------------
-- 3. savings — SIP / investment plans
-- ------------------------------------------------------------
create table if not exists savings (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  name                  text not null,
  type                  text not null default 'sip'
                          check (type in ('sip', 'lumpsum', 'fd', 'ppf', 'nps', 'other')),
  monthly_amount        decimal(12, 2) not null,
  start_date            date not null,
  expected_return_rate  decimal(5, 2) not null default 12.0,
  is_active             boolean not null default true,
  notes                 text,
  created_at            timestamptz not null default now()
);

alter table savings enable row level security;

create policy "Users own savings"
  on savings for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists savings_user_id_idx on savings (user_id);

-- ------------------------------------------------------------
-- 4. goals — financial goals
-- ------------------------------------------------------------
create table if not exists goals (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  target_amount   decimal(12, 2) not null,
  current_amount  decimal(12, 2) not null default 0,
  target_date     date,
  category        text not null default 'other',
  icon            text not null default '🎯',
  color           text not null default '#7c3aed',
  notes           text,
  is_completed    boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table goals enable row level security;

create policy "Users own goals"
  on goals for all
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index if not exists goals_user_id_idx on goals (user_id);
