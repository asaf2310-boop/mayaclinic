import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canBypassSelfServiceOtp,
  generateOtpCode,
  hashOtpCode,
  isProductionRuntime,
  OTP_LENGTH,
} from "../server/appointmentOtp.js";
import {
  createSelfServiceSessionToken,
  verifySelfServiceSessionToken,
} from "../server/selfServiceSession.js";
import {
  canModifyAppointmentWithinPolicy,
  isSameSlot,
  isSlotAllowedForReschedule,
  isUpcomingActiveAppointment,
  jerusalemLocalToUtcMs,
  phoneLookupVariants,
  phonesMatch,
  phoneDigitsKey,
  POLICY_MESSAGE_HE,
  publicAppointmentView,
} from "../server/selfServicePolicy.js";
import {
  buildCustomerCancellationEmail,
  buildCustomerRescheduleEmail,
  buildClinicRescheduleNotifyEmail,
} from "../server/emailTemplates.js";
import { buildAppointmentChangeSms } from "../server/appointmentChangeNotify.js";
import {
  canSendSmsChangeNotify,
  isSmsChangeNotifyEnvEnabled,
} from "../server/sms019.js";
import { hasAppointmentTimeConflict } from "../src/lib/bookingSlots.js";
import { isAppointmentReminderEligible } from "../server/emailDelivery.js";
import { isSmsReminderAppointmentEligible } from "../server/smsReminders.js";

const root = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(root, rel), "utf8");

process.env.SELF_SERVICE_SESSION_SECRET =
  process.env.SELF_SERVICE_SESSION_SECRET || "test-self-service-secret-for-unit-tests";
process.env.SELF_SERVICE_OTP_PEPPER =
  process.env.SELF_SERVICE_OTP_PEPPER || "test-otp-pepper";

// --- Migration present ---
{
  const sql = read("../supabase/customer-self-service.sql");
  assert.match(sql, /appointment_otp_challenges/);
  assert.match(sql, /appointment_change_events/);
  assert.match(sql, /customer_sms_status/);
  assert.match(sql, /calendar_sync_status/);
  assert.match(sql, /idempotency_key/);
  assert.match(sql, /updated_at/);
  assert.doesNotMatch(sql, /SMS_REMINDERS_ENABLED\s*=\s*true/);
}

// --- Phone ownership match ---
{
  assert.equal(phonesMatch("054-900-0301", "+972549000301"), true);
  assert.equal(phonesMatch("0549000301", "549000301"), true);
  assert.equal(phonesMatch("0549000301", "0520000000"), false);
  assert.equal(phoneDigitsKey("+972 54-900-0301"), "0549000301");
  const variants = phoneLookupVariants("0549000301");
  assert.ok(variants.includes("0549000301"));
  assert.ok(variants.includes("972549000301"));
}

// --- Jerusalem DST + 24h boundary ---
{
  const winter = jerusalemLocalToUtcMs("2026-01-15", "10:00");
  assert.equal(new Date(winter).toISOString(), "2026-01-15T08:00:00.000Z"); // UTC+2

  const summer = jerusalemLocalToUtcMs("2026-07-15", "10:00");
  assert.equal(new Date(summer).toISOString(), "2026-07-15T07:00:00.000Z"); // UTC+3

  // now = 2026-01-14 10:00 Jerusalem (08:00Z)
  const now = new Date("2026-01-14T08:00:00.000Z");
  assert.equal(
    canModifyAppointmentWithinPolicy({ date: "2026-01-15", time: "11:00" }, now),
    true,
    "25h ahead should allow"
  );
  assert.equal(
    canModifyAppointmentWithinPolicy({ date: "2026-01-15", time: "09:00" }, now),
    false,
    "23h ahead should block"
  );
  // Exact 24h boundary: start 10:00 next day from now 10:00 → exactly 24h → allowed (>=)
  assert.equal(
    canModifyAppointmentWithinPolicy({ date: "2026-01-15", time: "10:00" }, now),
    true,
    "exactly 24h should allow"
  );

  assert.equal(isSlotAllowedForReschedule({ date: "2026-01-15", time: "09:00" }, now), false);
  assert.equal(isSlotAllowedForReschedule({ date: "2026-01-15", time: "11:00" }, now), true);
  assert.equal(isSameSlot({ date: "2026-01-15", time: "10:00" }, { date: "2026-01-15", time: "10:00:00" }), true);
}

