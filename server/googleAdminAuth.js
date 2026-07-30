import crypto from "node:crypto";

const DEFAULT_ADMIN_EMAILS = ["ofirbabyinfo@gmail.com", "asaf2310@gmail.com"];

function getSecret() {
  const explicit = String(process.env.ADMIN_SESSION_SECRET || "").trim();
  if (explicit) return explicit;

  const fallback = [
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.ADMIN_ACCESS_PASSWORD,
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

export function getAllowedAdminEmails() {
  const raw = String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "").trim();
  const emails = (raw || DEFAULT_ADMIN_EMAILS.join(","))
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(emails)];
}

export function isAllowedAdminEmail(email) {
  return getAllowedAdminEmails().includes(String(email || "").trim().toLowerCase());
}

export function isGoogleAdminAuthConfigured() {
  return Boolean(
    String(process.env.GOOGLE_CLIENT_ID || "").trim() &&
      String(process.env.GOOGLE_CLIENT_SECRET || "").trim()
  );
}

export function getPublicOrigin(req) {
  const fromEnv = String(
    process.env.PUBLIC_ORIGIN || process.env.PELECARD_PUBLIC_ORIGIN || ""
  ).trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const proto = String(req?.headers?.["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = String(
    req?.headers?.["x-forwarded-host"] || req?.headers?.host || "localhost"
  )
    .split(",")[0]
    .trim();
  return `${proto}://${host}`.replace(/\/$/, "");
}

export function getGoogleCallbackUrl(req) {
  return `${getPublicOrigin(req)}/api/admin-google-callback`;
}

export function createOAuthState() {
  const payload = JSON.stringify({
    nonce: crypto.randomBytes(16).toString("base64url"),
    exp: Math.floor(Date.now() / 1000) + 60 * 10,
  });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyOAuthState(state) {
  const value = String(state || "");
  if (!value.includes(".")) return false;
  const [encoded, signature] = value.split(".", 2);
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return Number(payload?.exp || 0) > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function buildGoogleAuthUrl(req) {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) throw new Error("Missing GOOGLE_CLIENT_ID");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getGoogleCallbackUrl(req),
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
    state: createOAuthState(),
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(req, code) {
  const clientId = String(process.env.GOOGLE_CLIENT_ID || "").trim();
  const clientSecret = String(process.env.GOOGLE_CLIENT_SECRET || "").trim();
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured");
  }

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: String(code || ""),
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getGoogleCallbackUrl(req),
      grant_type: "authorization_code",
    }),
  });

  const tokenData = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenData?.access_token) {
    throw new Error(tokenData?.error_description || tokenData?.error || "Google token exchange failed");
  }

  const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });
  const profile = await profileResponse.json().catch(() => ({}));
  if (!profileResponse.ok || !profile?.email) {
    throw new Error(profile?.error?.message || "Failed to load Google profile");
  }

  return {
    email: String(profile.email).trim().toLowerCase(),
    name: String(profile.name || "").trim(),
    picture: String(profile.picture || "").trim(),
    emailVerified: Boolean(profile.verified_email),
  };
}
