/**
 * Appointment SMS helpers (settings, templates, eligibility, admin test, history).
 * Delivery claim/outcome lives in supabaseServer.js (mirrors email reminders).
 */

import {
  isAppointmentReminderEligible,
  isReminderIneligibilityTerminal,
} from "./emailDelivery.js";
import { getAllowedAdminEmails } from "./googleAdminAuth.js";
import { normalizeIsraeliMobile } from "./israeliPhone.js";
import {
  isSms019Configured,
  isSmsBookingConfirmEnvEnabled,
  isSmsRemindersEnvEnabled,
  isSmsTechTestEnvEnabled,
  sendSms019,
} from "./sms019.js";
import {
  DEFAULT_CLINIC_ADDRESS,
  DEFAULT_CONFIRM_SMS_TEMPLATE,
  DEFAULT_REMINDER_SMS_TEMPLATE,
  SMS_TEMPLATE_VARS,
  buildClinicMapsUrl,
  estimateSmsSegments,
  maskIsraeliPhone,
  renderSmsTemplate,
  validateSmsTemplate,
} from "./smsTemplates.js";
import {
  claimSmsConfirmSend,
  markSmsConfirmOutcome,
  supabaseRequest,
} from "./supabaseServer.js";

export const DEFAULT_SMS_LEAD_HOURS = 24;
export const MAX_SMS_ATTEMPTS = 1;
export const SMS_CLINIC_PHONE = "0549000301";

export {
  DEFAULT_CLINIC_ADDRESS,
  DEFAULT_CONFIRM_SMS_TEMPLATE,
  DEFAULT_REMINDER_SMS_TEMPLATE,
  SMS_TEMPLATE_VARS,
  buildClinicMapsUrl,
  estimateSmsSegments,
  maskIsraeliPhone,
  renderSmsTemplate,
  validateSmsTemplate,
};

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

function renderWithFormats(template, vars = {}) {
  return renderSmsTemplate(template, vars, {
    formatDate: formatHebrewAppointmentDate,
    formatTime: formatAppointmentTimeForSms,
  });
}

/**
 * Default reminder — no treatment/price/medical details.
 * Uses template variables when a custom template is not provided.
 */
export function buildAppointmentReminderSms({
  patientName,
  date,
  time,
  clinicPhone = SMS_CLINIC_PHONE,
  clinicAddress = DEFAULT_CLINIC_ADDRESS,
  template = null,
} = {}) {
  const tpl =
    template != null && String(template).trim()
      ? String(template)
      : DEFAULT_REMINDER_SMS_TEMPLATE;
  const rendered = renderWithFormats(tpl, {
    patientName,
    date,
    time,
    clinicAddress,
  });
  if (rendered.ok) return rendered.message;

  // Fallback if a corrupt stored template slips through — keep legacy shape.
  const name = String(patientName || "").trim() || "לקוח/ה";
  const dateLabel = formatHebrewAppointmentDate(date);
  const timeLabel = formatAppointmentTimeForSms(time);
  const phone = String(clinicPhone || SMS_CLINIC_PHONE).trim() || SMS_CLINIC_PHONE;
  const address = String(clinicAddress || "").trim() || DEFAULT_CLINIC_ADDRESS;
  return (
    `שלום ${name}, תזכורת לתור שלך ב־OfirBaby בתאריך ${dateLabel} בשעה ${timeLabel}.\n\n` +
    `📍 כתובת: ${address}\n\n` +
    `לשינוי או ביטול התור: ${phone}.\n\nנתראה בקרוב!`
  );
}

export function buildAppointmentConfirmSms({
  patientName,
  date,
  time,
  clinicAddress = DEFAULT_CLINIC_ADDRESS,
  template = null,
} = {}) {
  const tpl =
    template != null && String(template).trim()
      ? String(template)
      : DEFAULT_CONFIRM_SMS_TEMPLATE;
  const rendered = renderWithFormats(tpl, {
    patientName,
    date,
    time,
    clinicAddress,
  });
  if (rendered.ok) return rendered.message;

  const name = String(patientName || "").trim() || "לקוח/ה";
  const dateLabel = formatHebrewAppointmentDate(date);
  const timeLabel = formatAppointmentTimeForSms(time);
  const address = String(clinicAddress || "").trim() || DEFAULT_CLINIC_ADDRESS;
  return (
    `שלום ${name}, התור שלך ב־OfirBaby נקבע בהצלחה ל־${dateLabel} בשעה ${timeLabel}.\n\n` +
    `📍 כתובת: ${address}\n\n` +
    `לשינוי או ביטול: ${SMS_CLINIC_PHONE}.\n\nנתראה בקרוב!`
  );
}