// --- Public view disables actions under 24h ---
{
  const now = new Date("2026-01-14T08:00:00.000Z");
  const view = publicAppointmentView(
    {
      id: "a1",
      date: "2026-01-15",
      time: "09:00",
      treatment_name: "עיסוי",
      status: "confirmed",
      patient_name: "נועה",
    },
    { now, clinicPhone: "0549000301" }
  );
  assert.equal(view.can_modify, false);
  assert.equal(view.policy_message, POLICY_MESSAGE_HE);
  assert.equal(view.clinic_phone, "0549000301");
}

// --- OTP hashing + no production bypass ---
{
  const code = generateOtpCode();
  assert.equal(code.length, OTP_LENGTH);
  assert.match(code, /^\d{6}$/);
  const hash = hashOtpCode("123456", "0549000301");
  assert.equal(hash, hashOtpCode("123456", "0549000301"));
  assert.notEqual(hash, hashOtpCode("123457", "0549000301"));

  const prevNode = process.env.NODE_ENV;
  const prevVercel = process.env.VERCEL_ENV;
  const prevBypass = process.env.SELF_SERVICE_OTP_BYPASS;

  process.env.VERCEL_ENV = "production";
  process.env.SELF_SERVICE_OTP_BYPASS = "true";
  assert.equal(isProductionRuntime(), true);
  assert.equal(canBypassSelfServiceOtp(), false, "no mock bypass in production");

  process.env.VERCEL_ENV = "";
  process.env.NODE_ENV = "development";
  process.env.SELF_SERVICE_OTP_BYPASS = "true";
  assert.equal(canBypassSelfServiceOtp(), true);

  process.env.NODE_ENV = prevNode;
  process.env.VERCEL_ENV = prevVercel;
  process.env.SELF_SERVICE_OTP_BYPASS = prevBypass;
}

// --- Session ownership token ---
{
  const token = createSelfServiceSessionToken({
    phoneNormalized: "0549000301",
    tenantId: "maya",
    ttlSeconds: 120,
  });
  const ok = verifySelfServiceSessionToken(token, { tenantId: "maya" });
  assert.equal(ok.ok, true);
  assert.equal(ok.phoneNormalized, "0549000301");

  const wrongTenant = verifySelfServiceSessionToken(token, { tenantId: "other" });
  assert.equal(wrongTenant.ok, false);

  const tampered = `${token.slice(0, -2)}aa`;
  assert.equal(verifySelfServiceSessionToken(tampered).ok, false);

  // Expired
  const expired = createSelfServiceSessionToken({
    phoneNormalized: "0549000301",
    tenantId: "maya",
    ttlSeconds: -10,
  });
  assert.equal(verifySelfServiceSessionToken(expired).ok, false);
}

// --- Concurrency / slot conflict (exclude self) ---
{
  const existing = [
    { id: "keep", date: "2026-03-01", time: "10:00", status: "confirmed" },
    { id: "self", date: "2026-03-01", time: "12:00", status: "confirmed" },
  ];
  assert.equal(
    hasAppointmentTimeConflict(
      { date: "2026-03-01", time: "12:00", id: "self" },
      existing
    ),
    false,
    "reschedule to own current slot excluded id should not conflict with self"
  );
  assert.equal(
    hasAppointmentTimeConflict(
      { date: "2026-03-01", time: "10:00", id: "self" },
      existing
    ),
    true,
    "moving onto another active booking conflicts"
  );
}

