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
}

// --- API + UI entry wired ---
{
  const api = read("../api/self-service.js");
  assert.match(api, /requestOtp/);
  assert.match(api, /verifyOtp/);
  assert.match(api, /reschedule/);
  assert.match(api, /cancel/);

  const app = read("../src/App.jsx");
  assert.match(app, /ManageAppointment/);
  assert.match(app, /\/manage/);

  const book = read("../src/pages/Book.jsx");
  assert.match(book, /עדכון או ביטול תור/);
  assert.match(book, /\/manage/);

  const success = read("../src/components/booking/BookingSuccess.jsx");
  assert.match(success, /עדכון או ביטול תור/);
}

console.log("self-service tests passed");
