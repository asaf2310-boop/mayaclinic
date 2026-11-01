/**
 * Phone OTP for customer self-service (019 SMS).
 * Codes are hashed at rest. Production never exposes codes or mock bypass.
 */

import crypto from "node:crypto";
import { normalizeIsraeliMobile } from "./israeliPhone.js";
import { isSms019Configured, sendSms019 } from "./sms019.js";
import { supabaseRequest } from "./supabaseServer.js";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LENGTH = 6;

/** Per phone: max OTP sends in a rolling window. */
export const OTP_PHONE_RATE_LIMIT = { max: 5, windowMs: 60 * 60 * 1000 };
/** Per IP: max OTP sends in a rolling window. */
export const OTP_IP_RATE_LIMIT = { max: 20, windowMs: 60 * 60 * 1000 };

function envFlagEnabled(name) {
  const raw = String(process.env[name] || "")
    .trim()
    .toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function isProductionRuntime() {
  const vercel = String(process.env.VERCEL_ENV || "").trim().toLowerCase();
  if (vercel === "production") return true;
  return String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";
}

/** Dev/test only — never honored in production. */
export function canBypassSelfServiceOtp() {
  if (isProductionRuntime()) return false;
  return envFlagEnabled("SELF_SERVICE_OTP_BYPASS");
}

function hashPepper() {
  return (
    String(process.env.SELF_SERVICE_OTP_PEPPER || "").trim() ||
    String(process.env.SELF_SERVICE_SESSION_SECRET || "").trim() ||
    String(process.env.ADMIN_SESSION_SECRET || "").trim() ||
    "self-service-otp-dev-pepper"
  );
}

export function hashOtpCode(code, phoneNormalized) {
  return crypto
    .createHmac("sha256", hashPepper())
    .update(`${phoneNormalized}:${String(code || "").trim()}`)
    .digest("hex");
}

export function generateOtpCode() {
  const max = 10 ** OTP_LENGTH;
  const n = crypto.randomInt(0, max);
  return String(n).padStart(OTP_LENGTH, "0");
}

export function hashIp(ip) {
  const value = String(ip || "").trim() || "unknown";
  return crypto.createHash("sha256").update(`${hashPepper()}:ip:${value}`).digest("hex").slice(0, 32);
}

function otpSmsMessage(code) {
  return `קוד האימות שלך לעדכון/ביטול תור: ${code}\nבתוקף ל-10 דקות. אל תשתפו את הקוד.`;
}

async function readRateLimit(rateKey) {
  try {
    const rows = await supabaseRequest(
      `appointment_otp_rate_limits?rate_key=eq.${encodeURIComponent(rateKey)}&select=*&limit=1`
    );
    return Array.isArray(rows) ? rows[0] || null : rows;
  } catch (error) {
    if (/appointment_otp_rate_limits|schema cache|does not exist/i.test(String(error?.message || ""))) {
      return null;
    }
    throw error;
  }
}

async function bumpRateLimit(rateKey, { max, windowMs }) {
  const now = Date.now();
  const existing = await readRateLimit(rateKey);

  if (existing) {
    const windowStart = new Date(existing.window_started_at).getTime();
    const inWindow = Number.isFinite(windowStart) && now - windowStart < windowMs;
    const count = inWindow ? Number(existing.request_count || 0) : 0;
    if (inWindow && count >= max) {
      const retryAfterSec = Math.max(1, Math.ceil((windowStart + windowMs - now) / 1000));
      return { allowed: false, retryAfterSec };
    }

    const next = {
      request_count: inWindow ? count + 1 : 1,
      window_started_at: inWindow ? existing.window_started_at : new Date(now).toISOString(),
      updated_at: new Date(now).toISOString(),
    };

    try {
      await supabaseRequest(
        `appointment_otp_rate_limits?rate_key=eq.${encodeURIComponent(rateKey)}`,
        { method: "PATCH", body: JSON.stringify(next) }
      );
    } catch (error) {
      if (!/appointment_otp_rate_limits|schema cache|does not exist/i.test(String(error?.message || ""))) {
        throw error;
      }
    }
    return { allowed: true, retryAfterSec: 0 };
  }

  try {
    await supabaseRequest("appointment_otp_rate_limits", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        rate_key: rateKey,
        request_count: 1,
        window_started_at: new Date(now).toISOString(),
        updated_at: new Date(now).toISOString(),
      }),
    });
  } catch (error) {
    if (!/appointment_otp_rate_limits|schema cache|does not exist/i.test(String(error?.message || ""))) {
      throw error;
    }
  }
  return { allowed: true, retryAfterSec: 0 };
}

