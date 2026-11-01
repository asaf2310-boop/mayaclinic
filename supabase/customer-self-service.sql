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

-- Audit + idempotent notify delivery for customer/admin reschedule/cancel.
-- appointment_id is nullable + ON DELETE SET NULL so hard-delete still leaves
-- email/SMS/calendar retry rows (snapshots carry enough to finish delivery).
create table if not exists public.appointment_change_events (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete set null,
  tenant_id text,
  event_type text not null check (event_type in ('create', 'reschedule', 'cancel')),
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
  calendar_sync_status text,
  calendar_sync_claimed_at timestamptz,
  calendar_sync_synced_at timestamptz,
  calendar_sync_last_error text,
  calendar_sync_attempts integer not null default 0,
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

-- Durable Google Calendar sync claim/retry (same pattern as email/SMS)
alter table public.appointment_change_events
  add column if not exists calendar_sync_status text;
alter table public.appointment_change_events
  add column if not exists calendar_sync_claimed_at timestamptz;
alter table public.appointment_change_events
  add column if not exists calendar_sync_synced_at timestamptz;
alter table public.appointment_change_events
  add column if not exists calendar_sync_last_error text;
alter table public.appointment_change_events
  add column if not exists calendar_sync_attempts integer not null default 0;

-- Allow durable GCal create jobs (PayBox/cash/booking) alongside reschedule/cancel.
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'appointment_change_events'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%event_type%'
  limit 1;

  if constraint_name is not null then
    execute format(
      'alter table public.appointment_change_events drop constraint %I',
      constraint_name
    );
  end if;

  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'appointment_change_events'
      and con.conname = 'appointment_change_events_event_type_check'
  ) then
    alter table public.appointment_change_events
      add constraint appointment_change_events_event_type_check
      check (event_type in ('create', 'reschedule', 'cancel'));
  end if;
end $$;

-- Existing DBs may still cascade-delete change events with the appointment.
-- Switch to SET NULL so notify/calendar retries survive admin hard-delete.
alter table public.appointment_change_events
  alter column appointment_id drop not null;

do $$
declare
  fk_name text;
begin
  select tc.constraint_name into fk_name
  from information_schema.table_constraints tc
  join information_schema.key_column_usage kcu
    on tc.constraint_name = kcu.constraint_name
   and tc.table_schema = kcu.table_schema
  where tc.table_schema = 'public'
    and tc.table_name = 'appointment_change_events'
    and tc.constraint_type = 'FOREIGN KEY'
    and kcu.column_name = 'appointment_id'
  limit 1;

  if fk_name is not null then
    execute format(
      'alter table public.appointment_change_events drop constraint %I',
      fk_name
    );
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints
    where table_schema = 'public'
      and table_name = 'appointment_change_events'
      and constraint_name = 'appointment_change_events_appointment_id_fkey'
  ) then
    alter table public.appointment_change_events
      add constraint appointment_change_events_appointment_id_fkey
      foreign key (appointment_id)
      references public.appointments(id)
      on delete set null;
  end if;
end $$;

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
     or customer_sms_status in ('pending', 'temporary_failure', 'sending')
     or calendar_sync_status in ('pending', 'temporary_failure', 'sending');

alter table public.appointment_change_events enable row level security;
