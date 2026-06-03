-- ============================================================
-- FINWIN — Run this in Supabase SQL Editor → Run
-- ============================================================

-- Drop and recreate incomes (no foreign key, no RLS, no combined grants)
drop table if exists incomes cascade;

create table incomes (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null,
  amount     decimal(12,2) not null,
  source     text        not null default 'Salary',
  month      text        not null,
  created_at timestamptz not null default now()
);

grant all on table incomes to anon;
grant all on table incomes to authenticated;
grant all on table incomes to service_role;

-- ─────────────────────────────────────────────────────────────

drop table if exists savings cascade;

create table savings (
  id                   uuid        primary key default gen_random_uuid(),
  user_id              uuid        not null,
  name                 text        not null,
  type                 text        not null default 'sip'
                         check (type in ('sip','lumpsum','fd','ppf','nps','other')),
  monthly_amount       decimal(12,2) not null,
  start_date           date        not null default current_date,
  expected_return_rate decimal(5,2)  not null default 12.0,
  is_active            boolean     not null default true,
  notes                text,
  created_at           timestamptz not null default now()
);

grant all on table savings to anon;
grant all on table savings to authenticated;
grant all on table savings to service_role;

-- ─────────────────────────────────────────────────────────────

drop table if exists recurring_transactions cascade;

create table recurring_transactions (
  id           uuid        primary key default gen_random_uuid(),
  user_id      uuid        not null,
  description  text        not null,
  amount       decimal(12,2) not null,
  category     text        not null,
  day_of_month int         not null check (day_of_month between 1 and 28),
  is_active    boolean     not null default true,
  notes        text,
  created_at   timestamptz not null default now()
);

grant all on table recurring_transactions to anon;
grant all on table recurring_transactions to authenticated;
grant all on table recurring_transactions to service_role;

-- ─────────────────────────────────────────────────────────────

drop table if exists goals cascade;

create table goals (
  id             uuid        primary key default gen_random_uuid(),
  user_id        uuid        not null,
  name           text        not null,
  target_amount  decimal(12,2) not null,
  current_amount decimal(12,2) not null default 0,
  target_date    date,
  category       text        not null default 'other',
  icon           text        not null default '🎯',
  color          text        not null default '#7c3aed',
  notes          text,
  is_completed   boolean     not null default false,
  created_at     timestamptz not null default now()
);

grant all on table goals to anon;
grant all on table goals to authenticated;
grant all on table goals to service_role;

-- Reload PostgREST schema cache
-- Wait 3–5 seconds after running, then refresh the app
select pg_notify('pgrst', 'reload schema');