async function latestChallenge(tenantId, phoneNormalized) {
  try {
    const rows = await supabaseRequest(
      `appointment_otp_challenges?tenant_id=eq.${encodeURIComponent(tenantId)}` +
        `&phone_normalized=eq.${encodeURIComponent(phoneNormalized)}` +
        `&order=created_at.desc&limit=1&select=*`
    );
    return Array.isArray(rows) ? rows[0] || null : null;
  } catch (error) {
    if (/appointment_otp_challenges|schema cache|does not exist/i.test(String(error?.message || ""))) {
      const err = new Error("otp_storage_missing");
      err.code = "otp_storage_missing";
      throw err;
    }
    throw error;
  }
}

/**
 * Request / resend OTP. Always returns a generic client message on success paths
 * that do not leak whether the phone has appointments.
 */
export async function requestAppointmentOtp({
  phone,
  tenantId = "maya",
  requestIp = "",
  fetchImpl = fetch,
} = {}) {
  const normalized = normalizeIsraeliMobile(phone);
  // Generic response even for invalid phones (anti-enumeration) — but still reject clearly invalid.
  if (!normalized.ok) {
    return {
      ok: false,
      error: "invalid_phone",
      message: "נא להזין מספר נייד ישראלי תקין",
    };
  }

  const phoneNormalized = normalized.normalized;
  const ipHash = hashIp(requestIp);

  const phoneRate = await bumpRateLimit(`phone:${tenantId}:${phoneNormalized}`, OTP_PHONE_RATE_LIMIT);
  if (!phoneRate.allowed) {
    return {
      ok: false,
      error: "rate_limited",
      message: "נשלחו יותר מדי בקשות. נסו שוב מאוחר יותר.",
      retryAfterSec: phoneRate.retryAfterSec,
    };
  }

  const ipRate = await bumpRateLimit(`ip:${tenantId}:${ipHash}`, OTP_IP_RATE_LIMIT);
  if (!ipRate.allowed) {
    return {
      ok: false,
      error: "rate_limited",
      message: "נשלחו יותר מדי בקשות. נסו שוב מאוחר יותר.",
      retryAfterSec: ipRate.retryAfterSec,
    };
  }

  const existing = await latestChallenge(tenantId, phoneNormalized);
  const now = Date.now();
  if (existing?.resend_available_at) {
    const resendAt = new Date(existing.resend_available_at).getTime();
    if (Number.isFinite(resendAt) && resendAt > now && !existing.verified_at) {
      return {
        ok: false,
        error: "resend_cooldown",
        message: "ניתן לבקש קוד חדש בעוד מספר שניות",
        retryAfterSec: Math.max(1, Math.ceil((resendAt - now) / 1000)),
      };
    }
  }

  const code = generateOtpCode();
  const codeHash = hashOtpCode(code, phoneNormalized);
  const expiresAt = new Date(now + OTP_TTL_MS).toISOString();
  const resendAvailableAt = new Date(now + OTP_RESEND_COOLDOWN_MS).toISOString();

  try {
    await supabaseRequest("appointment_otp_challenges", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({
        tenant_id: tenantId,
        phone_normalized: phoneNormalized,
        code_hash: codeHash,
        expires_at: expiresAt,
        attempts: 0,
        max_attempts: OTP_MAX_ATTEMPTS,
        resend_available_at: resendAvailableAt,
        request_ip_hash: ipHash,
      }),
    });
  } catch (error) {
    if (/appointment_otp_challenges|schema cache|does not exist/i.test(String(error?.message || ""))) {
      return {
        ok: false,
        error: "otp_storage_missing",
        message: "שירות האימות אינו מוכן. יש להריץ את מיגרציית customer-self-service.sql",
      };
    }
    throw error;
  }

  const bypass = canBypassSelfServiceOtp();
  let smsSent = false;
  let smsError = null;

  if (!isSms019Configured()) {
    smsError = "sms019_not_configured";
    console.warn(
      "[self-service-otp] SMS019 not configured. Set SMS019_USERNAME, SMS019_API_TOKEN, SMS019_SENDER."
    );
    if (!bypass) {
      return {
        ok: false,
        error: "sms_not_configured",
        message: "שירות שליחת הקוד אינו זמין כרגע. צרו קשר עם בית העסק.",
      };
    }
  } else {
    const smsResult = await sendSms019({
      phone: phoneNormalized,
      message: otpSmsMessage(code),
      externalId: `otp-${phoneNormalized.slice(-4)}-${now}`,
      campaignName: "self-service-otp",
      fetchImpl,
    });
    smsSent = Boolean(smsResult?.ok);
    if (!smsResult?.ok) {
      smsError = smsResult?.error || "sms_send_failed";
      console.error("[self-service-otp] SMS send failed:", smsError);
      if (!bypass) {
        return {
          ok: false,
          error: "sms_send_failed",
          message: "לא ניתן לשלוח קוד כרגע. נסו שוב בעוד דקה.",
        };
      }
    }
  }

  const generic = {
    ok: true,
    message: "אם קיים תור למספר זה, נשלח קוד אימות ב-SMS",
    expiresInSec: Math.floor(OTP_TTL_MS / 1000),
    resendAfterSec: Math.floor(OTP_RESEND_COOLDOWN_MS / 1000),
  };

  // Never include OTP in production. Bypass only outside production.
  if (bypass) {
    return {
      ...generic,
      bypass: true,
      debugCode: code,
      smsSent,
      smsError,
    };
  }

  void smsSent;
  void smsError;
  return generic;
}

