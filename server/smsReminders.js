/**
 * Appointment SMS reminder helpers (message copy, settings, eligibility).
 * Delivery claim/outcome lives in supabaseServer.js (mirrors email reminders).
 */

import {
  isAppointmentReminderEligible,
  isReminderIneligibilityTerminal,
} from "./emailDelivery.js";
import { normalizeIsraeliMobile } from "./israeliPhone.js";
import {
  isSms019Configured,
  isSmsRemindersEnvEnabled,
  sendSms019,
} from "./sms019.js";
import { supabaseRequest } from "./supabaseServer.js";

export const DEFAULT_SMS_LEAD_HOURS = 24;
export const MAX_SMS_ATTEMPTS = 1;
export const SMS_CLINIC_PHONE = "0549000301";

export function formatHebrewAppointmentDate(isoDate = "") {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(isoDate).trim());
  if (!match) return String(isoDate || "").trim();
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatAppointmentTimeForSms(time = "") {
  const raw = String(time || "").trim();
  const match = /^(\d{1,2}):(\d{2})/.exec(raw);
  if (!match) return raw;
  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

/**
 * Default reminder — no treatment/price/medical details.
 * שלום [שם], תזכורת לתור שלך ב-OfirBaby בתאריך [תאריך] בשעה [שעה]. לשינוי או ביטול התור: 0549000301. נתראה בקרוב!
 */
export function buildAppointmentReminderSms({
  patientName,
  date,
  time,
  clinicPhone = SMS_CLINIC_PHONE,
} = {}) {
  const name = String(patientName || "").trim() || "לקוח/ה";
  const dateLabel = formatHebrewAppointmentDate(date);
  const timeLabel = formatAppointmentTimeForSms(time);
  const phone = String(clinicPhone || SMS_CLINIC_PHONE).trim() || SMS_CLINIC_PHONE;
  return (
    `שלום ${name}, תזכורת לתור שלך ב-OfirBaby בתאריך ${dateLabel} בשעה ${timeLabel}. ` +
    `לשינוי או ביטול התור: ${phone}. נתראה בקרוב!`
  );
}

export function isSmsReminderAppointmentEligible(appointment, now = new Date()) {
  if (!appointment) return false;
  const status = String(appointment.status || "");
  if (status === "cancelled" || status === "completed") return false;
  if (!normalizeIsraeliMobile(appointment.patient_phone).ok) return false;
  return isAppointmentReminderEligible(appointment, now);
}

export function isSmsReminderIneligibilityTerminal(appointment, now = new Date()) {
  if (!appointment) return true;
  const status = String(appointment.status || "");
  if (status === "cancelled" || status === "completed") return true;
  return isReminderIneligibilityTerminal(appointment, now);
}

export function normalizeSmsLeadHours(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SMS_LEAD_HOURS;
  // Clamp to 1–72 hours; cron uses calendar-day targeting from this.
  return Math.min(72, Math.max(1, Math.round(n)));
}

export function leadHoursToTargetDays(leadHours = DEFAULT_SMS_LEAD_HOURS) {
  return Math.max(1, Math.round(normalizeSmsLeadHours(leadHours) / 24));
}

/** Jerusalem calendar date that is `daysAhead` days from "today". */
export function getReminderTargetDateIso(leadHours = DEFAULT_SMS_LEAD_HOURS, now = new Date()) {
  const daysAhead = leadHoursToTargetDays(leadHours);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const target = new Date(Date.UTC(year, month - 1, day + daysAhead));
  return target.toISOString().slice(0, 10);
}

export function getDefaultSmsReminderSettings() {
  return {
    tenant_id: "maya",
    enabled: false,
    lead_hours: DEFAULT_SMS_LEAD_HOURS,
    updated_at: null,
  };
}

export async function fetchSmsReminderSettings(tenantId = "maya") {
  const id = String(tenantId || "maya").trim() || "maya";
  try {
    const rows = await supabaseRequest(
      `sms_reminder_settings?tenant_id=eq.${encodeURIComponent(id)}&select=*&limit=1`
    );
    const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
    if (!row) {
      return { ...getDefaultSmsReminderSettings(), tenant_id: id };
    }
    return {
      tenant_id: row.tenant_id || id,
      enabled: Boolean(row.enabled),
      lead_hours: normalizeSmsLeadHours(row.lead_hours),
      updated_at: row.updated_at || null,
    };
  } catch (error) {
    const message = String(error?.message || error || "");
    if (/sms_reminder_settings|Could not find the table|relation/i.test(message)) {
      return { ...getDefaultSmsReminderSettings(), tenant_id: id, migrationMissing: true };
    }
    throw error;
  }
}

export async function upsertSmsReminderSettings(tenantId, patch = {}) {
  const id = String(tenantId || "maya").trim() || "maya";
  const current = await fetchSmsReminderSettings(id);
  const next = {
    tenant_id: id,
    enabled:
      Object.prototype.hasOwnProperty.call(patch, "enabled")
        ? Boolean(patch.enabled)
        : Boolean(current.enabled),
    lead_hours: Object.prototype.hasOwnProperty.call(patch, "lead_hours")
      ? normalizeSmsLeadHours(patch.lead_hours)
      : normalizeSmsLeadHours(current.lead_hours),
    updated_at: new Date().toISOString(),
  };

  const rows = await supabaseRequest(`sms_reminder_settings?on_conflict=tenant_id`, {
    method: "POST",
    headers: {
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify(next),
  });
  const row = Array.isArray(rows) && rows[0] ? rows[0] : next;
  return {
    tenant_id: row.tenant_id || id,
    enabled: Boolean(row.enabled),
    lead_hours: normalizeSmsLeadHours(row.lead_hours),
    updated_at: row.updated_at || next.updated_at,
  };
}

/**
 * Live automation requires BOTH the env kill-switch and the admin DB toggle.
 * Ops must set SMS_REMINDERS_ENABLED=true on Vercel; admin can then enable in UI.
 */
export function canSendLiveSmsReminders(settings) {
  return (
    isSmsRemindersEnvEnabled() &&
    isSms019Configured() &&
    Boolean(settings?.enabled) &&
    !settings?.migrationMissing
  );
}

export function describeSmsAutomationGate(settings) {
  return {
    envEnabled: isSmsRemindersEnvEnabled(),
    providerConfigured: isSms019Configured(),
    adminEnabled: Boolean(settings?.enabled),
    migrationMissing: Boolean(settings?.migrationMissing),
    liveAllowed: canSendLiveSmsReminders(settings),
  };
}

/**
 * Admin-safe test: prefers /api/test. Live send only when env gate is on and
 * caller explicitly requests live + confirms.
 */
export async function sendAdminTestSms({
  phone,
  message,
  confirm = false,
  useLive = false,
  fetchImpl = fetch,
} = {}) {
  if (!confirm) {
    return { ok: false, error: "confirm_required", sentLive: false };
  }

  const normalized = normalizeIsraeliMobile(phone);
  if (!normalized.ok) {
    return { ok: false, error: normalized.error, sentLive: false };
  }

  if (!isSms019Configured()) {
    return { ok: false, error: "sms019_not_configured", sentLive: false };
  }

  const wantLive = Boolean(useLive) && isSmsRemindersEnvEnabled();
  const text =
    String(message || "").trim() ||
    `בדיקת SMS מ-OfirBaby. מספר זה משמש לתזכורות תורים. לבירורים: ${SMS_CLINIC_PHONE}`;

  const result = await sendSms019({
    phone: normalized.normalized,
    message: text,
    externalId: `admin-test-${Date.now()}`,
    useTestEndpoint: !wantLive,
    campaignName: wantLive ? "admin-test-live" : "admin-test",
    fetchImpl,
  });

  return {
    ...result,
    sentLive: wantLive && Boolean(result.accepted),
    usedTestEndpoint: !wantLive,
    phone: normalized.normalized,
  };
}

export async function fetchRecentSmsReminderHistory({ limit = 50, tenantId = "maya" } = {}) {
  const take = Math.min(100, Math.max(1, Number(limit) || 50));
  const path =
    `appointments?tenant_id=eq.${encodeURIComponent(tenantId)}` +
    `&reminder_sms_status=not.is.null` +
    `&select=id,patient_name,patient_phone,date,time,status,reminder_sms_status,reminder_sms_last_error,reminder_sms_sent_at,reminder_sms_shipment_id,reminder_sms_attempts` +
    `&order=reminder_sms_sent_at.desc.nullslast,date.desc` +
    `&limit=${take}`;
  try {
    return (await supabaseRequest(path)) || [];
  } catch (error) {
    const message = String(error?.message || error || "");
    if (/reminder_sms_/i.test(message) || /column/i.test(message)) {
      return [];
    }
    throw error;
  }
}
