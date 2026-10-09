import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  EMAIL_DOMAIN_SUGGESTIONS,
  validateBookingEmail,
} from "../src/lib/bookingEmailValidation.js";
import {
  classifyEmailSendError,
  isAppointmentReminderEligible,
  MAX_EMAIL_ATTEMPTS,
  reminderOccurrenceKey,
  STALE_EMAIL_CLAIM_MS,
  canClaimEmailDelivery,
  buildEmailClaimOrFilter,
} from "../server/emailDelivery.js";

const root = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(root, rel), "utf8");

// 1) gmail.con → suggestion
{
  const result = validateBookingEmail("name@gmail.con", { required: true });
  assert.equal(result.ok, true);
  assert.equal(result.suggestion?.toDomain, "gmail.com");
  assert.equal(result.suggestion?.suggestedEmail, "name@gmail.com");
}

// 2) gmal.com → suggestion
{
  const result = validateBookingEmail("user@gmal.com");
  assert.equal(result.ok, true);
  assert.equal(result.suggestion?.suggestedEmail, "user@gmail.com");
}

// 3) Correct address → accepted, no warning
{
  const result = validateBookingEmail("user@gmail.com", { required: true });
  assert.equal(result.ok, true);
  assert.equal(result.normalized, "user@gmail.com");
  assert.equal(result.suggestion, null);
}

// 4) Unusual but valid domain → no false rejection
{
  const result = validateBookingEmail("parent@my-family.clinic");
  assert.equal(result.ok, true);
  assert.equal(result.suggestion, null);
}

// Domain lowercased only — never auto-rewrite local part
{
  const result = validateBookingEmail("User@GMail.COM");
  assert.equal(result.ok, true);
  assert.equal(result.normalized, "User@gmail.com");
}

// 5) Invalid email syntax → blocked
for (const bad of ["", "not-an-email", "a@@b.com", "a b@c.com", "@x.com", "x@"]) {
  if (bad === "") {
    assert.equal(validateBookingEmail("", { required: true }).ok, false);
    assert.equal(validateBookingEmail("", { required: false }).ok, true);
  } else {
    assert.equal(validateBookingEmail(bad).ok, false, `expected invalid: ${bad}`);
  }
}

assert.equal(EMAIL_DOMAIN_SUGGESTIONS["gmail.co.il"], "gmail.com");

// 6) Permanent delivery failure → no application retry
{
  const classified = classifyEmailSendError({
    message: "550 5.1.1 The email account that you tried to reach does not exist",
    responseCode: 550,
  });
  assert.equal(classified.kind, "permanent_failure");
  assert.equal(classified.retryable, false);
}

// 7) Transient failure → bounded retries
{
  const classified = classifyEmailSendError({
    message: "451 Temporary local problem - please try later",
    responseCode: 451,
  });
  assert.equal(classified.kind, "temporary_failure");
  assert.equal(classified.retryable, true);
  assert.equal(MAX_EMAIL_ATTEMPTS, 3);
}

// Generic 5xx without recipient diagnostics → not auto permanent
{
  const classified = classifyEmailSendError({
    message: "500 unrecognized command",
    responseCode: 500,
  });
  assert.equal(classified.retryable, true);
}

// 8) Expired appointment → no reminder
{
  const eligible = isAppointmentReminderEligible(
    { date: "2020-01-01", time: "10:00", status: "confirmed" },
    new Date("2026-10-09T12:00:00Z")
  );
  assert.equal(eligible, false);
}

// Cancelled → not eligible
{
  assert.equal(
    isAppointmentReminderEligible({
      date: "2099-01-01",
      time: "10:00",
      status: "cancelled",
    }),
    false
  );
}

// Future appointment → eligible (existing valid booking)
{
  assert.equal(
    isAppointmentReminderEligible({
      date: "2099-06-01",
      time: "10:00",
      status: "confirmed",
    }),
    true
  );
}

// 9) Rescheduled appointment → occurrence key changes; admin resets reminder fields
{
  const oldKey = reminderOccurrenceKey({ date: "2026-10-10" });
  const newKey = reminderOccurrenceKey({ date: "2026-10-12" });
  assert.equal(oldKey, "reminder:2026-10-10");
  assert.notEqual(oldKey, newKey);
  const admin = read("../api/admin.js");
  assert.match(admin, /reminder_sent_at = null/);
  assert.match(admin, /payload\.date/);
  assert.doesNotMatch(admin, /maybeSendConfirmationEmail/);
}

