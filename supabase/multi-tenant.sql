-- Multi-tenant migration for shared Supabase (maya + holistic)
-- Run once in Supabase SQL Editor AFTER schema.sql.
-- patient-profiles.sql and weekly-schedule.sql are optional here — dependency
-- tables are created below if missing.
--
-- Run order:
--   1. schema.sql
--   2. multi-tenant.sql          (this file)
--   3. tag-holistic-records.sql  (optional — only if legacy rows need re-tagging)
--
-- Project: https://furrjspvtmyvjikynkfj.supabase.co

-- ---------------------------------------------------------------------------
-- Dependency tables (from patient-profiles.sql / weekly-schedule.sql)
-- ---------------------------------------------------------------------------

create table if not exists patient_profiles (
  id uuid primary key default gen_random_uuid(),
  customer_key text not null unique,
  patient_name text,
  patient_phone text,
  patient_email text,
  profile jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_patient_profiles_customer_key on patient_profiles(customer_key);

alter table patient_profiles enable row level security;

drop policy if exists "anon_all_patient_profiles" on patient_profiles;
create policy "anon_all_patient_profiles" on patient_profiles for all using (true) with check (true);

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

insert into weekly_schedule (day_of_week, slots, is_active)
select d, '{}', false
from generate_series(0, 6) as d
where not exists (select 1 from weekly_schedule limit 1)
on conflict (day_of_week) do nothing;

-- ---------------------------------------------------------------------------
-- Tenants registry
-- ---------------------------------------------------------------------------

create table if not exists clinic_tenants (
  id text primary key,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into clinic_tenants (id, name)
values
  ('maya', 'מאיה קליניק / אופיר'),
  ('holistic', 'HOLISTIC')
on conflict (id) do update set name = excluded.name;

-- ---------------------------------------------------------------------------
-- Tenant columns
-- ---------------------------------------------------------------------------

alter table treatments add column if not exists tenant_id text references clinic_tenants(id);
alter table treatments add column if not exists external_id text;
alter table treatments add column if not exists paybox_link text;

alter table availability add column if not exists tenant_id text references clinic_tenants(id);

alter table appointments add column if not exists tenant_id text references clinic_tenants(id);
alter table appointments add column if not exists therapist_ids text[] not null default '{}';
alter table appointments add column if not exists therapist_names text;
alter table appointments add column if not exists location text;
alter table appointments add column if not exists location_label text;
alter table appointments add column if not exists package_id text;
alter table appointments add column if not exists duration_minutes integer;
alter table appointments add column if not exists booking_mode text default 'individual';

alter table patient_profiles add column if not exists tenant_id text references clinic_tenants(id);

alter table weekly_schedule add column if not exists tenant_id text references clinic_tenants(id);

-- Backfill legacy rows as maya tenant
update treatments set tenant_id = 'maya' where tenant_id is null;
update availability set tenant_id = 'maya' where tenant_id is null;
update appointments set tenant_id = 'maya' where tenant_id is null;
update patient_profiles set tenant_id = 'maya' where tenant_id is null;
update weekly_schedule set tenant_id = 'maya' where tenant_id is null;

alter table treatments alter column tenant_id set not null;
alter table availability alter column tenant_id set not null;
alter table appointments alter column tenant_id set not null;
alter table patient_profiles alter column tenant_id set not null;
alter table weekly_schedule alter column tenant_id set not null;

-- ---------------------------------------------------------------------------
-- Uniqueness per tenant (drop global uniques first)
-- ---------------------------------------------------------------------------

alter table availability drop constraint if exists availability_date_key;
create unique index if not exists idx_availability_tenant_date
  on availability(tenant_id, date);

alter table patient_profiles drop constraint if exists patient_profiles_customer_key_key;
create unique index if not exists idx_patient_profiles_tenant_customer_key
  on patient_profiles(tenant_id, customer_key);

alter table weekly_schedule drop constraint if exists weekly_schedule_day_of_week_key;
create unique index if not exists idx_weekly_schedule_tenant_day
  on weekly_schedule(tenant_id, day_of_week);

create unique index if not exists idx_treatments_tenant_external_id
  on treatments(tenant_id, external_id)
  where external_id is not null;

create index if not exists idx_treatments_tenant_id on treatments(tenant_id);
create index if not exists idx_availability_tenant_id on availability(tenant_id);
create index if not exists idx_appointments_tenant_id on appointments(tenant_id);
create index if not exists idx_appointments_tenant_date_time on appointments(tenant_id, date, time);
create index if not exists idx_patient_profiles_tenant_id on patient_profiles(tenant_id);
create index if not exists idx_weekly_schedule_tenant_id on weekly_schedule(tenant_id);
create index if not exists idx_appointments_therapist_ids on appointments using gin (therapist_ids);

-- ---------------------------------------------------------------------------
-- Tenant resolution from request header (PostgREST / Supabase)
-- ---------------------------------------------------------------------------

create or replace function public.request_clinic_tenant_id()
returns text
language sql
stable
as $$
  select coalesce(
    nullif(trim(current_setting('request.headers', true)::json->>'x-clinic-tenant-id'), ''),
    ''
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS — replace open anon policies with tenant isolation
-- ---------------------------------------------------------------------------

alter table clinic_tenants enable row level security;

drop policy if exists "anon_read_clinic_tenants" on clinic_tenants;
create policy "anon_read_clinic_tenants" on clinic_tenants
  for select using (is_active = true);

drop policy if exists "anon_all_treatments" on treatments;
drop policy if exists "tenant_treatments_select" on treatments;
drop policy if exists "tenant_treatments_insert" on treatments;
drop policy if exists "tenant_treatments_update" on treatments;
drop policy if exists "tenant_treatments_delete" on treatments;

create policy "tenant_treatments_select" on treatments
  for select using (tenant_id = public.request_clinic_tenant_id());
create policy "tenant_treatments_insert" on treatments
  for insert with check (tenant_id = public.request_clinic_tenant_id());
create policy "tenant_treatments_update" on treatments
  for update using (tenant_id = public.request_clinic_tenant_id())
  with check (tenant_id = public.request_clinic_tenant_id());
create policy "tenant_treatments_delete" on treatments
  for delete using (tenant_id = public.request_clinic_tenant_id());

drop policy if exists "anon_all_availability" on availability;
drop policy if exists "tenant_availability_select" on availability;
drop policy if exists "tenant_availability_insert" on availability;
drop policy if exists "tenant_availability_update" on availability;
drop policy if exists "tenant_availability_delete" on availability;

create policy "tenant_availability_select" on availability
  for select using (tenant_id = public.request_clinic_tenant_id());
create policy "tenant_availability_insert" on availability
  for insert with check (tenant_id = public.request_clinic_tenant_id());
create policy "tenant_availability_update" on availability
  for update using (tenant_id = public.request_clinic_tenant_id())
  with check (tenant_id = public.request_clinic_tenant_id());
create policy "tenant_availability_delete" on availability
  for delete using (tenant_id = public.request_clinic_tenant_id());

drop policy if exists "anon_all_appointments" on appointments;
drop policy if exists "tenant_appointments_select" on appointments;
drop policy if exists "tenant_appointments_insert" on appointments;
drop policy if exists "tenant_appointments_update" on appointments;
drop policy if exists "tenant_appointments_delete" on appointments;

create policy "tenant_appointments_select" on appointments
  for select using (tenant_id = public.request_clinic_tenant_id());
create policy "tenant_appointments_insert" on appointments
  for insert with check (tenant_id = public.request_clinic_tenant_id());
create policy "tenant_appointments_update" on appointments
  for update using (tenant_id = public.request_clinic_tenant_id())
  with check (tenant_id = public.request_clinic_tenant_id());
create policy "tenant_appointments_delete" on appointments
  for delete using (tenant_id = public.request_clinic_tenant_id());

drop policy if exists "anon_all_patient_profiles" on patient_profiles;
drop policy if exists "tenant_patient_profiles_select" on patient_profiles;
drop policy if exists "tenant_patient_profiles_insert" on patient_profiles;
drop policy if exists "tenant_patient_profiles_update" on patient_profiles;
drop policy if exists "tenant_patient_profiles_delete" on patient_profiles;

create policy "tenant_patient_profiles_select" on patient_profiles
  for select using (tenant_id = public.request_clinic_tenant_id());
create policy "tenant_patient_profiles_insert" on patient_profiles
  for insert with check (tenant_id = public.request_clinic_tenant_id());
create policy "tenant_patient_profiles_update" on patient_profiles
  for update using (tenant_id = public.request_clinic_tenant_id())
  with check (tenant_id = public.request_clinic_tenant_id());
create policy "tenant_patient_profiles_delete" on patient_profiles
  for delete using (tenant_id = public.request_clinic_tenant_id());

drop policy if exists "anon_all_weekly_schedule" on weekly_schedule;
drop policy if exists "tenant_weekly_schedule_select" on weekly_schedule;
drop policy if exists "tenant_weekly_schedule_insert" on weekly_schedule;
drop policy if exists "tenant_weekly_schedule_update" on weekly_schedule;
drop policy if exists "tenant_weekly_schedule_delete" on weekly_schedule;

create policy "tenant_weekly_schedule_select" on weekly_schedule
  for select using (tenant_id = public.request_clinic_tenant_id());
create policy "tenant_weekly_schedule_insert" on weekly_schedule
  for insert with check (tenant_id = public.request_clinic_tenant_id());
create policy "tenant_weekly_schedule_update" on weekly_schedule
  for update using (tenant_id = public.request_clinic_tenant_id())
  with check (tenant_id = public.request_clinic_tenant_id());
create policy "tenant_weekly_schedule_delete" on weekly_schedule
  for delete using (tenant_id = public.request_clinic_tenant_id());

-- ---------------------------------------------------------------------------
-- Appointment conflict prevention (tenant-scoped)
-- ---------------------------------------------------------------------------

create or replace function holistic_therapist_overlap(
  new_therapists text[],
  existing_therapists text[]
) returns boolean as $$
begin
  return exists (
    select 1
    from unnest(coalesce(new_therapists, '{}'::text[])) nt
    join unnest(coalesce(existing_therapists, '{}'::text[])) et on nt = et
  );
end;
$$ language plpgsql immutable;

create or replace function prevent_appointments_conflict()
returns trigger as $$
declare
  existing record;
  new_start integer;
  new_end integer;
  existing_start integer;
  existing_end integer;
  new_duration integer;
  existing_duration integer;
  new_dual boolean;
  existing_dual boolean;
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  if new.tenant_id is distinct from public.request_clinic_tenant_id()
     and coalesce(public.request_clinic_tenant_id(), '') <> '' then
    raise exception 'tenant_mismatch';
  end if;

  new_duration := coalesce(new.duration_minutes, 60);
  new_start := (split_part(new.time, ':', 1)::integer * 60 + split_part(new.time, ':', 2)::integer);
  new_dual := coalesce(new.booking_mode, 'individual') in ('dual', 'couples')
    or coalesce(array_length(new.therapist_ids, 1), 0) > 1;

  -- Holistic: therapist-aware conflicts
  if coalesce(array_length(new.therapist_ids, 1), 0) > 0 then
    new_end := new_start + new_duration + 30;

    for existing in
      select *
      from appointments a
      where a.tenant_id = new.tenant_id
        and a.date = new.date
        and a.status <> 'cancelled'
        and a.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
        and holistic_therapist_overlap(new.therapist_ids, a.therapist_ids)
    loop
      existing_duration := coalesce(existing.duration_minutes, 60);
      existing_start := (split_part(existing.time, ':', 1)::integer * 60 + split_part(existing.time, ':', 2)::integer);
      existing_dual := coalesce(existing.booking_mode, 'individual') in ('dual', 'couples')
        or coalesce(array_length(existing.therapist_ids, 1), 0) > 1;

      if new_start < existing_start + existing_duration + 30
         and existing_start < new_end then
        raise exception 'appointment_time_conflict';
      end if;
    end loop;

    return new;
  end if;

  -- Maya / single-practitioner: classic 90-minute buffer within tenant
  if exists (
    select 1
    from appointments existing
    where existing.tenant_id = new.tenant_id
      and existing.date = new.date
      and existing.status <> 'cancelled'
      and existing.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and (
        (
          (split_part(new.time, ':', 1)::integer * 60 + split_part(new.time, ':', 2)::integer) >=
          (split_part(existing.time, ':', 1)::integer * 60 + split_part(existing.time, ':', 2)::integer)
          and (split_part(new.time, ':', 1)::integer * 60 + split_part(new.time, ':', 2)::integer) <=
          (split_part(existing.time, ':', 1)::integer * 60 + split_part(existing.time, ':', 2)::integer) + 90
        )
        or (
          (split_part(new.time, ':', 1)::integer * 60 + split_part(new.time, ':', 2)::integer) <
          (split_part(existing.time, ':', 1)::integer * 60 + split_part(existing.time, ':', 2)::integer)
          and (split_part(existing.time, ':', 1)::integer * 60 + split_part(existing.time, ':', 2)::integer) -
          (split_part(new.time, ':', 1)::integer * 60 + split_part(new.time, ':', 2)::integer) < 90
        )
        or (
          (split_part(new.time, ':', 1)::integer * 60 + split_part(new.time, ':', 2)::integer) <
          (split_part(existing.time, ':', 1)::integer * 60 + split_part(existing.time, ':', 2)::integer)
          and (split_part(new.time, ':', 1)::integer * 60 + split_part(new.time, ':', 2)::integer) + 60 >
          (split_part(existing.time, ':', 1)::integer * 60 + split_part(existing.time, ':', 2)::integer)
        )
      )
  ) then
    raise exception 'appointment_time_conflict';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_close_appointments on appointments;
drop trigger if exists trg_prevent_holistic_appointments_conflict on appointments;
drop trigger if exists trg_prevent_appointments_conflict on appointments;

create trigger trg_prevent_appointments_conflict
before insert or update on appointments
for each row execute function prevent_appointments_conflict();

-- ---------------------------------------------------------------------------
-- Holistic seed (idempotent) — treatments use external_id + uuid PK
-- ---------------------------------------------------------------------------

insert into treatments (tenant_id, external_id, name, description, duration_minutes, price, icon)
values
  ('holistic', 'thai_90', 'עיסוי תאילנדי מסורתי', 'עיסוי תאילנדי מסורתי — 90 דקות', 90, 480, '🪷'),
  ('holistic', 'touch_agent_50', 'טיפול במגע עם איגנט', 'טיפול במגע הוליסטי עם איגנט', 50, 290, '🌿'),
  ('holistic', 'touch_agent_60', 'טיפול במגע עם איגנט', 'טיפול במגע הוליסטי עם איגנט', 60, 330, '🌿'),
  ('holistic', 'touch_agent_70', 'טיפול במגע עם איגנט', 'טיפול במגע הוליסטי עם איגנט', 70, 370, '🌿'),
  ('holistic', 'touch_agent_90', 'טיפול במגע עם איגנט', 'טיפול במגע הוליסטי עם איגנט', 90, 450, '🌿'),
  ('holistic', 'touch_omer_50', 'טיפול במגע עם עומר', 'טיפול במגע הוליסטי עם עומר שלגי', 50, 290, '🌿'),
  ('holistic', 'touch_omer_60', 'טיפול במגע עם עומר', 'טיפול במגע הוליסטי עם עומר שלגי', 60, 330, '🌿'),
  ('holistic', 'touch_omer_70', 'טיפול במגע עם עומר', 'טיפול במגע הוליסטי עם עומר שלגי', 70, 370, '🌿'),
  ('holistic', 'touch_omer_90', 'טיפול במגע עם עומר', 'טיפול במגע הוליסטי עם עומר שלגי', 90, 450, '🌿'),
  ('holistic', 'four_hands_60', 'עיסוי 4 ידיים', 'עיסוי משולב עם שני המטפלים', 60, 620, '🤲'),
  ('holistic', 'couples_70', 'עיסוי זוגי', 'עיסוי זוגי — 70 דקות', 70, 800, '💑'),
  ('holistic', 'couples_90', 'עיסוי זוגי', 'עיסוי זוגי — 90 דקות', 90, 1000, '💑')
on conflict (tenant_id, external_id) where (external_id is not null) do nothing;

-- Seed holistic availability if missing
insert into availability (tenant_id, date, slots, is_active)
select 'holistic', d::date, array['09:00', '10:30', '12:00', '14:00', '16:00', '17:30']::text[], true
from generate_series(current_date + 1, current_date + 30, interval '1 day') as d
where not exists (
  select 1 from availability a where a.tenant_id = 'holistic' and a.date = d::date
);

-- Holistic weekly schedule template
insert into weekly_schedule (tenant_id, day_of_week, slots, is_active)
select 'holistic', d, '{}', false
from generate_series(0, 6) as d
where not exists (
  select 1 from weekly_schedule w where w.tenant_id = 'holistic' and w.day_of_week = d
);
