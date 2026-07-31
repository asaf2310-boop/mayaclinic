-- =============================================================================
-- SAFE production lockdown — does NOT break the live website.
--
-- Why it's safe:
-- - The site already reads via /api/public-data (server)
-- - Admin already writes via /api/admin (server)
-- - Payments already write pelecard_payments via server
-- - Those server routes use SUPABASE_SERVICE_ROLE_KEY, which bypasses RLS
--
-- What visitors keep:
-- - Booking calendar, treatments, payment iframe, emails, admin (with login)
--
-- What attackers lose:
-- - Direct anon read/write to Supabase tables with the public anon key
-- =============================================================================

alter table if exists public.treatments enable row level security;
alter table if exists public.availability enable row level security;
alter table if exists public.appointments enable row level security;
alter table if exists public.patient_profiles enable row level security;
alter table if exists public.weekly_schedule enable row level security;
alter table if exists public.pelecard_payments enable row level security;
alter table if exists public.clinic_tenants enable row level security;

-- Remove every policy on clinic tables (including open "anon_all_*")
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

-- Harmless public directory of clinic ids (no patient data)
drop policy if exists "anon_read_clinic_tenants" on public.clinic_tenants;
create policy "anon_read_clinic_tenants" on public.clinic_tenants
  for select
  using (is_active = true);

-- Extra hardening (safe while SUPABASE_SERVICE_ROLE_KEY is set in Vercel — already required for payments)
revoke all on table public.treatments from anon, authenticated;
revoke all on table public.availability from anon, authenticated;
revoke all on table public.appointments from anon, authenticated;
revoke all on table public.patient_profiles from anon, authenticated;
revoke all on table public.weekly_schedule from anon, authenticated;
revoke all on table public.pelecard_payments from anon, authenticated;

-- Quick self-check after running:
-- select tablename, policyname from pg_policies
-- where schemaname='public'
--   and tablename in ('treatments','availability','appointments','patient_profiles','weekly_schedule','pelecard_payments');
-- Expect: no rows (or only none of the data tables above).