// 10) Concurrent send attempts — only one claimable worker wins
{
  const now = new Date("2026-10-09T12:00:00.000Z");
  const row = { status: "pending", claimedAt: null, sentAt: null };
  assert.equal(canClaimEmailDelivery(row, now), true);

  // Simulate winner flipping to sending
  const afterClaim = {
    status: "sending",
    claimedAt: now.toISOString(),
    sentAt: null,
  };
  assert.equal(
    canClaimEmailDelivery(afterClaim, now),
    false,
    "fresh sending must block concurrent claim"
  );
  assert.equal(
    canClaimEmailDelivery(afterClaim, new Date(now.getTime() + 1000)),
    false
  );

  const reminders = read("../api/send-reminders.js");
  assert.match(reminders, /claimReminderSend/);
  assert.match(reminders, /smtpAccepted/);
  const payments = read("../server/pelecardPayments.js");
  assert.match(payments, /claimConfirmationSend/);
  assert.match(payments, /sendPatientEmail/);
  // No pre-migration send-without-claim stub
  const supabase = read("../server/supabaseServer.js");
  assert.doesNotMatch(
    supabase,
    /confirmation_email_attempts:\s*0\s*\}/
  );
}

// Stale delivery claims — reclaim after TTL; not before
{
  const claimedAt = "2026-10-09T11:00:00.000Z";
  const now = new Date("2026-10-09T12:00:00.000Z");
  assert.ok(now.getTime() - new Date(claimedAt).getTime() >= STALE_EMAIL_CLAIM_MS);
  assert.equal(
    canClaimEmailDelivery({ status: "sending", claimedAt, sentAt: null }, now),
    true,
    "stale sending is reclaimable"
  );
  assert.equal(
    canClaimEmailDelivery(
      { status: "sending", claimedAt, sentAt: null },
      new Date(new Date(claimedAt).getTime() + STALE_EMAIL_CLAIM_MS - 1)
    ),
    false,
    "not-yet-stale sending is not reclaimable"
  );
  // Already accepted / sent must never be reclaimed
  assert.equal(
    canClaimEmailDelivery(
      { status: "sending", claimedAt, sentAt: "2026-10-09T11:05:00.000Z" },
      now
    ),
    false
  );
  assert.equal(
    canClaimEmailDelivery({ status: "accepted", claimedAt: null, sentAt: null }, now),
    false
  );
  assert.equal(
    canClaimEmailDelivery(
      { status: "permanent_failure", claimedAt: null, sentAt: null },
      now
    ),
    false
  );

  const filter = buildEmailClaimOrFilter(
    "reminder_email_status",
    "reminder_email_claimed_at",
    now
  );
  assert.match(filter, /reminder_email_status\.in\.\(pending,temporary_failure\)/);
  assert.match(filter, /reminder_email_status\.eq\.sending/);
  assert.match(filter, /reminder_email_claimed_at\.lt\."/);
}

// Migration compatibility — idempotent ADD COLUMN / IF NOT EXISTS, no DROP TABLE
{
  const migration = read("../supabase/appointment-email-delivery.sql");
  assert.match(migration, /add column if not exists confirmation_email_status/i);
  assert.match(migration, /add column if not exists reminder_email_claimed_at/i);
  assert.match(migration, /create table if not exists public\.email_suppressions/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.email_suppressions/i);
  assert.doesNotMatch(migration, /drop table/i);
  assert.doesNotMatch(migration, /truncate/i);
  assert.doesNotMatch(migration, /delete from/i);
}

// 11) Corrected email — admin update clears suppression, does not auto-resend
{
  const admin = read("../api/admin.js");
  assert.match(admin, /clearEmailSuppression/);
  assert.match(admin, /Do not auto-resend|clearEmailSuppression/);
  assert.doesNotMatch(admin, /maybeSendConfirmationEmail/);
}

// 12) Existing required empty email still works as optional when not required
{
  assert.equal(validateBookingEmail("", { required: false }).ok, true);
}

console.log("test-booking-email-validation: OK");

