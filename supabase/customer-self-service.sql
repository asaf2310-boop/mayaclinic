-- Customer self-service: OTP challenges, change audit/events, appointment versioning.
-- Run once in Supabase SQL Editor (service role / SQL editor). Safe to re-run.
-- Does NOT enable SMS_REMINDERS_ENABLED. No destructive data changes.

-- Optimistic concurrency + audit timestamps on appointments
alter table public.appointments
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_appointments_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at
before update on public.appointments
for each row execute function public.set_appointments_updated_at();

create index if not exists idx_appointments_patient_phone
  on public.appointments (patient_phone);

create index if not exists idx_appointments_date_status
  on public.appointments (date, status);

-- OTP challenges (hashed codes only — never store plaintext OTP)
create table if not exists public.appointment_otp_challenges (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null default 'maya',
  phone_normalized text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0,
  max_attempts integer not null default 5,
  resend_available_at timestamptz not null,
  verified_at timestamptz,
  request_ip_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_otp_challenges_phone_created
  on public.appointment_otp_challenges (tenant_id, phone_normalized, created_at desc);

create index if not exists idx_otp_challenges_expires
  on public.appointment_otp_challenges (expires_at);

alter table public.appointment_otp_challenges enable row level security;

-- Coarse rate-limit counters (phone / IP windows)
create table if not exists public.appointment_otp_rate_limits (
  rate_key text primary key,
  window_started_at timestamptz not null default now(),
  request_count integer not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.appointment_otp_rate_limits enable row level security;

-- Audit + idempotent notify delivery for customer/admin reschedule/cancel
create table if not exists public.appointment_change_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments(id) on delete cascade,
  tenant_id text,
  event_type text not null check (event_type in ('reschedule', 'cancel')),
  actor text not null default 'customer',
  phone_normalized text,
  before_snapshot jsonb,
  after_snapshot jsonb,
  idempotency_key text,
  customer_email_status text,
  customer_email_claimed_at timestamptz,
  customer_email_sent_at timestamptz,
  customer_email_last_error text,
  clinic_email_status text,
  clinic_email_claimed_at timestamptz,
  clinic_email_sent_at timestamptz,
  clinic_email_last_error text,
  customer_sms_status text,
  customer_sms_claimed_at timestamptz,
  customer_sms_sent_at timestamptz,
  customer_sms_last_error text,
  created_at timestamptz not null default now()
);

-- Safe re-run on DBs that already created the table without SMS claim columns
alter table public.appointment_change_events
  add column if not exists customer_sms_status text;
alter table public.appointment_change_events
  add column if not exists customer_sms_claimed_at timestamptz;
alter table public.appointment_change_events
  add column if not exists customer_sms_sent_at timestamptz;
alter table public.appointment_change_events
  add column if not exists customer_sms_last_error text;

-- Per-change idempotency (retries / double-submit reuse one notify row)
alter table public.appointment_change_events
  add column if not exists idempotency_key text;

create unique index if not exists uq_appointment_change_events_idempotency
  on public.appointment_change_events (idempotency_key)
  where idempotency_key is not null;

create index if not exists idx_appointment_change_events_appointment
  on public.appointment_change_events (appointment_id, created_at desc);

create index if not exists idx_appointment_change_events_created
  on public.appointment_change_events (created_at desc);

create index if not exists idx_appointment_change_events_retry
  on public.appointment_change_events (created_at desc)
  where customer_email_status in ('pending', 'temporary_failure', 'sending')
     or clinic_email_status in ('pending', 'temporary_failure', 'sending')
     or customer_sms_status in ('pending', 'temporary_failure', 'sending');

alter table public.appointment_change_events enable row level security;
