import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  canClaimEmailDelivery,
  buildEmailClaimOrFilter,
  STALE_EMAIL_CLAIM_MS,
} from "../server/emailClaim.js";
import {
  digitsOnly,
  isValidIsraeliMobile,
  normalizeIsraeliMobile,
} from "../server/israeliPhone.js";
import {
  buildSms019Payload,
  interpretSms019Response,
  isSmsRemindersEnvEnabled,
  sendSms019,
} from "../server/sms019.js";
import {
  buildAppointmentReminderSms,
  canSendLiveSmsReminders,
  getReminderTargetDateIso,
  isSmsReminderAppointmentEligible,
  isSmsReminderIneligibilityTerminal,
  leadHoursToTargetDays,
  normalizeSmsLeadHours,
  sendAdminTestSms,
} from "../server/smsReminders.js";
import {
  LIVE_SMS_TEST_ALLOWED_RECIPIENTS,
  LIVE_SMS_TEST_MESSAGE,
  getLiveSmsTestPreview,
  isAllowedLiveSmsTestRecipient,
  resetLiveSmsTestGateForTests,
  sendAdminLiveTestSms,
} from "../server/smsLiveTest.js";
import { getRecentAdminAuditEvents } from "../server/adminAuditLog.js";

const root = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(root, rel), "utf8");

// --- Phone normalization ---
{
  assert.equal(normalizeIsraeliMobile("054-900-0301").normalized, "0549000301");
  assert.equal(normalizeIsraeliMobile("549000301").normalized, "0549000301");
  assert.equal(normalizeIsraeliMobile("+972549000301").normalized, "0549000301");
  assert.equal(normalizeIsraeliMobile("972-54-900-0301").normalized, "0549000301");
  assert.equal(normalizeIsraeliMobile("03-1234567").ok, false);
  assert.equal(normalizeIsraeliMobile("").ok, false);
  assert.equal(normalizeIsraeliMobile("12345").ok, false);
  assert.equal(isValidIsraeliMobile("0501234567"), true);
  assert.equal(digitsOnly("+972 50-123-4567"), "972501234567");
}

// --- Message copy: no treatment / price / medical details ---
{
  const msg = buildAppointmentReminderSms({
    patientName: "נועה",
    date: "2026-10-13",
    time: "10:30",
  });
  assert.match(msg, /נועה/);
  assert.match(msg, /13\/10\/2026/);
  assert.match(msg, /10:30/);
  assert.match(msg, /OfirBaby/);
  assert.match(msg, /0549000301/);
  assert.doesNotMatch(msg, /טיפול|מחיר|₪|עיסוי|מרידיאן/i);
}

// --- Eligibility: cancel / completed / invalid phone / past ---
{
  const future = {
    status: "confirmed",
    date: "2099-01-15",
    time: "11:00",
    patient_phone: "0501234567",
  };
  assert.equal(isSmsReminderAppointmentEligible(future), true);

  assert.equal(
    isSmsReminderAppointmentEligible({ ...future, status: "cancelled" }),
    false
  );
  assert.equal(
    isSmsReminderAppointmentEligible({ ...future, status: "completed" }),
    false
  );
  assert.equal(
    isSmsReminderAppointmentEligible({ ...future, patient_phone: "031234567" }),
    false
  );
  assert.equal(
    isSmsReminderIneligibilityTerminal({ ...future, status: "cancelled" }),
    true
  );
  assert.equal(
    isSmsReminderIneligibilityTerminal({
      ...future,
      date: "2000-01-01",
      status: "confirmed",
    }),
    true
  );
}

// --- Lead time / target date (Israel calendar) ---
{
  assert.equal(normalizeSmsLeadHours(24), 24);
  assert.equal(normalizeSmsLeadHours(0), 1);
  assert.equal(normalizeSmsLeadHours(200), 72);
  assert.equal(leadHoursToTargetDays(24), 1);
  assert.equal(leadHoursToTargetDays(48), 2);

  const fixed = new Date("2026-10-12T10:00:00.000Z");
  const d1 = getReminderTargetDateIso(24, fixed);
  const d2 = getReminderTargetDateIso(48, fixed);
  assert.match(d1, /^\d{4}-\d{2}-\d{2}$/);
  assert.notEqual(d1, d2);
}

// --- Provider response: status 0 = accepted (not delivered) ---
{
  const ok = interpretSms019Response(
    { status: 0, message: "SMS will be sent", shipment_id: "SHIP123" },
    200
  );
  assert.equal(ok.ok, true);
  assert.equal(ok.accepted, true);
  assert.equal(ok.shipmentId, "SHIP123");
  assert.equal(ok.retryable, false);

  const bad = interpretSms019Response({ status: 5, message: "error" }, 200);
  assert.equal(bad.ok, false);
  assert.equal(bad.retryable, false);
}

