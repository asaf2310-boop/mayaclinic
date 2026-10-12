/**
 * Safe one-shot LIVE SMS test for authenticated admin.
 * Does NOT require SMS_REMINDERS_ENABLED (automation stays off).
 * Hard allowlist + confirm + single-flight/cooldown only.
 */

import { normalizeIsraeliMobile } from "./israeliPhone.js";
import { getSms019Config, isSms019Configured, sendSms019 } from "./sms019.js";
import { recordAdminAuditEvent } from "./adminAuditLog.js";

/** Only this recipient may receive a live admin test SMS. */
export const LIVE_SMS_TEST_ALLOWED_RECIPIENTS = Object.freeze(["0502677765"]);

/** Exact body for the live connectivity check (do not change without ops approval). */
export const LIVE_SMS_TEST_MESSAGE =
  "בדיקת SMS ממערכת OfirBaby. אם קיבלת הודעה זו, שירות התזכורות פועל בהצלחה.";

const COOLDOWN_MS = 60 * 1000;

/** @type {{ inFlight: boolean, lastStartedAt: number, lastFinishedAt: number }} */
const liveTestGate = {
  inFlight: false,
  lastStartedAt: 0,
  lastFinishedAt: 0,
};

export function getLiveSmsTestCooldownMs() {
  return COOLDOWN_MS;
}

export function resetLiveSmsTestGateForTests() {
  liveTestGate.inFlight = false;
  liveTestGate.lastStartedAt = 0;
  liveTestGate.lastFinishedAt = 0;
}

export function isAllowedLiveSmsTestRecipient(phone) {
  const normalized = normalizeIsraeliMobile(phone);
  if (!normalized.ok) return false;
  return LIVE_SMS_TEST_ALLOWED_RECIPIENTS.includes(normalized.normalized);
}

function acquireLiveTestSlot(now = Date.now()) {
  if (liveTestGate.inFlight) {
    return {
      ok: false,
      error: "live_test_in_flight",
      message: "שליחת בדיקה חיה כבר בתהליך — המתינו לסיום",
      retryAfterSec: Math.max(
        1,
        Math.ceil((COOLDOWN_MS - (now - liveTestGate.lastStartedAt)) / 1000)
      ),
    };
  }

  const sinceFinish = now - liveTestGate.lastFinishedAt;
  if (liveTestGate.lastFinishedAt > 0 && sinceFinish < COOLDOWN_MS) {
    const retryAfterSec = Math.ceil((COOLDOWN_MS - sinceFinish) / 1000);
    return {
      ok: false,
      error: "live_test_cooldown",
      message: `יש להמתין ${retryAfterSec} שניות בין בדיקות חיות`,
      retryAfterSec,
    };
  }

  liveTestGate.inFlight = true;
  liveTestGate.lastStartedAt = now;
  return { ok: true };
}

function releaseLiveTestSlot({ success } = {}) {
  liveTestGate.inFlight = false;
  liveTestGate.lastFinishedAt = Date.now();
  if (!success && liveTestGate.lastFinishedAt - liveTestGate.lastStartedAt < 2000) {
    // Keep cooldown even on fast failures to blunt double-clicks / retries.
  }
}

/**
 * Preview payload for the admin confirmation UI (no network).
 */
export function getLiveSmsTestPreview() {
  const { source } = getSms019Config();
  return {
    phone: LIVE_SMS_TEST_ALLOWED_RECIPIENTS[0],
    message: LIVE_SMS_TEST_MESSAGE,
    sender: source || "0549000301",
    endpoint: "https://019sms.co.il/api",
    providerConfigured: isSms019Configured(),
  };
}

/**
 * Send exactly one live SMS to the allowlisted test number.
 * Requires confirm=true. Does not check SMS_REMINDERS_ENABLED.
 */
