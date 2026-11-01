/**
 * Official 019 SMS API client (server-side only).
 * Docs: https://docs.019sms.co.il/sms/
 *       https://docs.019sms.co.il/sms/send-sms.html
 *
 * Never log tokens/usernames. Credentials stay in process.env.
 */

import { normalizeIsraeliMobile } from "./israeliPhone.js";

const LIVE_ENDPOINT = "https://019sms.co.il/api";
const TEST_ENDPOINT = "https://019sms.co.il/api/test";
const DEFAULT_SENDER = "0549000301";
const MAX_MESSAGE_CHARS = 1005;

function cleanEnv(value) {
  return String(value || "")
    .split(/\s+/)
    .map((part) => part.trim())
    .find(Boolean) || "";
}

function envFlagEnabled(name) {
  const raw = cleanEnv(process.env[name]).toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

/** True when ops explicitly enabled live SMS reminder automation via env. Defaults false. */
export function isSmsRemindersEnvEnabled() {
  return envFlagEnabled("SMS_REMINDERS_ENABLED");
}

/**
 * True when ops enabled booking-confirmation SMS automation via env. Defaults false.
 * Independent of SMS_REMINDERS_ENABLED — both require admin toggle + credentials.
 */
export function isSmsBookingConfirmEnvEnabled() {
  return envFlagEnabled("SMS_BOOKING_CONFIRM_ENABLED");
}

/**
 * Technical live/test SMS UI endpoints. Defaults false — clinic admins cannot use
 * sms-test / sms-live-test until ops sets SMS_TECH_TEST_ENABLED=true.
 */
export function isSmsTechTestEnvEnabled() {
  return envFlagEnabled("SMS_TECH_TEST_ENABLED");
}

/**
 * Transactional SMS after appointment reschedule/cancel (admin or self-service).
 * Independent of SMS_REMINDERS_ENABLED and SMS_BOOKING_CONFIRM_ENABLED.
 * Defaults ON when unset (like OTP delivery). Set SMS_CHANGE_NOTIFY_ENABLED=false to kill.
 * Still requires SMS019_* credentials.
 */
export function isSmsChangeNotifyEnvEnabled() {
  const raw = cleanEnv(process.env.SMS_CHANGE_NOTIFY_ENABLED).toLowerCase();
  if (!raw) return true;
  if (raw === "0" || raw === "false" || raw === "no" || raw === "off") return false;
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function canSendSmsChangeNotify() {
  return isSms019Configured() && isSmsChangeNotifyEnvEnabled();
}

export function getSms019Config() {
  const username = cleanEnv(process.env.SMS019_USERNAME);
  const apiToken = cleanEnv(process.env.SMS019_API_TOKEN);
  const source = cleanEnv(process.env.SMS019_SENDER) || DEFAULT_SENDER;
  return { username, apiToken, source };
}

export function isSms019Configured() {
  const { username, apiToken, source } = getSms019Config();
  return Boolean(username && apiToken && source);
}

/**
 * Build the documented JSON `sms` body for a single destination.
 * Phone id attribute preserves our external id for later DLR lookup.
 */
export function buildSms019Payload({
  username,
  source,
  phone,
  message,
  externalId = "",
  campaignName = "appointment-reminder",
} = {}) {
  const phoneNode = externalId
    ? { $: { id: String(externalId).slice(0, 64) }, _: phone }
    : { _: phone };

  return {
    sms: {
      user: { username },
      source: String(source).slice(0, 11),
      destinations: {
        phone: [phoneNode],
      },
      message: String(message || "").slice(0, MAX_MESSAGE_CHARS),
      campaign_name: String(campaignName || "appointment-reminder").slice(0, 50),
    },
  };
}

function sanitizeProviderMessage(value) {
  return String(value || "")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted]")
    .slice(0, 240);
}

/**
 * Parse 019 JSON/XML-ish JSON response.
 * status === 0 means accepted by provider (not confirmed delivered).
 */
export function interpretSms019Response(body, httpStatus) {
  const status = Number(body?.status);
  const message = sanitizeProviderMessage(body?.message || "");
  const shipmentId =
    body?.shipment_id != null && String(body.shipment_id).trim()
      ? String(body.shipment_id).trim()
      : null;

  if (httpStatus >= 200 && httpStatus < 300 && status === 0) {
    return {
      ok: true,
      accepted: true,
      status,
      message: message || "accepted",
      shipmentId,
      retryable: false,
    };
  }

  // Definitive provider rejection — do not auto-retry (avoids duplicates).
  if (Number.isFinite(status) && status !== 0) {
    return {
      ok: false,
      accepted: false,
      status,
      message: message || `provider_status_${status}`,
      shipmentId,
      retryable: false,
      error: message || `provider_status_${status}`,
    };
  }

  return {
    ok: false,
    accepted: false,
    status: Number.isFinite(status) ? status : null,
    message: message || `http_${httpStatus}`,
    shipmentId,
    retryable: httpStatus >= 500 || httpStatus === 0,
    error: message || `http_${httpStatus}`,
  };
}

/**
 * Send (or validate via /api/test) one SMS.
 * @param {{ phone: string, message: string, externalId?: string, useTestEndpoint?: boolean, fetchImpl?: typeof fetch }} opts
 */
export async function sendSms019(opts = {}) {
  const {
    phone,
    message,
    externalId = "",
    useTestEndpoint = false,
    campaignName = "appointment-reminder",
    fetchImpl = fetch,
  } = opts;

  if (!isSms019Configured()) {
    return {
      ok: false,
      accepted: false,
      error: "sms019_not_configured",
      retryable: false,
    };
  }

  const normalized = normalizeIsraeliMobile(phone);
  if (!normalized.ok) {
    return {
      ok: false,
      accepted: false,
      error: normalized.error,
      retryable: false,
    };
  }

  const text = String(message || "").trim();
  if (!text) {
    return { ok: false, accepted: false, error: "empty_message", retryable: false };
  }

  const { username, apiToken, source } = getSms019Config();
  const payload = buildSms019Payload({
    username,
    source,
    phone: normalized.apiPhone,
    message: text,
    externalId,
    campaignName,
  });

  const endpoint = useTestEndpoint ? TEST_ENDPOINT : LIVE_ENDPOINT;

  let response;
  try {
    response = await fetchImpl(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    return {
      ok: false,
      accepted: false,
      error: sanitizeProviderMessage(error?.message || "network_error"),
      retryable: true,
      networkError: true,
    };
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  const interpreted = interpretSms019Response(body, response.status);
  return {
    ...interpreted,
    phone: normalized.normalized,
    usedTestEndpoint: useTestEndpoint,
  };
}
