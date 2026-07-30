-- Pelecard payment sessions (ManualIframe server-side feedback).
-- Run in Supabase SQL Editor after schema.sql / multi-tenant.sql.

create table if not exists pelecard_payments (
  id uuid primary key default gen_random_uuid(),
  booking_ref text not null unique,
  tenant_id text,
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed')),
  total_agorot integer not null,
  confirmation_key text,
  pelecard_transaction_id text,
  approval_no text,
  booking_payload jsonb not null default '{}'::jsonb,
  appointment_ids uuid[] not null default '{}',
  result_payload jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pelecard_payments_status on pelecard_payments(status);
create index if not exists idx_pelecard_payments_created_at on pelecard_payments(created_at desc);

alter table pelecard_payments enable row level security;

-- IMPORTANT SECURITY NOTE:
-- Do NOT expose this table to anon/authenticated browser clients.
-- booking_payload contains patient_name / phone / email / notes.
-- The booking app now reads session status through /api/pelecard/session
-- using a signed token verified on the server, so no direct RLS policy is needed here.
-- Supabase service-role requests bypass RLS and continue to work for server code.
drop policy if exists "pelecard_payments_select" on pelecard_payments;
drop policy if exists "pelecard_payments_insert" on pelecard_payments;
drop policy if exists "pelecard_payments_update" on pelecard_payments;