// --- Cancel frees slot for availability logic ---
{
  const day = [
    { id: "c1", date: "2026-03-01", time: "10:00", status: "cancelled" },
    { id: "c2", date: "2026-03-01", time: "14:00", status: "confirmed" },
  ];
  assert.equal(
    hasAppointmentTimeConflict({ date: "2026-03-01", time: "10:00" }, day),
    false,
    "cancelled appointment must not block slot"
  );
  assert.equal(
    hasAppointmentTimeConflict({ date: "2026-03-01", time: "14:00" }, day),
    true
  );
}

// --- Reminders must not send after cancel / must follow new time ---
{
  const cancelled = {
    status: "cancelled",
    date: "2026-06-01",
    time: "10:00",
    patient_phone: "0549000301",
  };
  assert.equal(isAppointmentReminderEligible(cancelled), false);
  assert.equal(isSmsReminderAppointmentEligible(cancelled), false);

  const past = {
    status: "confirmed",
    date: "2020-01-01",
    time: "10:00",
    patient_phone: "0549000301",
  };
  assert.equal(isAppointmentReminderEligible(past), false);

  const future = {
    status: "confirmed",
    date: "2099-06-01",
    time: "10:00",
    patient_phone: "0549000301",
  };
  assert.equal(isAppointmentReminderEligible(future), true);
  assert.equal(isUpcomingActiveAppointment(future), true);
  assert.equal(isUpcomingActiveAppointment(cancelled), false);
}

// --- Email templates Hebrew RTL subjects ---
{
  const reschedule = buildCustomerRescheduleEmail({
    patientName: "נועה",
    previous: { treatment_name: "עיסוי", date: "2026-03-01", time: "10:00", treatment_price: 320 },
    appointment: { treatment_name: "עיסוי", date: "2026-03-08", time: "12:00", treatment_price: 320 },
    clinicName: "אופיר",
  });
  assert.match(reschedule.subject, /עדכון תור/);
  assert.match(reschedule.html, /dir="rtl"/);
  assert.match(reschedule.html, /01\/03\/2026/);
  assert.match(reschedule.html, /08\/03\/2026/);

  const cancel = buildCustomerCancellationEmail({
    patientName: "נועה",
    appointment: { treatment_name: "עיסוי", date: "2026-03-01", time: "10:00" },
    clinicName: "אופיר",
  });
  assert.match(cancel.subject, /ביטול תור/);
  assert.match(cancel.html, /בוטל/);

  const clinic = buildClinicRescheduleNotifyEmail({
    patientName: "נועה",
    patientPhone: "0549000301",
    patientEmail: "n@example.com",
    previous: { treatment_name: "עיסוי", date: "2026-03-01", time: "10:00" },
    appointment: { treatment_name: "עיסוי", date: "2026-03-08", time: "12:00" },
    clinicName: "אופיר",
  });
  assert.match(clinic.subject, /עדכון תור/);
  assert.match(clinic.html, /שירות עצמי/);

  const clinicAdmin = buildClinicRescheduleNotifyEmail({
    patientName: "נועה",
    patientPhone: "0549000301",
    patientEmail: "n@example.com",
    previous: { treatment_name: "עיסוי", date: "2026-03-01", time: "10:00" },
    appointment: { treatment_name: "עיסוי", date: "2026-03-08", time: "12:00" },
    clinicName: "אופיר",
    actor: "admin",
  });
  assert.match(clinicAdmin.html, /מערכת הניהול/);
  assert.doesNotMatch(clinicAdmin.html, /שירות עצמי/);
}

