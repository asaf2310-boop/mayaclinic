-- Run after schema.sql in Supabase SQL Editor.
-- Extended patient profile for Maya clinic admin (not a full EMR).
-- Optional if you run multi-tenant.sql (it creates this table when missing).

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