// --- Payload structure matches 019 docs ---
{
  const payload = buildSms019Payload({
    username: "demo",
    source: "0549000301",
    phone: "0501234567",
    message: "hello",
    externalId: "apt-1",
  });
  assert.equal(payload.sms.user.username, "demo");
  assert.equal(payload.sms.source, "0549000301");
  assert.equal(payload.sms.destinations.phone[0]._, "0501234567");
  assert.equal(payload.sms.destinations.phone[0].$.id, "apt-1");
  assert.equal(payload.sms.message, "hello");
}

// --- Env gate defaults OFF; live requires env + admin ---
{
  const prev = process.env.SMS_REMINDERS_ENABLED;
  delete process.env.SMS_REMINDERS_ENABLED;
  assert.equal(isSmsRemindersEnvEnabled(), false);
  assert.equal(canSendLiveSmsReminders({ enabled: true }), false);
  process.env.SMS_REMINDERS_ENABLED = "true";
  // Still false without provider credentials in this env
  assert.equal(isSmsRemindersEnvEnabled(), true);
  assert.equal(
    canSendLiveSmsReminders({ enabled: false }),
    false,
    "admin toggle must also be on"
  );
  if (prev == null) delete process.env.SMS_REMINDERS_ENABLED;
  else process.env.SMS_REMINDERS_ENABLED = prev;
}

// --- sendSms019 uses test endpoint when requested; never needs live network ---
{
  const prevUser = process.env.SMS019_USERNAME;
  const prevToken = process.env.SMS019_API_TOKEN;
  process.env.SMS019_USERNAME = "unit-test-user";
  process.env.SMS019_API_TOKEN = "unit-test-token";

  let calledUrl = "";
  let calledAuth = "";
  const result = await sendSms019({
    phone: "0501234567",
    message: "test",
    useTestEndpoint: true,
    fetchImpl: async (url, options) => {
      calledUrl = url;
      calledAuth = options.headers.Authorization;
      return {
        status: 200,
        json: async () => ({ status: 0, message: "ok", shipment_id: "T1" }),
      };
    },
  });
  assert.equal(calledUrl, "https://019sms.co.il/api/test");
  assert.equal(calledAuth, "Bearer unit-test-token");
  assert.equal(result.ok, true);
  assert.equal(result.shipmentId, "T1");
  assert.equal(result.usedTestEndpoint, true);

  // Invalid phone → no fetch
  let fetchCalled = false;
  const invalid = await sendSms019({
    phone: "123",
    message: "x",
    fetchImpl: async () => {
      fetchCalled = true;
      return { status: 200, json: async () => ({}) };
    },
  });
  assert.equal(fetchCalled, false);
  assert.equal(invalid.error, "invalid_israeli_mobile");

  // Provider failure → not retryable
  const fail = await sendSms019({
    phone: "0501234567",
    message: "x",
    useTestEndpoint: true,
    fetchImpl: async () => ({
      status: 200,
      json: async () => ({ status: 2, message: "denied" }),
    }),
  });
  assert.equal(fail.ok, false);
  assert.equal(fail.retryable, false);

  if (prevUser == null) delete process.env.SMS019_USERNAME;
  else process.env.SMS019_USERNAME = prevUser;
  if (prevToken == null) delete process.env.SMS019_API_TOKEN;
  else process.env.SMS019_API_TOKEN = prevToken;
}

// --- Admin test SMS requires confirm; prefers test endpoint ---
{
  const prevUser = process.env.SMS019_USERNAME;
  const prevToken = process.env.SMS019_API_TOKEN;
  const prevEnabled = process.env.SMS_REMINDERS_ENABLED;
  process.env.SMS019_USERNAME = "unit-test-user";
  process.env.SMS019_API_TOKEN = "unit-test-token";
  delete process.env.SMS_REMINDERS_ENABLED;

  const noConfirm = await sendAdminTestSms({ phone: "0501234567", confirm: false });
  assert.equal(noConfirm.error, "confirm_required");

  let url = "";
  const tested = await sendAdminTestSms({
    phone: "0501234567",
    confirm: true,
    useLive: true, // even if requested, env off → still test endpoint
    fetchImpl: async (u) => {
      url = u;
      return {
        status: 200,
        json: async () => ({ status: 0, message: "ok", shipment_id: "TEST" }),
      };
    },
  });
  assert.equal(url, "https://019sms.co.il/api/test");
  assert.equal(tested.usedTestEndpoint, true);
  assert.equal(tested.sentLive, false);
  assert.equal(tested.ok, true);

  if (prevUser == null) delete process.env.SMS019_USERNAME;
  else process.env.SMS019_USERNAME = prevUser;
  if (prevToken == null) delete process.env.SMS019_API_TOKEN;
  else process.env.SMS019_API_TOKEN = prevToken;
  if (prevEnabled == null) delete process.env.SMS_REMINDERS_ENABLED;
  else process.env.SMS_REMINDERS_ENABLED = prevEnabled;
}

