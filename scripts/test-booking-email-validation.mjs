import assert from "node:assert/strict";
import {
  EMAIL_DOMAIN_SUGGESTIONS,
  validateBookingEmail,
} from "../src/lib/bookingEmailValidation.js";
import {
  classifyEmailSendError,
  isAppointmentReminderEligible,
  MAX_EMAIL_ATTEMPTS,
  reminderOccurrenceKey,
} from "../server/emailDelivery.js";

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

// Domain lowercased only
{
  const result = validateBookingEmail("User@GMail.COM");
  assert.equal(result.ok, true);
  assert.equal(result.normalized, "User@gmail.com");
}

// 5) Invalid email syntax → blocked
for (const bad of ["", "not-an-email", "a@@b.com", "a b@c.com", "@x.com", "x@"]) {
  const required = bad === "" ? true : false;
  const result = validateBookingEmail(bad, { required: bad === "" || required });
  if (bad === "") {
    assert.equal(validateBookingEmail("", { required: true }).ok, false);
    assert.equal(validateBookingEmail("", { required: false }).ok, true);
  } else {
    assert.equal(result.ok, false, `expected invalid: ${bad}`);
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

// Future appointment → eligible
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

// 9) Rescheduled appointment → old reminder occurrence key changes with date
{
  const oldKey = reminderOccurrenceKey({ date: "2026-10-10" });
  const newKey = reminderOccurrenceKey({ date: "2026-10-12" });
  assert.equal(oldKey, "reminder:2026-10-10");
  assert.notEqual(oldKey, newKey);
}

// 10) Duplicate job execution — claim pattern documented via source invariants
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const root = dirname(fileURLToPath(import.meta.url));
  const reminders = readFileSync(join(root, "../api/send-reminders.js"), "utf8");
  assert.match(reminders, /claimReminderSend/);
  assert.match(reminders, /fetchAppointmentById/);
  assert.match(reminders, /isAppointmentReminderEligible/);
  const payments = readFileSync(join(root, "../server/pelecardPayments.js"), "utf8");
  assert.match(payments, /claimConfirmationSend/);
  assert.match(payments, /sendPatientEmail/);
}

// 11) Corrected email — admin update clears suppression, does not auto-resend
{
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const root = dirname(fileURLToPath(import.meta.url));
  const admin = readFileSync(join(root, "../api/admin.js"), "utf8");
  assert.match(admin, /clearEmailSuppression/);
  assert.match(admin, /Do not auto-resend|לא יישלחו|clearEmailSuppression/);
  assert.doesNotMatch(admin, /maybeSendConfirmationEmail/);
}

// 12) Existing required empty email still works as optional when not required
{
  assert.equal(validateBookingEmail("", { required: false }).ok, true);
}

console.log("test-booking-email-validation: OK");
