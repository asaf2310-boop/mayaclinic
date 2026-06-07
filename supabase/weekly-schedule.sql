-- Run after schema.sql in Supabase SQL Editor.
-- Recurring weekly availability template (admin applies to future dates).

create table if not exists weekly_schedule (
  id uuid primary key default gen_random_uuid(),
  day_of_week smallint not null unique check (day_of_week between 0 and 6),
  slots text[] not null default '{}',
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

create index if not exists idx_weekly_schedule_day on weekly_schedule(day_of_week);

alter table weekly_schedule enable row level security;

drop policy if exists "anon_all_weekly_schedule" on weekly_schedule;
create policy "anon_all_weekly_schedule" on weekly_schedule for all using (true) with check (true);

-- Seed empty template (Sunday=0 … Saturday=6) if table is empty
insert into weekly_schedule (day_of_week, slots, is_active)
select d, '{}', false
from generate_series(0, 6) as d
where not exists (select 1 from weekly_schedule limit 1)
on conflict (day_of_week) do nothing;
