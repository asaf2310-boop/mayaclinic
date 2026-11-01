/**
 * Signed self-service session after phone OTP verification.
 * Phone alone never grants access — callers must present this token.
 */

import crypto from "node:crypto";

const DEFAULT_TTL_SEC = 30 * 60; // 30 minutes

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function base64UrlDecode(value) {
  const normalized = String(value || "")
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(String(value || "").length / 4) * 4, "=");
  return Buffer.from(normalized, "base64").toString("utf8");
}

function getSessionSecret() {
  const explicit = String(process.env.SELF_SERVICE_SESSION_SECRET || "").trim();
  if (explicit) return explicit;

  const fallback = [
    process.env.ADMIN_SESSION_SECRET,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    process.env.CRON_SECRET,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("|");

  if (!fallback) {
    throw new Error("Missing SELF_SERVICE_SESSION_SECRET (and no secure fallback)");
  }
  return fallback;
}

function sign(payload) {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

function timingSafeEqualStr(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

/**
 * @returns {string} token
 */
export function createSelfServiceSessionToken({
  phoneNormalized,
  tenantId = "maya",
  ttlSeconds = DEFAULT_TTL_SEC,
} = {}) {
  const phone = String(phoneNormalized || "").trim();
  if (!phone) throw new Error("phone_required");

  const ttl = Number(ttlSeconds);
  const lifetimeSec = Number.isFinite(ttl) ? ttl : DEFAULT_TTL_SEC;
  const payload = JSON.stringify({
    v: 1,
    phone,
    tenant: String(tenantId || "maya"),
    exp: Math.floor(Date.now() / 1000) + lifetimeSec,
  });
  const encoded = base64UrlEncode(payload);
  return `${encoded}.${sign(encoded)}`;
}

/**
 * @returns {{ ok: true, phoneNormalized: string, tenantId: string, exp: number } | { ok: false, error: string }}
 */
export function verifySelfServiceSessionToken(token, { tenantId = "" } = {}) {
  const raw = String(token || "").trim();
  if (!raw.includes(".")) return { ok: false, error: "invalid_session" };

  const [encoded, signature] = raw.split(".", 2);
  if (!encoded || !signature) return { ok: false, error: "invalid_session" };

  let expected;
  try {
    expected = sign(encoded);
  } catch {
    return { ok: false, error: "session_misconfigured" };
  }

  if (!timingSafeEqualStr(expected, signature)) {
    return { ok: false, error: "invalid_session" };
  }

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encoded));
  } catch {
    return { ok: false, error: "invalid_session" };
  }

  const phone = String(payload?.phone || "").trim();
  const tenant = String(payload?.tenant || "").trim();
  const exp = Number(payload?.exp || 0);
  if (!phone || !tenant) return { ok: false, error: "invalid_session" };
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
    return { ok: false, error: "session_expired" };
  }

  if (tenantId && tenant !== String(tenantId)) {
    return { ok: false, error: "invalid_session" };
  }

  return { ok: true, phoneNormalized: phone, tenantId: tenant, exp };
}
