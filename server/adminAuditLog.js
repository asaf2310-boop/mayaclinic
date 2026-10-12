/**
 * Lightweight admin audit logging.
 * No dedicated audit table exists yet — write structured server logs (Vercel)
 * and keep a small in-memory ring for same-instance introspection.
 * Never log API tokens, passwords, or full Authorization headers.
 */

const MAX_EVENTS = 100;
const recentEvents = [];

function sanitizeDetail(value) {
  if (value == null) return value;
  if (typeof value === "string") {
    return value
      .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
      .replace(/SMS019_API_TOKEN\s*=\s*\S+/gi, "SMS019_API_TOKEN=[redacted]")
      .slice(0, 500);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 20).map(sanitizeDetail);
  }
  if (typeof value === "object") {
    const out = {};
    for (const [key, nested] of Object.entries(value)) {
      const lower = String(key).toLowerCase();
      if (
        lower.includes("token") ||
        lower.includes("password") ||
        lower.includes("secret") ||
        lower.includes("authorization")
      ) {
        out[key] = "[redacted]";
        continue;
      }
      out[key] = sanitizeDetail(nested);
    }
    return out;
  }
  return value;
}

/**
 * @param {{
 *   action: string,
 *   actorEmail?: string | null,
 *   actorMethod?: string | null,
 *   tenantId?: string | null,
 *   ok?: boolean,
 *   detail?: Record<string, unknown>,
 * }} event
 */
export function recordAdminAuditEvent(event = {}) {
  const entry = {
    at: new Date().toISOString(),
    action: String(event.action || "unknown").slice(0, 80),
    actorEmail: event.actorEmail ? String(event.actorEmail).slice(0, 120) : null,
    actorMethod: event.actorMethod ? String(event.actorMethod).slice(0, 40) : null,
    tenantId: event.tenantId ? String(event.tenantId).slice(0, 40) : null,
    ok: Boolean(event.ok),
    detail: sanitizeDetail(event.detail || {}),
  };

  recentEvents.push(entry);
  if (recentEvents.length > MAX_EVENTS) {
    recentEvents.shift();
  }

  // Structured log for Vercel / ops — never includes tokens after sanitizeDetail.
  console.info("[admin-audit]", JSON.stringify(entry));
  return entry;
}

/** Same-instance recent events (best-effort on serverless). */
export function getRecentAdminAuditEvents({ limit = 20 } = {}) {
  const take = Math.min(MAX_EVENTS, Math.max(1, Number(limit) || 20));
  return recentEvents.slice(-take).reverse();
}
