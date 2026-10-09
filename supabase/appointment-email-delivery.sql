-- Appointment email delivery state + address suppression.
-- Run once in Supabase SQL Editor (Maya / OfirBaby production) BEFORE relying on
-- bounce protection in production. Safe to re-run (IF NOT EXISTS).
--
-- Service-role API routes bypass RLS. No anon policies are added.

-- Per-appointment confirmation / reminder delivery metadata
alter table if exists public.appointments
  add column if not exists confirmation_email_status text;

alter table if exists public.appointments
  add column if not exists confirmation_email_attempts integer not null default 0;

alter table if exists public.appointments
  add column if not exists confirmation_email_last_error text;

alter table if exists public.appointments
  add column if not exists confirmation_sent_at timestamptz;

alter table if exists public.appointments
  add column if not exists reminder_email_status text;

alter table if exists public.appointments
  add column if not exists reminder_email_attempts integer not null default 0;

alter table if exists public.appointments
  add column if not exists reminder_email_last_error text;

-- Claim timestamps for crash recovery of stuck `sending` rows (no backfill needed).
alter table if exists public.appointments
  add column if not exists confirmation_email_claimed_at timestamptz;

alter table if exists public.appointments
  add column if not exists reminder_email_claimed_at timestamptz;

-- Known-bad addresses (hard bounce / permanent SMTP failure). Cleared only on
-- explicit admin email correction / override.
create table if not exists public.email_suppressions (
  email_normalized text primary key,
  reason text,
  source_appointment_id uuid,
  created_at timestamptz not null default now(),
  cleared_at timestamptz
);

create index if not exists idx_email_suppressions_active
  on public.email_suppressions (email_normalized)
  where cleared_at is null;

alter table if exists public.email_suppressions enable row level security;

-- No anon/authenticated policies → deny-by-default under RLS.
-- Service-role API routes bypass RLS.
revoke all on table public.email_suppressions from anon, authenticated;