// --- Live admin SMS test: allowlist, confirm, live endpoint, no env gate ---
{
  const prevUser = process.env.SMS019_USERNAME;
  const prevToken = process.env.SMS019_API_TOKEN;
  const prevSender = process.env.SMS019_SENDER;
  const prevEnabled = process.env.SMS_REMINDERS_ENABLED;
  process.env.SMS019_USERNAME = "unit-test-user";
  process.env.SMS019_API_TOKEN = "unit-test-token";
  process.env.SMS019_SENDER = "0549000301";
  delete process.env.SMS_REMINDERS_ENABLED;
  resetLiveSmsTestGateForTests();

  assert.equal(LIVE_SMS_TEST_ALLOWED_RECIPIENTS[0], "0502677765");
  assert.equal(
    LIVE_SMS_TEST_MESSAGE,
    "בדיקת SMS ממערכת OfirBaby. אם קיבלת הודעה זו, שירות התזכורות פועל בהצלחה."
  );
  assert.equal(isAllowedLiveSmsTestRecipient("0502677765"), true);
  assert.equal(isAllowedLiveSmsTestRecipient("+972502677765"), true);
  assert.equal(isAllowedLiveSmsTestRecipient("0501234567"), false);

  const preview = getLiveSmsTestPreview();
  assert.equal(preview.phone, "0502677765");
  assert.equal(preview.endpoint, "https://019sms.co.il/api");
  assert.equal(preview.providerConfigured, true);

  const noConfirm = await sendAdminLiveTestSms({ confirm: false });
  assert.equal(noConfirm.error, "confirm_required");
  assert.equal(noConfirm.sentLive, false);

  const blocked = await sendAdminLiveTestSms({
    confirm: true,
    phone: "0501234567",
    fetchImpl: async () => {
      throw new Error("should_not_call_provider");
    },
  });
  assert.equal(blocked.error, "recipient_not_allowlisted");

  let liveUrl = "";
  let liveBody = null;
  const liveOk = await sendAdminLiveTestSms({
    confirm: true,
    phone: "0502677765",
    actorEmail: "ops@example.com",
    fetchImpl: async (u, init) => {
      liveUrl = u;
      liveBody = JSON.parse(init.body);
      return {
        status: 200,
        json: async () => ({ status: 0, message: "ok", shipment_id: "LIVE-SHIP" }),
      };
    },
  });
  assert.equal(liveUrl, "https://019sms.co.il/api");
  assert.equal(liveOk.ok, true);
  assert.equal(liveOk.accepted, true);
  assert.equal(liveOk.sentLive, true);
  assert.equal(liveOk.usedTestEndpoint, false);
  assert.equal(liveOk.shipmentId, "LIVE-SHIP");
  assert.equal(liveBody.sms.message, LIVE_SMS_TEST_MESSAGE);
  assert.equal(liveBody.sms.source, "0549000301");
  assert.match(liveOk.note || "", /≠|קבלה|מסירה/);

  // Cooldown / single-flight: immediate second send must be rejected.
  const cooled = await sendAdminLiveTestSms({
    confirm: true,
    phone: "0502677765",
    fetchImpl: async () => {
      throw new Error("should_not_call_during_cooldown");
    },
  });
  assert.equal(cooled.error, "live_test_cooldown");
  assert.ok(cooled.retryAfterSec >= 1);

  const audits = getRecentAdminAuditEvents({ limit: 10 });
  assert.ok(audits.some((e) => e.action === "sms_live_test_attempt"));
  assert.ok(audits.some((e) => e.action === "sms_live_test_result" && e.ok === true));
  assert.ok(
    !JSON.stringify(audits).includes("unit-test-token"),
    "audit must never contain API token"
  );

  if (prevUser == null) delete process.env.SMS019_USERNAME;
  else process.env.SMS019_USERNAME = prevUser;
  if (prevToken == null) delete process.env.SMS019_API_TOKEN;
  else process.env.SMS019_API_TOKEN = prevToken;
  if (prevSender == null) delete process.env.SMS019_SENDER;
  else process.env.SMS019_SENDER = prevSender;
  if (prevEnabled == null) delete process.env.SMS_REMINDERS_ENABLED;
  else process.env.SMS_REMINDERS_ENABLED = prevEnabled;
  resetLiveSmsTestGateForTests();
}

