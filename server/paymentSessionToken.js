import crypto from "node:crypto";

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
  const explicit = String(process.env.PELECARD_SESSION_SECRET || "").trim();
  if (explicit) return explicit;

  const fallback = [
    process.env.PELECARD_PASSWORD,
    process.env.PELECARD_USER,
    process.env.PELECARD_TERMINAL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("|");

  if (!fallback) {
    throw new Error("Missing PELECARD_SESSION_SECRET (and no secure fallback secret available)");
  }
  return fallback;
}

function sign(payload) {
  return crypto.createHmac("sha256", getSessionSecret()).update(payload).digest("base64url");
}

export function createPaymentSessionToken(bookingRef, ttlSeconds = 60 * 60 * 6) {
  const payload = JSON.stringify({
    ref: String(bookingRef || "").trim(),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  });
  const encoded = base64UrlEncode(payload);
  return `${encoded}.${sign(encoded)}`;
}

export function verifyPaymentSessionToken(bookingRef, token) {
  const raw = String(token || "").trim();
  if (!raw.includes(".")) return false;

  const [encoded, signature] = raw.split(".", 2);
  if (!encoded || !signature) return false;

  const expected = sign(encoded);
  const expectedBuf = Buffer.from(expected);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;
  if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) return false;

  let payload = null;
  try {
    payload = JSON.parse(base64UrlDecode(encoded));
  } catch {
    return false;
  }

  const ref = String(payload?.ref || "").trim();
  const exp = Number(payload?.exp || 0);
  if (!ref || ref !== String(bookingRef || "").trim()) return false;
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  return true;
}
