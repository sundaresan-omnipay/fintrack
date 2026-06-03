-- ============================================================
-- FINWIN — ONE-TIME FIX  (run this in Supabase SQL Editor)
-- Fixes the "schema cache" / 404 errors for incomes & savings
-- Safe to run multiple times — everything is IF NOT EXISTS
-- ============================================================

-- 1. Create tables (safe if they already exist)
-- -------------------------------------------------------

create table if not exists incomes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     decimal(12, 2) not null check (amount > 0),
  source     text not null default 'Salary',
  month      text not null,           -- YYYY-MM
  notes      text,
  created_at timestamptz not null default now()
);

create table if not exists savings (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  name                 text not null,
  type                 text not null default 'sip'
                         check (type in ('sip','lumpsum','fd','ppf','nps','other')),
  monthly_amount       decimal(12, 2) not null check (monthly_amount > 0),
  start_date           date not null default current_date,
  expected_return_rate decimal(5, 2) not null default 12.0,
  is_active            boolean not null default true,
  notes                text,
  created_at           timestamptz not null default now()
);

create table if not exists recurring_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  description  text not null,
  amount       decimal(12, 2) not null check (amount > 0),
  category     text not null,
  day_of_month int not null check (day_of_month between 1 and 28),
  is_active    boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now()
);

create table if not exists goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  target_amount  decimal(12, 2) not null check (target_amount > 0),
  current_amount decimal(12, 2) not null default 0,
  target_date    date,
  category       text not null default 'other',
  icon           text not null default '🎯',
  color          text not null default '#7c3aed',
  notes          text,
  is_completed   boolean not null default false,
  created_at     timestamptz not null default now()
);

-- 2. DISABLE RLS — matches your other tables (transactions, budgets, loans)
--    Without this, PostgREST cannot expose the tables via its REST API
-- -------------------------------------------------------
alter table incomes                disable row level security;
alter table savings                disable row level security;
alter table recurring_transactions disable row level security;
alter table goals                  disable row level security;

-- 3. Grant access to the roles PostgREST uses for schema inspection
-- -------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update, delete on incomes                to anon, authenticated, service_role;
grant select, insert, update, delete on savings                to anon, authenticated, service_role;
grant select, insert, update, delete on recurring_transactions to anon, authenticated, service_role;
grant select, insert, update, delete on goals                  to anon, authenticated, service_role;

-- 4. Reload PostgREST schema cache — no dashboard needed
-- -------------------------------------------------------
notify pgrst, 'reload schema';
