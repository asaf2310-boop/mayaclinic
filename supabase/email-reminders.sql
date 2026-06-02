-- Run once in Supabase SQL Editor (Maya production).
alter table appointments add column if not exists reminder_sent_at timestamptz;
