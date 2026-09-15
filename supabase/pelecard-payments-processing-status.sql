-- Allow atomic claim of Pelecard payment sessions during finalize.
-- Prevents duplicate appointment creation / confirmation emails when Pelecard
-- retries ServerSideGoodFeedbackURL concurrently.
--
-- REQUIRED OPS STEP: run this in the Supabase SQL Editor before (or right after)
-- deploying the app change. Until it runs, the server falls back to a non-atomic
-- path and logs a warning pointing here.
-- Run after supabase/pelecard-payments.sql (or on an existing pelecard_payments table).

alter table pelecard_payments drop constraint if exists pelecard_payments_status_check;

alter table pelecard_payments
  add constraint pelecard_payments_status_check
  check (status in ('pending', 'processing', 'paid', 'failed'));