// --- Change SMS templates + env gate (transactional, default on) ---
{
  const rescheduleSms = buildAppointmentChangeSms({
    eventType: "reschedule",
    patientName: "נועה",
    date: "2026-03-08",
    time: "12:00",
    previousDate: "2026-03-01",
    previousTime: "10:00",
    treatmentName: "עיסוי",
    clinicPhone: "0549000301",
  });
  assert.match(rescheduleSms, /נועה/);
  assert.match(rescheduleSms, /עיסוי/);
  assert.match(rescheduleSms, /01\/03\/2026/);
  assert.match(rescheduleSms, /10:00/);
  assert.match(rescheduleSms, /08\/03\/2026/);
  assert.match(rescheduleSms, /12:00/);
  assert.match(rescheduleSms, /עודכן/);
  assert.match(rescheduleSms, /0549000301/);

  const cancelSms = buildAppointmentChangeSms({
    eventType: "cancel",
    patientName: "נועה",
    date: "2026-03-01",
    time: "10:00",
    treatmentName: "עיסוי",
  });
  assert.match(cancelSms, /בוטל/);
  assert.match(cancelSms, /01\/03\/2026/);
  assert.match(cancelSms, /עיסוי/);

  const prevChange = process.env.SMS_CHANGE_NOTIFY_ENABLED;
  const prevUser = process.env.SMS019_USERNAME;
  const prevToken = process.env.SMS019_API_TOKEN;
  const prevSender = process.env.SMS019_SENDER;
  delete process.env.SMS_CHANGE_NOTIFY_ENABLED;
  process.env.SMS019_USERNAME = "unit-test-user";
  process.env.SMS019_API_TOKEN = "unit-test-token";
  process.env.SMS019_SENDER = "0549000301";
  assert.equal(isSmsChangeNotifyEnvEnabled(), true, "change SMS defaults ON");
  assert.equal(canSendSmsChangeNotify(), true);
  process.env.SMS_CHANGE_NOTIFY_ENABLED = "false";
  assert.equal(isSmsChangeNotifyEnvEnabled(), false);
  assert.equal(canSendSmsChangeNotify(), false);
  if (prevChange == null) delete process.env.SMS_CHANGE_NOTIFY_ENABLED;
  else process.env.SMS_CHANGE_NOTIFY_ENABLED = prevChange;
  if (prevUser == null) delete process.env.SMS019_USERNAME;
  else process.env.SMS019_USERNAME = prevUser;
  if (prevToken == null) delete process.env.SMS019_API_TOKEN;
  else process.env.SMS019_API_TOKEN = prevToken;
  if (prevSender == null) delete process.env.SMS019_SENDER;
  else process.env.SMS019_SENDER = prevSender;
}

