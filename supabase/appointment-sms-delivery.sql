-- Appointment SMS reminder delivery state + per-tenant settings (019 SMS).
-- Run once in Supabase SQL Editor (Maya / OfirBaby production) BEFORE enabling
-- SMS_REMINDERS_ENABLED on Vercel. Safe to re-run (IF NOT EXISTS).
--
-- Service-role API routes bypass RLS. No anon policies are added.
-- Separate from email reminder columns — do not reuse reminder_sent_at / reminder_email_*.

-- Per-appointment SMS reminder metadata (independent of email)
alter table if exists public.appointments
  add column if not exists reminder_sms_status text;

alter table if exists public.appointments
  add column if not exists reminder_sms_attempts integer not null default 0;

alter table if exists public.appointments
  add column if not exists reminder_sms_last_error text;

alter table if exists public.appointments
  add column if not exists reminder_sms_claimed_at timestamptz;

alter table if exists public.appointments
  add column if not exists reminder_sms_sent_at timestamptz;

alter table if exists public.appointments
  add column if not exists reminder_sms_shipment_id text;

create index if not exists idx_appointments_reminder_sms_sent_at
  on public.appointments (reminder_sms_sent_at);

create index if not exists idx_appointments_reminder_sms_status
  on public.appointments (reminder_sms_status);

-- Admin-controlled settings (still gated by SMS_REMINDERS_ENABLED env kill-switch)
create table if not exists public.sms_reminder_settings (
  tenant_id text primary key,
  enabled boolean not null default false,
  lead_hours integer not null default 24,
  updated_at timestamptz not null default now()
);

alter table public.sms_reminder_settings enable row level security;

-- No anon/authenticated policies → deny-by-default under RLS.
-- Service-role API routes bypass RLS.
revoke all on table public.sms_reminder_settings from anon, authenticated;

-- Seed default row for maya / OfirBaby (disabled until ops + admin enable)
insert into public.sms_reminder_settings (tenant_id, enabled, lead_hours)
values ('maya', false, 24)
on conflict (tenant_id) do nothing;
