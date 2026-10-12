-- OFIRBABY SMS templates + booking confirmation delivery (extends appointment-sms-delivery.sql).
-- Run once in Supabase SQL Editor AFTER enabling SMS_BOOKING_CONFIRM_ENABLED / SMS_REMINDERS_ENABLED.
-- Safe to re-run (IF NOT EXISTS / null-only defaults). Preserves existing settings rows.
--
-- Service-role API routes bypass RLS. No anon policies are added.
-- Confirmation columns are independent of reminder_sms_* and email confirmation_*.

-- ---------------------------------------------------------------------------
-- Per-appointment booking-confirmation SMS metadata (one send per new apt)
-- ---------------------------------------------------------------------------
alter table if exists public.appointments
  add column if not exists confirm_sms_status text;

alter table if exists public.appointments
  add column if not exists confirm_sms_attempts integer not null default 0;

alter table if exists public.appointments
  add column if not exists confirm_sms_last_error text;

alter table if exists public.appointments
  add column if not exists confirm_sms_claimed_at timestamptz;

alter table if exists public.appointments
  add column if not exists confirm_sms_sent_at timestamptz;

alter table if exists public.appointments
  add column if not exists confirm_sms_shipment_id text;

create index if not exists idx_appointments_confirm_sms_sent_at
  on public.appointments (confirm_sms_sent_at);

create index if not exists idx_appointments_confirm_sms_status
  on public.appointments (confirm_sms_status);

-- ---------------------------------------------------------------------------
-- Extend sms_reminder_settings with templates, address, booking-confirm toggle
-- (table created by appointment-sms-delivery.sql — create here if missing)
-- ---------------------------------------------------------------------------
create table if not exists public.sms_reminder_settings (
  tenant_id text primary key,
  enabled boolean not null default false,
  lead_hours integer not null default 24,
  updated_at timestamptz not null default now()
);

alter table public.sms_reminder_settings enable row level security;
revoke all on table public.sms_reminder_settings from anon, authenticated;

alter table public.sms_reminder_settings
  add column if not exists booking_confirm_enabled boolean not null default false;

alter table public.sms_reminder_settings
  add column if not exists clinic_address text;

alter table public.sms_reminder_settings
  add column if not exists confirm_template text;

alter table public.sms_reminder_settings
  add column if not exists reminder_template text;

-- Seed maya row if missing (disabled). Do not overwrite existing toggles.
insert into public.sms_reminder_settings (tenant_id, enabled, lead_hours, booking_confirm_enabled)
values ('maya', false, 24, false)
on conflict (tenant_id) do nothing;

-- Fill defaults only where null/blank — preserve any already-saved admin values.
update public.sms_reminder_settings
set clinic_address = 'ישראל עידוד 8, פתח תקווה, קומה 7, דירה 26'
where clinic_address is null or btrim(clinic_address) = '';

update public.sms_reminder_settings
set confirm_template = E'שלום {שם}, התור שלך ב־OfirBaby נקבע בהצלחה ל־{תאריך} בשעה {שעה}.\n\n📍 כתובת: {כתובת}\n\nלשינוי או ביטול: 0549000301.\n\nנתראה בקרוב!'
where confirm_template is null or btrim(confirm_template) = '';

update public.sms_reminder_settings
set reminder_template = E'שלום {שם}, תזכורת לתור שלך ב־OfirBaby בתאריך {תאריך} בשעה {שעה}.\n\n📍 כתובת: {כתובת}\n\nלשינוי או ביטול התור: 0549000301.\n\nנתראה בקרוב!'
where reminder_template is null or btrim(reminder_template) = '';
