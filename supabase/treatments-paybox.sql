-- Run in Supabase SQL Editor after schema.sql.
-- Adds per-treatment PayBox payment link (optional).

alter table treatments add column if not exists paybox_link text;