export async function sendAdminLiveTestSms({
  confirm = false,
  phone,
  fetchImpl = fetch,
  actorEmail = null,
  actorMethod = null,
  tenantId = null,
} = {}) {
  const preview = getLiveSmsTestPreview();

  if (!confirm) {
    const denied = {
      ok: false,
      error: "confirm_required",
      message: "יש לאשר במפורש לפני שליחת SMS חי לבדיקה",
      sentLive: false,
      preview,
    };
    recordAdminAuditEvent({
      action: "sms_live_test_denied",
      actorEmail,
      actorMethod,
      tenantId,
      ok: false,
      detail: { reason: "confirm_required" },
    });
    return denied;
  }

  if (!isSms019Configured()) {
    const denied = {
      ok: false,
      error: "sms019_not_configured",
      message: "פרטי 019 חסרים בשרת — לא ניתן לשלוח SMS חי",
      sentLive: false,
      preview,
    };
    recordAdminAuditEvent({
      action: "sms_live_test_denied",
      actorEmail,
      actorMethod,
      tenantId,
      ok: false,
      detail: { reason: "sms019_not_configured" },
    });
    return denied;
  }

  const requested = phone != null && String(phone).trim() !== "" ? phone : preview.phone;
  const normalized = normalizeIsraeliMobile(requested);
  if (!normalized.ok) {
    const denied = {
      ok: false,
      error: normalized.error,
      message: "מספר יעד לא תקין",
      sentLive: false,
      preview,
    };
    recordAdminAuditEvent({
      action: "sms_live_test_denied",
      actorEmail,
      actorMethod,
      tenantId,
      ok: false,
      detail: { reason: normalized.error },
    });
    return denied;
  }

  if (!LIVE_SMS_TEST_ALLOWED_RECIPIENTS.includes(normalized.normalized)) {
    const denied = {
      ok: false,
      error: "recipient_not_allowlisted",
      message: "מספר היעד אינו ברשימת המספרים המורשים לבדיקה חיה",
      sentLive: false,
      preview,
      phone: normalized.normalized,
    };
    recordAdminAuditEvent({
      action: "sms_live_test_denied",
      actorEmail,
      actorMethod,
      tenantId,
      ok: false,
      detail: { reason: "recipient_not_allowlisted", phone: normalized.normalized },
    });
    return denied;
  }

  const slot = acquireLiveTestSlot();
  if (!slot.ok) {
    recordAdminAuditEvent({
      action: "sms_live_test_denied",
      actorEmail,
      actorMethod,
      tenantId,
      ok: false,
      detail: { reason: slot.error, retryAfterSec: slot.retryAfterSec },
    });
    return {
      ...slot,
      sentLive: false,
      preview,
    };
  }

  recordAdminAuditEvent({
    action: "sms_live_test_attempt",
    actorEmail,
    actorMethod,
    tenantId,
    ok: true,
    detail: {
      phone: normalized.normalized,
      sender: preview.sender,
      endpoint: preview.endpoint,
      messageChars: LIVE_SMS_TEST_MESSAGE.length,
    },
  });

  try {
    const result = await sendSms019({
      phone: normalized.normalized,
      message: LIVE_SMS_TEST_MESSAGE,
      externalId: `admin-live-test-${Date.now()}`,
      useTestEndpoint: false,
      campaignName: "admin-live-test",
      fetchImpl,
    });

    const accepted = Boolean(result.accepted);
    const response = {
      ok: Boolean(result.ok),
      accepted,
      sentLive: accepted,
      usedTestEndpoint: false,
      phone: normalized.normalized,
      sender: preview.sender,
      message: LIVE_SMS_TEST_MESSAGE,
      status: result.status ?? null,
      shipmentId: result.shipmentId || null,
      providerMessage: result.message || null,
      error: result.error || null,
      retryable: Boolean(result.retryable),
      note: accepted
        ? "הספק קיבל את ההודעה (status 0) — קבלה ≠ מסירה לטלפון. בדקו שההודעה הגיעה בפועל."
        : "שליחה חיה נכשלה או לא התקבלה אצל הספק",
      preview,
    };

    recordAdminAuditEvent({
      action: "sms_live_test_result",
      actorEmail,
      actorMethod,
      tenantId,
      ok: accepted,
      detail: {
        phone: normalized.normalized,
        accepted,
        status: result.status ?? null,
        shipmentId: result.shipmentId || null,
        providerMessage: result.message || null,
        error: result.error || null,
      },
    });

    releaseLiveTestSlot({ success: accepted });
    return response;
  } catch (error) {
    releaseLiveTestSlot({ success: false });
    const message = String(error?.message || error || "live_test_failed").slice(0, 240);
    recordAdminAuditEvent({
      action: "sms_live_test_result",
      actorEmail,
      actorMethod,
      tenantId,
      ok: false,
      detail: { phone: normalized.normalized, error: message },
    });
    return {
      ok: false,
      accepted: false,
      sentLive: false,
      usedTestEndpoint: false,
      phone: normalized.normalized,
      error: message,
      note: "שליחה חיה נכשלה",
      preview,
    };
  }
}
