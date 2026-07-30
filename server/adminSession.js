import crypto from "node:crypto";
import { getAllowedAdminEmails, isGoogleAdminAuthConfigured } from "./googleAdminAuth.js";

const ADMIN_COOKIE = "admin_session";

function getSecret() {
  const explicit = String(process.env.ADMIN_SESSION_SECRET || "").trim();
  if (explicit) return explicit;

  const fallback = [
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.ADMIN_ACCESS_PASSWORD,
    process.env.PELECARD_PASSWORD,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("|");

  if (!fallback) {
    throw new Error("Missing ADMIN_SESSION_SECRET (and no secure fallback available)");
  }
  return fallback;
}

function sign(value) {
  return crypto.createHmac("sha256", getSecret()).update(value).digest("base64url");
}

function parseCookies(req) {
  const raw = String(req?.headers?.cookie || "");
  return Object.fromEntries(
    raw
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const eq = part.indexOf("=");
        return eq === -1 ? [part, ""] : [part.slice(0, eq), decodeURIComponent(part.slice(eq + 1))];
      })
  );
}

export function isAdminPasswordConfigured() {
  return [
    process.env.ADMIN_ACCESS_PASSWORD,
    process.env.ADMIN_ACCESS_PASSWORD_2,
  ]
    .map((part) => String(part || "").trim())
    .some(Boolean);
}

export function isAdminPasswordValid(password) {
  const candidates = [
    process.env.ADMIN_ACCESS_PASSWORD,
    process.env.ADMIN_ACCESS_PASSWORD_2,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  return candidates.includes(String(password || "").trim());
}

function createCookieValue({ email = null, method = "password" } = {}) {
  const payload = JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
    email: email ? String(email).trim().toLowerCase() : null,
    method,
  });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function getAdminSession(req) {
  const value = parseCookies(req)[ADMIN_COOKIE];
  if (!value || !value.includes(".")) return null;

  const [encoded, signature] = value.split(".", 2);
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return null;
  if (!crypto.timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (Number(payload?.exp || 0) <= Math.floor(Date.now() / 1000)) return null;
    return {
      email: payload?.email ? String(payload.email).toLowerCase() : null,
      method: payload?.method || "password",
    };
  } catch {
    return null;
  }
}

export function hasAdminSession(req) {
  return Boolean(getAdminSession(req));
}

export function getAdminAuthOptions() {
  return {
    googleConfigured: isGoogleAdminAuthConfigured(),
    passwordConfigured: isAdminPasswordConfigured(),
    allowedEmails: getAllowedAdminEmails(),
  };
}

export function setAdminSessionCookie(res, { email = null, method = "password" } = {}) {
  const cookie = [
    `${ADMIN_COOKIE}=${createCookieValue({ email, method })}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    "Max-Age=43200",
  ].join("; ");
  res.setHeader("Set-Cookie", cookie);
}

export function clearAdminSessionCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=0`
  );
}
