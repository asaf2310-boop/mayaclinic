-- Run once in Supabase SQL Editor.
-- Project URL for this app: https://furrjspvtmyvjikynkfj.supabase.co

create extension if not exists "pgcrypto";

create table if not exists treatments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  duration_minutes integer not null,
  price numeric(10, 2) not null,
  icon text,
  created_at timestamptz not null default now()
);

create table if not exists availability (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  slots text[] not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists appointments (
  id uuid primary key default gen_random_uuid(),
  patient_name text not null,
  patient_phone text not null,
  patient_email text,
  treatment_id uuid references treatments(id) on delete set null,
  treatment_name text not null,
  treatment_price numeric(10, 2),
  date date not null,
  time text not null,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'completed')),
  paid boolean not null default false,
  marketing_consent boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

alter table appointments add column if not exists treatment_price numeric(10, 2);
alter table appointments add column if not exists marketing_consent boolean not null default false;

create index if not exists idx_treatments_created_at on treatments(created_at);
create index if not exists idx_availability_date on availability(date);
create index if not exists idx_appointments_date_time on appointments(date, time);
create index if not exists idx_appointments_status on appointments(status);

alter table treatments enable row level security;
alter table availability enable row level security;
alter table appointments enable row level security;

-- Public booking app policy.
-- This matches the current no-login app behavior. Tighten this later when admin login is added.
drop policy if exists "anon_all_treatments" on treatments;
drop policy if exists "anon_all_availability" on availability;
drop policy if exists "anon_all_appointments" on appointments;

create policy "anon_all_treatments" on treatments for all using (true) with check (true);
create policy "anon_all_availability" on availability for all using (true) with check (true);
create policy "anon_all_appointments" on appointments for all using (true) with check (true);

create or replace function prevent_close_appointments()
returns trigger as $$
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  if exists (
    select 1
    from appointments existing
    where existing.date = new.date
      and existing.status <> 'cancelled'
      and existing.id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and abs(
        (split_part(existing.time, ':', 1)::integer * 60 + split_part(existing.time, ':', 2)::integer) -
        (split_part(new.time, ':', 1)::integer * 60 + split_part(new.time, ':', 2)::integer)
      ) < 60
  ) then
    raise exception 'appointment_time_conflict';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_close_appointments on appointments;
create trigger trg_prevent_close_appointments
before insert or update on appointments
for each row execute function prevent_close_appointments();

-- Optional starter rows. Edit these in Supabase or from the admin UI later.
insert into treatments (name, description, duration_minutes, price, icon)
select * from (values
  ('טיפול פנים', 'טיפול פנים מותאם אישית', 60, 250, '✨'),
  ('ייעוץ ראשוני', 'פגישת היכרות והתאמת טיפול', 30, 120, '🌿')
) as seed(name, description, duration_minutes, price, icon)
where not exists (select 1 from treatments);
