import { sendEmail as rawSendEmail, isEmailConfigured } from "./gmail.js";
import { supabaseRequest } from "./supabaseServer.js";
import {
  normalizeBookingEmail,
  validateBookingEmail,
} from "../src/lib/bookingEmailValidation.js";

export { STALE_EMAIL_CLAIM_MS, canClaimEmailDelivery, buildEmailClaimOrFilter } from "./emailClaim.js";
export const MAX_EMAIL_ATTEMPTS = 3;

const SUPPRESSION_TABLE_MISSING = /relation .*email_suppressions.* does not exist|Could not find the table/i;

function sanitizeErrorSummary(error) {
  const raw = String(error?.message || error || "email_send_failed");
  // Never log full recipient addresses from nodemailer response text.
  return raw
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .slice(0, 240);
}

/**
 * Classify SMTP/provider failures for retry policy.
 * Not every 5xx is a permanent recipient failure.
 */
export function classifyEmailSendError(error) {
  const message = String(error?.message || error || "");
  const responseCode = Number(error?.responseCode || error?.code || 0);
  const lower = message.toLowerCase();

  const permanentHints =
    /\b(550|551|552|553|554)\b/.test(message) ||
    lower.includes("user unknown") ||
    lower.includes("mailbox unavailable") ||
    lower.includes("recipient address rejected") ||
    lower.includes("invalid mailbox") ||
    lower.includes("no such user") ||
    lower.includes("address rejected");

  const temporaryHints =
    (responseCode >= 400 && responseCode < 500) ||
    /\b(421|450|451|452)\b/.test(message) ||
    lower.includes("try again") ||
    lower.includes("temporarily") ||
    lower.includes("rate limit") ||
    lower.includes("timeout") ||
    lower.includes("econnreset") ||
    lower.includes("etimedout");

  if (permanentHints && !temporaryHints) {
    return {
      kind: "permanent_failure",
      retryable: false,
      code: String(responseCode || "permanent"),
      summary: sanitizeErrorSummary(error),
    };
  }

  if (temporaryHints || (responseCode >= 400 && responseCode < 500)) {
    return {
      kind: "temporary_failure",
      retryable: true,
      code: String(responseCode || "temporary"),
      summary: sanitizeErrorSummary(error),
    };
  }

  // Unknown / transport errors: bounded retry.
  return {
    kind: "temporary_failure",
    retryable: true,
    code: String(responseCode || error?.code || "unknown"),
    summary: sanitizeErrorSummary(error),
  };
}

export async function isEmailSuppressed(email) {
  const { normalized, domain } = normalizeBookingEmail(email);
  if (!normalized || !domain) return false;
  const key = normalized.toLowerCase();
  try {
    const rows = await supabaseRequest(
      `email_suppressions?email_normalized=eq.${encodeURIComponent(key)}&cleared_at=is.null&select=email_normalized&limit=1`
    );
    return Array.isArray(rows) && rows.length > 0;
  } catch (error) {
    if (SUPPRESSION_TABLE_MISSING.test(String(error?.message || ""))) {
      return false;
    }
    throw error;
  }
}

export async function suppressEmailAddress(email, { reason = "permanent_failure", sourceAppointmentId = null } = {}) {
  const { normalized, domain } = normalizeBookingEmail(email);
  if (!normalized || !domain) return false;
  const key = normalized.toLowerCase();
  try {
    await supabaseRequest("email_suppressions", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({
        email_normalized: key,
        reason: String(reason || "permanent_failure").slice(0, 120),
        source_appointment_id: sourceAppointmentId || null,
        created_at: new Date().toISOString(),
        cleared_at: null,
      }),
    });
    return true;
  } catch (error) {
    if (SUPPRESSION_TABLE_MISSING.test(String(error?.message || ""))) {
      console.warn(
        "email_suppressions missing — run supabase/appointment-email-delivery.sql"
      );
      return false;
    }
    // Upsert fallback via PATCH if row exists
    try {
      await supabaseRequest(
        `email_suppressions?email_normalized=eq.${encodeURIComponent(key)}`,
        {
          method: "PATCH",
          headers: { Prefer: "return=minimal" },
          body: JSON.stringify({
            reason: String(reason || "permanent_failure").slice(0, 120),
            source_appointment_id: sourceAppointmentId || null,
            cleared_at: null,
          }),
        }
      );
      return true;
    } catch {
      console.error("email suppression write failed:", sanitizeErrorSummary(error));
      return false;
    }
  }
}

export async function clearEmailSuppression(email) {
  const { normalized, domain } = normalizeBookingEmail(email);
  if (!normalized || !domain) return false;
  const key = normalized.toLowerCase();
  try {
    await supabaseRequest(
      `email_suppressions?email_normalized=eq.${encodeURIComponent(key)}&cleared_at=is.null`,
      {
        method: "PATCH",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify({ cleared_at: new Date().toISOString() }),
      }
    );
    return true;
  } catch (error) {
    if (SUPPRESSION_TABLE_MISSING.test(String(error?.message || ""))) {
      return false;
    }
    console.error("clear email suppression failed:", sanitizeErrorSummary(error));
    return false;
  }
}

/**
 * Send mail with validation + suppression checks.
 * On SMTP accept → status "accepted" (not "delivered").
 */
export async function sendPatientEmail({
  to,
  subject,
  html,
  appointmentId = null,
  requireValid = true,
}) {
  if (!isEmailConfigured()) {
    return { ok: false, status: "cancelled", error: "email_not_configured" };
  }

  const validation = validateBookingEmail(to, { required: requireValid });
  if (!validation.ok || !validation.normalized) {
    return {
      ok: false,
      status: "cancelled",
      error: validation.error || "email_invalid",
    };
  }

  if (await isEmailSuppressed(validation.normalized)) {
    return { ok: false, status: "suppressed", error: "email_suppressed" };
  }

  try {
    await rawSendEmail({
      to: validation.normalized,
      subject,
      html,
    });
    return { ok: true, status: "accepted", to: validation.normalized };
  } catch (error) {
    const classified = classifyEmailSendError(error);
    if (classified.kind === "permanent_failure") {
      await suppressEmailAddress(validation.normalized, {
        reason: classified.summary,
        sourceAppointmentId: appointmentId,
      });
    }
    return {
      ok: false,
      status: classified.kind,
      retryable: classified.retryable,
      error: classified.summary,
      code: classified.code,
    };
  }
}

/** Asia/Jerusalem "now" as date+minutes for appointment start comparison. */
export function getJerusalemNowParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  const hour = parts.find((p) => p.type === "hour")?.value;
  const minute = parts.find((p) => p.type === "minute")?.value;
  const dateIso = `${year}-${month}-${day}`;
  const minutes = Number(hour) * 60 + Number(minute);
  return { dateIso, minutes };
}

export function parseAppointmentTimeMinutes(time) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(time || "").trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

/** Reminder eligibility: not cancelled, start still in the future (Asia/Jerusalem). */
export function isAppointmentReminderEligible(appointment, now = new Date()) {
  if (!appointment) return false;
  if (String(appointment.status || "") === "cancelled") return false;
  const date = String(appointment.date || "").trim();
  const timeMinutes = parseAppointmentTimeMinutes(appointment.time);
  if (!date || timeMinutes == null) return false;

  const { dateIso, minutes } = getJerusalemNowParts(now);
  if (date < dateIso) return false;
  if (date > dateIso) return true;
  return timeMinutes > minutes;
}

export function reminderOccurrenceKey(appointment) {
  return `reminder:${String(appointment?.date || "").trim()}`;
}