export function previewSmsTemplate(kind, template, sample = {}) {
  const defaults = {
    patientName: sample.patientName || "ישראל ישראלי",
    date: sample.date || "2026-10-20",
    time: sample.time || "10:30",
    clinicAddress: sample.clinicAddress || DEFAULT_CLINIC_ADDRESS,
  };
  const tpl =
    template != null && String(template).trim()
      ? String(template)
      : kind === "confirm"
        ? DEFAULT_CONFIRM_SMS_TEMPLATE
        : DEFAULT_REMINDER_SMS_TEMPLATE;
  const rendered = renderWithFormats(tpl, defaults);
  if (!rendered.ok) {
    return {
      ok: false,
      error: rendered.error,
      unsupported: rendered.unsupported || [],
      estimate: estimateSmsSegments(""),
      message: "",
    };
  }
  return {
    ok: true,
    message: rendered.message,
    estimate: rendered.estimate,
  };
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
    booking_confirm_enabled: false,
    lead_hours: DEFAULT_SMS_LEAD_HOURS,
    clinic_address: DEFAULT_CLINIC_ADDRESS,
    confirm_template: DEFAULT_CONFIRM_SMS_TEMPLATE,
    reminder_template: DEFAULT_REMINDER_SMS_TEMPLATE,
    updated_at: null,
  };
}

