-- Add Google Calendar event id storage for appointment sync.
-- Run once in Supabase → SQL Editor.

alter table appointments
  add column if not exists google_event_id text;

create index if not exists idx_appointments_google_event_id
  on appointments (google_event_id)
  where google_event_id is not null;
