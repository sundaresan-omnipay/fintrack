-- ============================================================
-- FINWIN SETUP — Paste this entire file into
-- Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- Drop & recreate so everything is clean
drop table if exists incomes               cascade;
drop table if exists savings               cascade;
drop table if exists recurring_transactions cascade;
drop table if exists goals                 cascade;

-- ── incomes ──────────────────────────────────────────────────
create table incomes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  amount     decimal(12,2) not null,
  source     text not null default 'Salary',
  month      text not null,
  notes      text,
  created_at timestamptz not null default now()
);

-- ── savings ──────────────────────────────────────────────────
create table savings (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,
  name                 text not null,
  type                 text not null default 'sip'
                         check (type in ('sip','lumpsum','fd','ppf','nps','other')),
  monthly_amount       decimal(12,2) not null,
  start_date           date not null default current_date,
  expected_return_rate decimal(5,2)  not null default 12.0,
  is_active            boolean not null default true,
  notes                text,
  created_at           timestamptz not null default now()
);

-- ── recurring_transactions ───────────────────────────────────
create table recurring_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  description  text not null,
  amount       decimal(12,2) not null,
  category     text not null,
  day_of_month int  not null check (day_of_month between 1 and 28),
  is_active    boolean not null default true,
  notes        text,
  created_at   timestamptz not null default now()
);

-- ── goals ────────────────────────────────────────────────────
create table goals (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  target_amount  decimal(12,2) not null,
  current_amount decimal(12,2) not null default 0,
  target_date    date,
  category       text not null default 'other',
  icon           text not null default '🎯',
  color          text not null default '#7c3aed',
  notes          text,
  is_completed   boolean not null default false,
  created_at     timestamptz not null default now()
);

-- ── Grant access (authenticator = role PostgREST connects as) ─
grant usage on schema public to anon, authenticated, service_role, authenticator;

grant all on incomes                to anon, authenticated, service_role, authenticator;
grant all on savings                to anon, authenticated, service_role, authenticator;
grant all on recurring_transactions to anon, authenticated, service_role, authenticator;
grant all on goals                  to anon, authenticated, service_role, authenticator;

-- Make sure future tables also get access
alter default privileges for role postgres in schema public
  grant all on tables    to anon, authenticated, service_role, authenticator;
alter default privileges for role postgres in schema public
  grant all on sequences to anon, authenticated, service_role, authenticator;

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