function normalizeClinicAddress(value, fallback = DEFAULT_CLINIC_ADDRESS) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function normalizeStoredTemplate(value, fallback) {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function mapSettingsRow(row, id) {
  return {
    tenant_id: row.tenant_id || id,
    enabled: Boolean(row.enabled),
    booking_confirm_enabled: Boolean(row.booking_confirm_enabled),
    lead_hours: normalizeSmsLeadHours(row.lead_hours),
    clinic_address: normalizeClinicAddress(row.clinic_address),
    confirm_template: normalizeStoredTemplate(
      row.confirm_template,
      DEFAULT_CONFIRM_SMS_TEMPLATE
    ),
    reminder_template: normalizeStoredTemplate(
      row.reminder_template,
      DEFAULT_REMINDER_SMS_TEMPLATE
    ),
    updated_at: row.updated_at || null,
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
    return mapSettingsRow(row, id);
  } catch (error) {
    const message = String(error?.message || error || "");
    if (/sms_reminder_settings|Could not find the table|relation/i.test(message)) {
      return { ...getDefaultSmsReminderSettings(), tenant_id: id, migrationMissing: true };
    }
    // Older migration without template columns — degrade with defaults.
    if (/confirm_template|reminder_template|clinic_address|booking_confirm_enabled/i.test(message)) {
      try {
        const rows = await supabaseRequest(
          `sms_reminder_settings?tenant_id=eq.${encodeURIComponent(id)}&select=tenant_id,enabled,lead_hours,updated_at&limit=1`
        );
        const row = Array.isArray(rows) && rows[0] ? rows[0] : null;
        if (!row) return { ...getDefaultSmsReminderSettings(), tenant_id: id };
        return {
          ...getDefaultSmsReminderSettings(),
          ...mapSettingsRow(
            { ...row, booking_confirm_enabled: false },
            id
          ),
          templatesMigrationMissing: true,
        };
      } catch {
        return {
          ...getDefaultSmsReminderSettings(),
          tenant_id: id,
          templatesMigrationMissing: true,
        };
      }
    }
    throw error;
  }
}

export async function upsertSmsReminderSettings(tenantId, patch = {}) {
  const id = String(tenantId || "maya").trim() || "maya";
  const current = await fetchSmsReminderSettings(id);

  if (Object.prototype.hasOwnProperty.call(patch, "confirm_template")) {
    const check = validateSmsTemplate(patch.confirm_template);
    if (!check.ok) {
      const err = new Error(check.error || "invalid_confirm_template");
      err.code = check.error;
      err.unsupported = check.unsupported;
      throw err;
    }
  }
  if (Object.prototype.hasOwnProperty.call(patch, "reminder_template")) {
    const check = validateSmsTemplate(patch.reminder_template);
    if (!check.ok) {
      const err = new Error(check.error || "invalid_reminder_template");
      err.code = check.error;
      err.unsupported = check.unsupported;
      throw err;
    }
  }

  const next = {
    tenant_id: id,
    enabled: Object.prototype.hasOwnProperty.call(patch, "enabled")
      ? Boolean(patch.enabled)
      : Boolean(current.enabled),
    booking_confirm_enabled: Object.prototype.hasOwnProperty.call(
      patch,
      "booking_confirm_enabled"
    )
      ? Boolean(patch.booking_confirm_enabled)
      : Boolean(current.booking_confirm_enabled),
    lead_hours: Object.prototype.hasOwnProperty.call(patch, "lead_hours")
      ? normalizeSmsLeadHours(patch.lead_hours)
      : normalizeSmsLeadHours(current.lead_hours),
    clinic_address: Object.prototype.hasOwnProperty.call(patch, "clinic_address")
      ? normalizeClinicAddress(patch.clinic_address)
      : normalizeClinicAddress(current.clinic_address),
    confirm_template: Object.prototype.hasOwnProperty.call(patch, "confirm_template")
      ? String(patch.confirm_template)
      : normalizeStoredTemplate(current.confirm_template, DEFAULT_CONFIRM_SMS_TEMPLATE),
    reminder_template: Object.prototype.hasOwnProperty.call(patch, "reminder_template")
      ? String(patch.reminder_template)
      : normalizeStoredTemplate(current.reminder_template, DEFAULT_REMINDER_SMS_TEMPLATE),
    updated_at: new Date().toISOString(),
  };

  try {
    const rows = await supabaseRequest(`sms_reminder_settings?on_conflict=tenant_id`, {
      method: "POST",
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
      body: JSON.stringify(next),
    });
    const row = Array.isArray(rows) && rows[0] ? rows[0] : next;
    return mapSettingsRow(row, id);
  } catch (error) {
    const message = String(error?.message || error || "");
    // Pre-templates migration: persist core toggles only.
    if (/confirm_template|reminder_template|clinic_address|booking_confirm_enabled/i.test(message)) {
      const legacy = {
        tenant_id: id,
        enabled: next.enabled,
        lead_hours: next.lead_hours,
        updated_at: next.updated_at,
      };
      const rows = await supabaseRequest(`sms_reminder_settings?on_conflict=tenant_id`, {
        method: "POST",
        headers: {
          Prefer: "resolution=merge-duplicates,return=representation",
        },
        body: JSON.stringify(legacy),
      });
      const row = Array.isArray(rows) && rows[0] ? rows[0] : legacy;
      return {
        ...mapSettingsRow({ ...next, ...row }, id),
        templatesMigrationMissing: true,
      };
    }
    throw error;
  }
}

/**
 * Live reminder automation requires BOTH the env kill-switch and the admin DB toggle.
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

/**
 * Booking-confirm SMS requires SMS_BOOKING_CONFIRM_ENABLED + admin toggle + provider.
 * Independent of SMS_REMINDERS_ENABLED.
 */
export function canSendLiveSmsBookingConfirm(settings) {
  return (
    isSmsBookingConfirmEnvEnabled() &&
    isSms019Configured() &&
    Boolean(settings?.booking_confirm_enabled) &&
    !settings?.migrationMissing
  );
}

export function describeSmsAutomationGate(settings) {
  return {
    envEnabled: isSmsRemindersEnvEnabled(),
    bookingConfirmEnvEnabled: isSmsBookingConfirmEnvEnabled(),
    providerConfigured: isSms019Configured(),
    adminEnabled: Boolean(settings?.enabled),
    bookingConfirmAdminEnabled: Boolean(settings?.booking_confirm_enabled),
    migrationMissing: Boolean(settings?.migrationMissing),
    templatesMigrationMissing: Boolean(settings?.templatesMigrationMissing),
    liveAllowed: canSendLiveSmsReminders(settings),
    bookingConfirmLiveAllowed: canSendLiveSmsBookingConfirm(settings),
    techTestAllowed: false,
  };
}

/**
 * Technical SMS test endpoints. Defaults false for clinic admins.
 * Requires SMS_TECH_TEST_ENABLED=true and email in SMS_TECH_ADMIN_EMAILS
 * (or a narrow subset of ADMIN_EMAILS when that env is unset).
 */
export function getTechnicalAdminEmails() {
  const raw = String(process.env.SMS_TECH_ADMIN_EMAILS || "").trim();
  if (raw) {
    return [
      ...new Set(
        raw
          .split(",")
          .map((part) => part.trim().toLowerCase())
          .filter(Boolean)
      ),
    ];
  }
  // Narrow default: only asaf2310 when listed among admins — never all ADMIN_EMAILS.
  const admins = new Set(getAllowedAdminEmails());
  return ["asaf2310@gmail.com"].filter((email) => admins.has(email));
}

export function isAllowedTechnicalAdmin(email) {
  if (!isSmsTechTestEnvEnabled()) return false;
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized) return false;
  return getTechnicalAdminEmails().includes(normalized);
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

function clientHistoryStatus(raw) {
  const status = String(raw || "");
  switch (status) {
    case "accepted":
      return "accepted";
    case "delivered":
      return "delivered";
    case "pending":
    case "sending":
      return "pending";
    case "permanent_failure":
    case "invalid_phone":
    case "cancelled":
      return "failed";
    case "temporary_failure":
      return "unknown";
    default:
      return status ? "unknown" : "pending";
  }
}

/**
 * Client-facing history: appointment date, type, masked phone, timestamp, status.
 * No provider tokens / shipment ids.
 */
export async function fetchRecentSmsReminderHistory({ limit = 50, tenantId = "maya" } = {}) {
  const take = Math.min(100, Math.max(1, Number(limit) || 50));
  const id = String(tenantId || "maya").trim() || "maya";
  const select =
    "id,patient_name,patient_phone,date,time,status," +
    "reminder_sms_status,reminder_sms_sent_at,reminder_sms_last_error," +
    "confirm_sms_status,confirm_sms_sent_at,confirm_sms_last_error";

  let rows = [];
  try {
    rows =
      (await supabaseRequest(
        `appointments?tenant_id=eq.${encodeURIComponent(id)}` +
          `&or=(reminder_sms_status.not.is.null,confirm_sms_status.not.is.null)` +
          `&select=${select}` +
          `&order=date.desc` +
          `&limit=${Math.min(200, take * 3)}`
      )) || [];
  } catch (error) {
    const message = String(error?.message || error || "");
    if (/confirm_sms_/i.test(message)) {
      try {
        rows =
          (await supabaseRequest(
            `appointments?tenant_id=eq.${encodeURIComponent(id)}` +
              `&reminder_sms_status=not.is.null` +
              `&select=id,patient_name,patient_phone,date,time,status,reminder_sms_status,reminder_sms_sent_at,reminder_sms_last_error` +
              `&order=reminder_sms_sent_at.desc.nullslast,date.desc` +
              `&limit=${take}`
          )) || [];
      } catch (inner) {
        if (/reminder_sms_/i.test(String(inner?.message || "")) || /column/i.test(String(inner?.message || ""))) {
          return [];
        }
        throw inner;
      }
    } else if (/reminder_sms_/i.test(message) || /column/i.test(message)) {
      return [];
    } else {
      throw error;
    }
  }

  const entries = [];
  for (const row of rows) {
    if (row.confirm_sms_status) {
      entries.push({
        id: `${row.id}:confirm`,
        appointment_id: row.id,
        type: "confirm",
        type_label: "אישור קביעת תור",
        patient_name: row.patient_name,
        patient_phone_masked: maskIsraeliPhone(row.patient_phone),
        date: row.date,
        time: row.time,
        timestamp: row.confirm_sms_sent_at || null,
        status: clientHistoryStatus(row.confirm_sms_status),
        provider_status: row.confirm_sms_status,
      });
    }
    if (row.reminder_sms_status) {
      entries.push({
        id: `${row.id}:reminder`,
        appointment_id: row.id,
        type: "reminder",
        type_label: "תזכורת יום לפני",
        patient_name: row.patient_name,
        patient_phone_masked: maskIsraeliPhone(row.patient_phone),
        date: row.date,
        time: row.time,
        timestamp: row.reminder_sms_sent_at || null,
        status: clientHistoryStatus(row.reminder_sms_status),
        provider_status: row.reminder_sms_status,
      });
    }
  }

  entries.sort((a, b) => {
    const ta = a.timestamp ? Date.parse(a.timestamp) : 0;
    const tb = b.timestamp ? Date.parse(b.timestamp) : 0;
    if (tb !== ta) return tb - ta;
    return String(b.date || "").localeCompare(String(a.date || ""));
  });

  return entries.slice(0, take);
}

/**
 * After successful appointment persistence only. Idempotent via claimSmsConfirmSend.
 * Never throws to caller — booking must not fail on SMS errors.
 */
export async function maybeSendBookingConfirmSms(appointments, { fetchImpl = fetch } = {}) {
  if (!appointments?.length) {
    return { ok: true, skipped: true, reason: "no_appointments", sent: 0 };
  }

  let settings;
  try {
    settings = await fetchSmsReminderSettings(appointments[0]?.tenant_id || "maya");
  } catch (error) {
    console.error(
      "booking confirm SMS settings failed:",
      String(error?.message || error).slice(0, 200)
    );
    return { ok: false, skipped: true, reason: "settings_error", sent: 0 };
  }

  if (!canSendLiveSmsBookingConfirm(settings)) {
    return {
      ok: true,
      skipped: true,
      reason: "booking_confirm_disabled",
      gate: {
        envEnabled: isSmsBookingConfirmEnvEnabled(),
        adminEnabled: Boolean(settings?.booking_confirm_enabled),
        providerConfigured: isSms019Configured(),
      },
      sent: 0,
    };
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const appointment of appointments) {
    if (!appointment?.id) {
      skipped += 1;
      continue;
    }

    let claimed = null;
    let providerAccepted = false;
    let shipmentId = null;
    let attempts = 0;

    try {
      claimed = await claimSmsConfirmSend(appointment.id);
      if (!claimed) {
        skipped += 1;
        continue;
      }

      attempts = Number(claimed.confirm_sms_attempts || 0);
      const phoneCheck = normalizeIsraeliMobile(claimed.patient_phone);
      if (!phoneCheck.ok) {
        await markSmsConfirmOutcome(claimed.id, {
          status: "invalid_phone",
          error: phoneCheck.error,
          attempts: attempts + 1,
        });
        skipped += 1;
        continue;
      }

      const message = buildAppointmentConfirmSms({
        patientName: claimed.patient_name,
        date: claimed.date,
        time: claimed.time,
        clinicAddress: settings.clinic_address,
        template: settings.confirm_template,
      });

      const result = await sendSms019({
        phone: phoneCheck.normalized,
        message,
        externalId: `confirm-${claimed.id}`,
        useTestEndpoint: false,
        campaignName: "appointment-confirm",
        fetchImpl,
      });

      const nextAttempts = attempts + 1;
      if (result.ok && result.accepted) {
        providerAccepted = true;
        shipmentId = result.shipmentId || null;
        await markSmsConfirmOutcome(claimed.id, {
          status: "accepted",
          attempts: nextAttempts,
          error: null,
          shipmentId,
        });
        sent += 1;
        continue;
      }

      await markSmsConfirmOutcome(claimed.id, {
        status: "permanent_failure",
        attempts: nextAttempts,
        error: result.error || result.message || "sms_send_failed",
        shipmentId: result.shipmentId || null,
      });
      failed += 1;
    } catch (error) {
      failed += 1;
      console.error(
        "booking confirm SMS failed:",
        String(error?.message || error).slice(0, 200)
      );
      if (claimed?.id) {
        try {
          if (providerAccepted) {
            await markSmsConfirmOutcome(claimed.id, {
              status: "accepted",
              attempts: attempts + 1,
              error: "outcome_write_failed_after_accept",
              shipmentId,
            });
          } else {
            await markSmsConfirmOutcome(claimed.id, {
              status: "temporary_failure",
              attempts: attempts + 1,
              error: "send_interrupted_no_retry",
            });
          }
        } catch {
          // Leave claim for stale reclaim only if still sending.
        }
      }
    }
  }

  return { ok: true, sent, skippedCount: skipped, failed, total: appointments.length };
}