export async function verifyAppointmentOtp({
  phone,
  code,
  tenantId = "maya",
} = {}) {
  const normalized = normalizeIsraeliMobile(phone);
  if (!normalized.ok) {
    return { ok: false, error: "invalid_phone", message: "נא להזין מספר נייד ישראלי תקין" };
  }

  const phoneNormalized = normalized.normalized;
  const codeStr = String(code || "").replace(/\D/g, "");
  if (codeStr.length !== OTP_LENGTH) {
    return { ok: false, error: "invalid_code", message: "קוד האימות שגוי או שפג תוקפו" };
  }

  const challenge = await latestChallenge(tenantId, phoneNormalized);
  if (!challenge) {
    return { ok: false, error: "invalid_code", message: "קוד האימות שגוי או שפג תוקפו" };
  }

  if (challenge.verified_at) {
    return { ok: false, error: "already_used", message: "קוד האימות כבר נוצל. בקשו קוד חדש." };
  }

  const expiresAt = new Date(challenge.expires_at).getTime();
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
    return { ok: false, error: "expired", message: "קוד האימות שגוי או שפג תוקפו" };
  }

  const attempts = Number(challenge.attempts || 0);
  const maxAttempts = Number(challenge.max_attempts || OTP_MAX_ATTEMPTS);
  if (attempts >= maxAttempts) {
    return { ok: false, error: "too_many_attempts", message: "יותר מדי ניסיונות. בקשו קוד חדש." };
  }

  const expectedHash = hashOtpCode(codeStr, phoneNormalized);
  const expectedBuf = Buffer.from(expectedHash);
  const actualBuf = Buffer.from(String(challenge.code_hash || ""));
  const match =
    expectedBuf.length === actualBuf.length &&
    crypto.timingSafeEqual(expectedBuf, actualBuf);

  if (!match) {
    try {
      await supabaseRequest(
        `appointment_otp_challenges?id=eq.${encodeURIComponent(challenge.id)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ attempts: attempts + 1 }),
        }
      );
    } catch (error) {
      console.warn("[self-service-otp] attempt bump failed:", error?.message || error);
    }
    return { ok: false, error: "invalid_code", message: "קוד האימות שגוי או שפג תוקפו" };
  }

  try {
    await supabaseRequest(
      `appointment_otp_challenges?id=eq.${encodeURIComponent(challenge.id)}`,
      {
        method: "PATCH",
        body: JSON.stringify({ verified_at: new Date().toISOString() }),
      }
    );
  } catch (error) {
    console.warn("[self-service-otp] mark verified failed:", error?.message || error);
  }

  return { ok: true, phoneNormalized };
}
