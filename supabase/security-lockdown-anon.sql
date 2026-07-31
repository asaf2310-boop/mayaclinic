-- =============================================================================
-- CRITICAL: Run this NOW in Supabase SQL Editor (production project).
-- Closes ALL anon/authenticated browser access to clinic tables.
-- Public reads must go through /api/public-data (service role).
-- Admin writes must go through /api/admin (service role + session cookie).
-- =============================================================================

-- Enable RLS on every clinic table
alter table if exists public.treatments enable row level security;
alter table if exists public.availability enable row level security;
alter table if exists public.appointments enable row level security;
alter table if exists public.patient_profiles enable row level security;
alter table if exists public.weekly_schedule enable row level security;
alter table if exists public.pelecard_payments enable row level security;
alter table if exists public.clinic_tenants enable row level security;

-- Drop every known open / legacy policy name
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'treatments',
        'availability',
        'appointments',
        'patient_profiles',
        'weekly_schedule',
        'pelecard_payments',
        'clinic_tenants'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- Optional: allow reading active clinic tenant directory only (no PII)
drop policy if exists "anon_read_clinic_tenants" on public.clinic_tenants;
create policy "anon_read_clinic_tenants" on public.clinic_tenants
  for select
  using (is_active = true);

-- Stronger than RLS alone: remove table privileges from browser roles.
revoke all on table public.treatments from anon, authenticated;
revoke all on table public.availability from anon, authenticated;
revoke all on table public.appointments from anon, authenticated;
revoke all on table public.patient_profiles from anon, authenticated;
revoke all on table public.weekly_schedule from anon, authenticated;
revoke all on table public.pelecard_payments from anon, authenticated;

-- service_role continues to bypass RLS and retains access for server routes.