// --- API + UI entry wired ---
{
  // Hobby plan allows ≤12 serverless functions; self-service mounts on public-data
  // with a /api/self-service rewrite (must not add api/self-service.js).
  // Production ofirbaby.com /booking only proxies real api/*.js paths — client
  // must call /api/public-data (bookingFetch prefixes /booking).
  const http = read("../server/selfServiceHttp.js");
  assert.match(http, /requestOtp/);
  assert.match(http, /verifyOtp/);
  assert.match(http, /reschedule/);
  assert.match(http, /cancel/);

  const publicData = read("../api/public-data.js");
  assert.match(publicData, /handleSelfServiceRequest/);
  assert.match(publicData, /isSelfServiceAction/);

  const vercel = read("../vercel.json");
  assert.match(vercel, /\/api\/self-service/);
  assert.match(vercel, /\/api\/public-data/);

  const clientApi = read("../src/lib/selfServiceApi.js");
  assert.match(clientApi, /bookingFetch\("\/api\/public-data"/);
  assert.doesNotMatch(clientApi, /bookingFetch\("\/api\/self-service"/);

  const app = read("../src/App.jsx");
  assert.match(app, /ManageAppointment/);
  assert.match(app, /\/manage/);

  const book = read("../src/pages/Book.jsx");
  assert.match(book, /עדכון או ביטול תור/);
  assert.match(book, /\/manage/);

  const success = read("../src/components/booking/BookingSuccess.jsx");
  assert.match(success, /עדכון או ביטול תור/);

  const appointments = read("../server/selfServiceAppointments.js");
  assert.match(appointments, /notifySelfServiceChange/);
  assert.match(appointments, /syncCalendarForChangeEvent/);
  assert.match(appointments, /buildReminderResetPatch/);
  // Must await calendar+notify on Vercel (fire-and-forget dies after response).
  // Parallel so one hang cannot starve the other.
  assert.match(appointments, /Promise\.allSettled/);
  assert.match(appointments, /syncCalendarForChangeEvent/);
  assert.match(appointments, /notifySelfServiceChange/);
  assert.doesNotMatch(appointments, /void syncClinicCalendarForAppointment/);
  assert.doesNotMatch(appointments, /void notifySelfServiceChange/);
  assert.doesNotMatch(appointments, /void syncCalendarForChangeEvent/);
  assert.match(appointments, /booking:\s*\{\s*ok:\s*true\s*\}/);
  assert.match(appointments, /google_event_id/);

  const admin = read("../api/admin.js");
  assert.match(admin, /notifyAppointmentChange/);
  assert.match(admin, /recordAppointmentChangeEvent/);
  assert.match(admin, /actor: "admin"/);
  assert.match(admin, /becameCancelled \? "cancel" : "reschedule"/);
  assert.match(admin, /syncCalendarForChangeEvent/);
  assert.match(admin, /notifyAppointmentChange/);
  assert.match(admin, /Promise\.allSettled/);
  assert.match(admin, /maxDuration:\s*30/);
  assert.doesNotMatch(admin, /void \(async/);
  // Admin must notify customer+clinic+SMS on reschedule — not clinic-cancel-only.
  assert.doesNotMatch(admin, /notifyClinicAppointmentCancelled/);

  const changeNotify = read("../server/appointmentChangeNotify.js");
  assert.match(changeNotify, /buildAppointmentChangeSms/);
  assert.match(changeNotify, /canSendSmsChangeNotify/);
  assert.match(changeNotify, /sendSms019/);
  assert.match(changeNotify, /buildChangeIdempotencyKey/);
  assert.match(changeNotify, /idempotency_key/);
  assert.match(changeNotify, /retryFailedAppointmentChangeNotifies/);
  assert.match(changeNotify, /calendar_sync_status/);
  // Channels independent: parallel send + reclaim stuck sending on cron.
  assert.match(changeNotify, /Promise\.allSettled\(\[sendCustomerEmail/);
  assert.match(changeNotify, /pending,temporary_failure,sending/);
  assert.match(changeNotify, /s === "sending"/);
  // Must not gate change SMS on reminder/confirm env (comment may mention them).
  assert.doesNotMatch(changeNotify, /isSmsRemindersEnvEnabled|isSmsBookingConfirmEnvEnabled/);

  const changeSql = read("../supabase/customer-self-service.sql");
  assert.match(changeSql, /idempotency_key/);
  assert.match(changeSql, /uq_appointment_change_events_idempotency/);
  assert.match(changeSql, /'sending'/);
  assert.match(changeSql, /calendar_sync_status/);
  assert.match(changeSql, /calendar_sync_claimed_at/);
  assert.match(changeSql, /calendar_sync_attempts/);

  const sendReminders = read("../api/send-reminders.js");
  assert.match(sendReminders, /retryFailedAppointmentChangeNotifies/);
  assert.match(sendReminders, /retryFailedCalendarSyncs/);
  assert.match(sendReminders, /calendarSync/);

  const calendarSync = read("../server/calendarChangeSync.js");
  assert.match(calendarSync, /resolveCalendarRetryDecision/);
  assert.match(calendarSync, /sanitizeCalendarSyncError/);
  assert.match(calendarSync, /retryFailedCalendarSyncs/);
  assert.match(calendarSync, /newer_slot/);
  assert.match(calendarSync, /now_cancelled/);
  assert.match(calendarSync, /\[redacted/);

  const adminUi = read("../src/pages/Admin.jsx");
  assert.match(adminUi, /refetchInterval/);
  assert.match(adminUi, /refetchOnWindowFocus:\s*true/);

  const gcal = read("../server/googleCalendarMutation.js");
  assert.match(gcal, /jerusalemLocalToUtcMs/);
}

// --- Idempotency key + Jerusalem wall-clock ---
{
  const { buildChangeIdempotencyKey } = await import("../server/appointmentChangeNotify.js");
  const key = buildChangeIdempotencyKey({
    appointmentId: "abc",
    eventType: "reschedule",
    actor: "customer",
    before: { date: "2026-03-01", time: "10:00", status: "confirmed" },
    after: { date: "2026-03-08", time: "12:00", status: "confirmed" },
  });
  assert.match(key, /abc\|reschedule\|customer\|2026-03-01\|10:00/);
  assert.equal(
    buildChangeIdempotencyKey({
      appointmentId: "abc",
      eventType: "reschedule",
      actor: "customer",
      before: { date: "2026-03-01", time: "10:00", status: "confirmed" },
      after: { date: "2026-03-08", time: "12:00", status: "confirmed" },
    }),
    key,
    "idempotency key stable"
  );

  const ms = jerusalemLocalToUtcMs("2026-03-08", "12:00");
  assert.equal(ms != null && Number.isFinite(ms), true);
  // 12:00 Jerusalem in winter is UTC+2 → 10:00Z
  const iso = new Date(ms).toISOString();
  assert.match(iso, /2026-03-08T10:00:00/);
}

// --- Calendar sync retry idempotency guards ---
{
  const {
    resolveCalendarRetryDecision,
    sanitizeCalendarSyncError,
  } = await import("../server/calendarChangeSync.js");

  const baseEvent = {
    id: "evt-1",
    appointment_id: "appt-1",
    event_type: "reschedule",
    created_at: "2026-03-01T10:00:00.000Z",
    before_snapshot: {
      date: "2026-03-01",
      time: "10:00",
      status: "confirmed",
      google_event_id: "gcal-old",
    },
    after_snapshot: {
      date: "2026-03-08",
      time: "12:00",
      status: "confirmed",
      google_event_id: "gcal-old",
    },
  };

  const apply = resolveCalendarRetryDecision(baseEvent, {
    id: "appt-1",
    date: "2026-03-08",
    time: "12:00",
    status: "confirmed",
    google_event_id: "gcal-old",
    updated_at: "2026-03-01T10:00:00.000Z",
  });
  assert.equal(apply.apply, true);
  assert.equal(apply.action, "reschedule");

  const newerSlot = resolveCalendarRetryDecision(baseEvent, {
    id: "appt-1",
    date: "2026-03-09",
    time: "14:00",
    status: "confirmed",
    updated_at: "2026-03-01T11:00:00.000Z",
  });
  assert.equal(newerSlot.apply, false);
  assert.equal(newerSlot.reason, "newer_slot");
  assert.equal(newerSlot.terminalStatus, "skipped_stale");

  const cancelled = resolveCalendarRetryDecision(baseEvent, {
    id: "appt-1",
    date: "2026-03-08",
    time: "12:00",
    status: "cancelled",
    updated_at: "2026-03-01T11:00:00.000Z",
  });
  assert.equal(cancelled.apply, false);
  assert.equal(cancelled.reason, "now_cancelled");

  const cancelEvent = {
    ...baseEvent,
    event_type: "cancel",
    after_snapshot: {
      date: "2026-03-01",
      time: "10:00",
      status: "cancelled",
      google_event_id: "gcal-old",
    },
  };
  const cancelOk = resolveCalendarRetryDecision(cancelEvent, {
    id: "appt-1",
    date: "2026-03-01",
    time: "10:00",
    status: "cancelled",
    google_event_id: "gcal-old",
  });
  assert.equal(cancelOk.apply, true);
  assert.equal(cancelOk.action, "delete");

  const cancelReactivated = resolveCalendarRetryDecision(cancelEvent, {
    id: "appt-1",
    date: "2026-03-01",
    time: "10:00",
    status: "confirmed",
  });
  assert.equal(cancelReactivated.apply, false);
  assert.equal(cancelReactivated.reason, "not_cancelled_anymore");

  const deletedRow = resolveCalendarRetryDecision(cancelEvent, null);
  assert.equal(deletedRow.apply, true);
  assert.equal(deletedRow.action, "delete");
  assert.equal(deletedRow.appointment.google_event_id, "gcal-old");

  const rescheduleMissing = resolveCalendarRetryDecision(baseEvent, null);
  assert.equal(rescheduleMissing.apply, false);
  assert.equal(rescheduleMissing.reason, "appointment_missing");

  // --- Booking create durable retry guards ---
  const createEvent = {
    id: "evt-create-1",
    appointment_id: "appt-new",
    event_type: "create",
    created_at: "2026-03-01T09:00:00.000Z",
    before_snapshot: null,
    after_snapshot: {
      date: "2026-03-10",
      time: "11:00",
      status: "confirmed",
      google_event_id: null,
    },
  };

  const createApply = resolveCalendarRetryDecision(createEvent, {
    id: "appt-new",
    date: "2026-03-10",
    time: "11:00",
    status: "confirmed",
    google_event_id: "gcal-created",
    updated_at: "2026-03-01T09:00:00.000Z",
  });
  assert.equal(createApply.apply, true);
  assert.equal(createApply.action, "create");
  assert.equal(
    createApply.appointment.google_event_id,
    "gcal-created",
    "create retry must reuse existing google_event_id (no duplicate insert)"
  );

  const createCancelled = resolveCalendarRetryDecision(createEvent, {
    id: "appt-new",
    date: "2026-03-10",
    time: "11:00",
    status: "cancelled",
  });
  assert.equal(createCancelled.apply, false);
  assert.equal(createCancelled.reason, "now_cancelled");
  assert.equal(createCancelled.terminalStatus, "skipped_stale");

  const createNewerSlot = resolveCalendarRetryDecision(createEvent, {
    id: "appt-new",
    date: "2026-03-12",
    time: "15:00",
    status: "confirmed",
  });
  assert.equal(createNewerSlot.apply, false);
  assert.equal(createNewerSlot.reason, "newer_slot");

  const createMissing = resolveCalendarRetryDecision(createEvent, null);
  assert.equal(createMissing.apply, false);
  assert.equal(createMissing.reason, "appointment_missing");

  const scrubbed = sanitizeCalendarSyncError(
    "Request failed Bearer ya29.a0AfH6SMC-secret AIzaSyC_testkey client_secret=abc123"
  );
  assert.doesNotMatch(scrubbed, /ya29/);
  assert.doesNotMatch(scrubbed, /AIza/);
  assert.doesNotMatch(scrubbed, /abc123/);
  assert.match(scrubbed, /redacted/i);
}

// --- Booking create uses durable calendar jobs ---
{
  const payments = read("../server/pelecardPayments.js");
  assert.match(payments, /eventType:\s*"create"/);
  assert.match(payments, /calendarOnly:\s*true/);
  assert.match(payments, /syncCalendarForChangeEvent/);
  assert.match(payments, /recordAppointmentChangeEvent/);

  const changeSql = read("../supabase/customer-self-service.sql");
  assert.match(changeSql, /'create',\s*'reschedule',\s*'cancel'/);
  assert.match(changeSql, /appointment_change_events_event_type_check/);

  const notify = read("../server/appointmentChangeNotify.js");
  assert.match(notify, /event_type \|\| ""\) === "create"/);
  assert.match(notify, /calendarOnly/);
}

console.log("self-service tests passed");