// --- Concurrent claim semantics (reuse email claim helpers for SMS columns) ---
{
  const now = new Date("2026-10-12T12:00:00.000Z");
  assert.equal(
    canClaimEmailDelivery({ status: "pending", claimedAt: null, sentAt: null }, now),
    true
  );
  assert.equal(
    canClaimEmailDelivery(
      { status: "sending", claimedAt: now.toISOString(), sentAt: null },
      now
    ),
    false,
    "fresh sending blocks concurrent SMS claim"
  );
  assert.equal(
    canClaimEmailDelivery(
      {
        status: "sending",
        claimedAt: new Date(now.getTime() - STALE_EMAIL_CLAIM_MS - 1).toISOString(),
        sentAt: null,
      },
      now
    ),
    true
  );
  assert.equal(
    canClaimEmailDelivery({ status: "accepted", claimedAt: null, sentAt: null }, now),
    false
  );
  assert.equal(
    canClaimEmailDelivery(
      { status: "temporary_failure", claimedAt: null, sentAt: null },
      now
    ),
    true
  );

  const filter = buildEmailClaimOrFilter(
    "reminder_sms_status",
    "reminder_sms_claimed_at",
    now
  );
  assert.match(filter, /reminder_sms_status\.in\.\(pending,temporary_failure\)/);
  assert.match(filter, /reminder_sms_claimed_at\.lt\."/);
}

// --- Source wiring: cron, admin reset, migration, no client credentials ---
{
  const reminders = read("../api/send-reminders.js");
  assert.match(reminders, /processSmsReminders|claimSmsReminderSend/);
  assert.match(reminders, /canSendLiveSmsReminders/);
  assert.match(reminders, /markSmsReminderOutcome/);
  assert.match(reminders, /send_interrupted_no_retry|temporary_failure/);
  // Email path preserved
  assert.match(reminders, /claimReminderSend/);
  assert.match(reminders, /sendPatientEmail/);

  const supabase = read("../server/supabaseServer.js");
  assert.match(supabase, /claimSmsReminderSend/);
  assert.match(supabase, /fetchAppointmentsNeedingSmsReminder/);
  assert.match(supabase, /reminder_sms_sent_at/);
  assert.match(supabase, /status=not\.in\.\(cancelled,completed\)/);

  const admin = read("../api/admin.js");
  assert.match(admin, /reminder_sms_sent_at = null/);
  assert.match(admin, /reminder_sms_status = "pending"/);
  assert.match(admin, /reminder_sms_status = "cancelled"/);
  assert.match(admin, /action === "sms-test"/);
  assert.match(admin, /action === "sms-live-test"/);
  assert.match(admin, /sendAdminLiveTestSms/);
  assert.match(admin, /action === "sms-reminder-settings"/);
  assert.match(admin, /useLive: Boolean\(body\.useLive\)/);
  // Cancel/reschedule must not hard-fail before SMS migration is applied.
  assert.match(admin, /reminder sms columns missing on appointment update/);
  assert.match(admin, /key\.startsWith\("reminder_sms_"\)/);

  const migration = read("../supabase/appointment-sms-delivery.sql");
  assert.match(migration, /reminder_sms_status/);
  assert.match(migration, /reminder_sms_shipment_id/);
  assert.match(migration, /create table if not exists public\.sms_reminder_settings/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /revoke all on table public\.sms_reminder_settings/i);
  assert.doesNotMatch(migration, /drop table/i);

  // No VITE_ SMS secrets
  const envExample = read("../.env.example");
  assert.match(envExample, /SMS019_API_TOKEN/);
  assert.match(envExample, /SMS_REMINDERS_ENABLED=false/);
  assert.doesNotMatch(envExample, /VITE_SMS019/);

  const clientFiles = [
    "../src/components/admin/SmsReminderSettings.jsx",
    "../src/pages/Admin.jsx",
    "../src/components/admin/AppointmentTable.jsx",
  ];
  for (const file of clientFiles) {
    const src = read(file);
    // Client must not embed credentials or call the provider host directly.
    assert.doesNotMatch(src, /SMS019_API_TOKEN|019sms\.co\.il/);
  }

  // Admin dry-run test UI forces useLive:false; live path is separate action.
  const ui = read("../src/components/admin/SmsReminderSettings.jsx");
  assert.match(ui, /useLive:\s*false/);
  assert.match(ui, /window\.confirm/);
  assert.match(ui, /שליחת SMS אמיתי לבדיקה/);
  assert.match(ui, /action=sms-live-test/);
  assert.match(ui, /0502677765/);
  assert.match(ui, /קבלה אצל הספק אינה מאשרת מסירה/);

  const liveMod = read("../server/smsLiveTest.js");
  assert.match(liveMod, /https:\/\/019sms\.co\.il\/api/);
  assert.doesNotMatch(liveMod, /isSmsRemindersEnvEnabled/);
  assert.match(liveMod, /useTestEndpoint:\s*false/);
  assert.match(liveMod, /recordAdminAuditEvent/);
}

console.log("test-sms019-reminders: OK");
