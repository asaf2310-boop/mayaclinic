/**
 * Shared customer + clinic emails and customer SMS after appointment
 * reschedule / cancel (admin UI or self-service).
 *
 * Runs after DB commit. Failures are logged; booking state stays correct.
 * Idempotent via appointment_change_events claim columns when present.
 *
 * SMS is transactional: requires SMS019_* credentials and SMS_CHANGE_NOTIFY_ENABLED
 * (defaults ON when unset). Does NOT use SMS_REMINDERS_ENABLED / booking-confirm gates.
 */

import {
  buildCustomerCancellationEmail,
  buildCustomerRescheduleEmail,
  buildClinicRescheduleNotifyEmail,
  buildClinicCancellationNotifyEmail,
} from "./emailTemplates.js";
import { getBookingNotifyEmails } from "./bookingNotify.js";
import { getClinicName, isEmailConfigured, sendEmail } from "./gmail.js";
import { canClaimEmailDelivery, buildEmailClaimOrFilter } from "./emailClaim.js";
import { canSendSmsChangeNotify, sendSms019 } from "./sms019.js";
import { normalizeIsraeliMobile } from "./israeliPhone.js";
import {
  DEFAULT_CANCEL_SMS_TEMPLATE,
  DEFAULT_RESCHEDULE_SMS_TEMPLATE,
  renderSmsTemplate,
} from "./smsTemplates.js";
import { formatAppointmentTimeForSms, formatHebrewAppointmentDate } from "./smsReminders.js";
import { supabaseRequest } from "./supabaseServer.js";

function formatSmsDate(date) {
  return formatHebrewAppointmentDate(date);
}

function formatSmsTime(time) {
  return formatAppointmentTimeForSms(time);
}

export function buildAppointmentChangeSms({
  eventType,
  patientName,
  date,
  time,
} = {}) {
  const template =
    eventType === "cancel" ? DEFAULT_CANCEL_SMS_TEMPLATE : DEFAULT_RESCHEDULE_SMS_TEMPLATE;
  const rendered = renderSmsTemplate(
    template,
    { patientName, date, time },
    { formatDate: formatSmsDate, formatTime: formatSmsTime }
  );
  if (rendered.ok) return rendered.message;

  const name = String(patientName || "").trim() || "לקוח/ה";
  const dateLabel = formatSmsDate(date);
  const timeLabel = formatSmsTime(time);
  if (eventType === "cancel") {
    return `שלום ${name}, התור שלך בתאריך ${dateLabel} בשעה ${timeLabel} בוטל. לתיאום מחדש: 0549000301`;
  }
  return `שלום ${name}, התור שלך עודכן ל־${dateLabel} בשעה ${timeLabel}. לשינוי או ביטול: 0549000301`;
}

async function claimEventChannel(eventId, kind) {
  if (!eventId) return true;

  const cols =
    kind === "customer"
      ? {
          status: "customer_email_status",
          claimed: "customer_email_claimed_at",
        }
      : kind === "clinic"
        ? {
            status: "clinic_email_status",
            claimed: "clinic_email_claimed_at",
          }
        : {
            status: "customer_sms_status",
            claimed: "customer_sms_claimed_at",
          };

  const now = new Date();
  const orFilter = buildEmailClaimOrFilter(cols.status, cols.claimed, now);

  try {
    const rows = await supabaseRequest(
      `appointment_change_events?id=eq.${encodeURIComponent(eventId)}&${orFilter}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          [cols.status]: "sending",
          [cols.claimed]: now.toISOString(),
        }),
      }
    );
    const row = Array.isArray(rows) ? rows[0] : rows;
    return Boolean(row);
  } catch (error) {
    console.warn("[appointment-change-notify] claim failed:", error?.message || error);
    return true;
  }
}

async function markEventChannel(eventId, kind, { status, error = null } = {}) {
  if (!eventId) return;

  const cols =
    kind === "customer"
      ? {
          status: "customer_email_status",
          claimed: "customer_email_claimed_at",
          sent: "customer_email_sent_at",
          err: "customer_email_last_error",
        }
      : kind === "clinic"
        ? {
            status: "clinic_email_status",
            claimed: "clinic_email_claimed_at",
            sent: "clinic_email_sent_at",
            err: "clinic_email_last_error",
          }
        : {
            status: "customer_sms_status",
            claimed: "customer_sms_claimed_at",
            sent: "customer_sms_sent_at",
            err: "customer_sms_last_error",
          };

  const patch = {
    [cols.status]: status,
    [cols.claimed]: null,
  };
  if (status === "sent" || status === "accepted") patch[cols.sent] = new Date().toISOString();
  if (error) patch[cols.err] = String(error).slice(0, 240);

  try {
    await supabaseRequest(`appointment_change_events?id=eq.${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  } catch (err) {
    console.warn("[appointment-change-notify] mark failed:", err?.message || err);
  }
}

function resolveCancelActionLabel({ actor, reason }) {
  if (reason === "deleted") return "נמחק";
  if (actor === "admin") return "בוטל";
  return "בוטל ע״י הלקוח";
}

/**
 * Insert audit + notify claim row. Returns null when table/migration missing.
 */
export async function recordAppointmentChangeEvent({
  appointmentId,
  tenantId,
  eventType,
  actor = "customer",
  phoneNormalized = null,
  beforeSnapshot = null,
  afterSnapshot = null,
} = {}) {
  if (!appointmentId || !eventType) return null;
  try {
    const rows = await supabaseRequest("appointment_change_events", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        appointment_id: appointmentId,
        tenant_id: tenantId || null,
        event_type: eventType,
        actor: actor === "admin" ? "admin" : "customer",
        phone_normalized: phoneNormalized || null,
        before_snapshot: beforeSnapshot,
        after_snapshot: afterSnapshot,
        customer_email_status: "pending",
        clinic_email_status: "pending",
        customer_sms_status: "pending",
      }),
    });
    return Array.isArray(rows) ? rows[0] : rows;
  } catch (error) {
    // Retry without SMS claim columns (pre-migration DBs).
    const message = String(error?.message || error || "");
    if (/customer_sms_/i.test(message) || (/column/i.test(message) && /sms/i.test(message))) {
      try {
        const rows = await supabaseRequest("appointment_change_events", {
          method: "POST",
          headers: { Prefer: "return=representation" },
          body: JSON.stringify({
            appointment_id: appointmentId,
            tenant_id: tenantId || null,
            event_type: eventType,
            actor: actor === "admin" ? "admin" : "customer",
            phone_normalized: phoneNormalized || null,
            before_snapshot: beforeSnapshot,
            after_snapshot: afterSnapshot,
            customer_email_status: "pending",
            clinic_email_status: "pending",
          }),
        });
        return Array.isArray(rows) ? rows[0] : rows;
      } catch (retryError) {
        console.warn(
          "[appointment-change-notify] change event insert failed:",
          retryError?.message || retryError
        );
        return null;
      }
    }
    console.warn(
      "[appointment-change-notify] change event insert failed (run customer-self-service.sql):",
      error?.message || error
    );
    return null;
  }
}

/**
 * @param {{
 *   event?: object | null,
 *   eventType: 'reschedule' | 'cancel',
 *   appointment: object,
 *   previous?: object,
 *   actor?: 'customer' | 'admin',
 *   reason?: string,
 *   extraNote?: string,
 * }} args
 */
export async function notifyAppointmentChange({
  event = null,
  eventType,
  appointment,
  previous = null,
  actor = "customer",
  reason = "cancelled",
  extraNote = "",
} = {}) {
  if (!appointment) {
    return { skipped: true, reason: "no_appointment" };
  }

  const clinicName = getClinicName();
  const eventId = event?.id || null;
  const results = { customer: null, clinic: null, sms: null };
  const actorKey = actor === "admin" ? "admin" : "customer";

  // --- Customer email ---
  if (isEmailConfigured()) {
    const patientEmail = String(
      appointment.patient_email || previous?.patient_email || ""
    ).trim();
    if (patientEmail) {
      const claimable =
        !event ||
        canClaimEmailDelivery({
          status: event.customer_email_status,
          claimedAt: event.customer_email_claimed_at,
          sentAt: event.customer_email_sent_at,
        });

      if (claimable && (await claimEventChannel(eventId, "customer"))) {
        try {
          const built =
            eventType === "cancel"
              ? buildCustomerCancellationEmail({
                  patientName: appointment.patient_name || previous?.patient_name,
                  appointment,
                  clinicName,
                })
              : buildCustomerRescheduleEmail({
                  patientName: appointment.patient_name || previous?.patient_name,
                  previous,
                  appointment,
                  clinicName,
                });
          await sendEmail({ to: patientEmail, subject: built.subject, html: built.html });
          await markEventChannel(eventId, "customer", { status: "sent" });
          results.customer = { ok: true };
        } catch (error) {
          await markEventChannel(eventId, "customer", {
            status: "temporary_failure",
            error: error?.message || error,
          });
          results.customer = { ok: false, error: error?.message || String(error) };
          console.error(
            "[appointment-change-notify] customer email failed:",
            error?.message || error
          );
        }
      }
    } else {
      results.customer = { ok: false, skipped: true, reason: "no_customer_email" };
    }

    // --- Clinic email ---
    const recipients = getBookingNotifyEmails();
    if (recipients.length) {
      const claimable =
        !event ||
        canClaimEmailDelivery({
          status: event.clinic_email_status,
          claimedAt: event.clinic_email_claimed_at,
          sentAt: event.clinic_email_sent_at,
        });

      if (claimable && (await claimEventChannel(eventId, "clinic"))) {
        try {
          const built =
            eventType === "cancel"
              ? buildClinicCancellationNotifyEmail({
                  patientName: appointment.patient_name || previous?.patient_name || "",
                  patientPhone: appointment.patient_phone || previous?.patient_phone || "",
                  patientEmail: appointment.patient_email || previous?.patient_email || "",
                  appointments: [appointment],
                  clinicName,
                  actionLabel: resolveCancelActionLabel({ actor: actorKey, reason }),
                  previousStatus: previous?.status || "",
                  extraNote:
                    extraNote ||
                    (actorKey === "customer"
                      ? "הלקוח ביטל את התור דרך האתר (שירות עצמי)."
                      : reason === "deleted"
                        ? "התור נמחק מהמערכת."
                        : "התור בוטל במערכת הניהול."),
                })
              : buildClinicRescheduleNotifyEmail({
                  patientName: appointment.patient_name || previous?.patient_name || "",
                  patientPhone: appointment.patient_phone || previous?.patient_phone || "",
                  patientEmail: appointment.patient_email || previous?.patient_email || "",
                  previous,
                  appointment,
                  clinicName,
                  actor: actorKey,
                });

          const settled = await Promise.allSettled(
            recipients.map((to) => sendEmail({ to, subject: built.subject, html: built.html }))
          );
          const failures = settled.filter((r) => r.status === "rejected");
          if (failures.length === settled.length) {
            throw failures[0]?.reason || new Error("clinic_email_failed");
          }
          await markEventChannel(eventId, "clinic", { status: "sent" });
          results.clinic = { ok: true, sent: settled.length - failures.length };
        } catch (error) {
          await markEventChannel(eventId, "clinic", {
            status: "temporary_failure",
            error: error?.message || error,
          });
          results.clinic = { ok: false, error: error?.message || String(error) };
          console.error(
            "[appointment-change-notify] clinic email failed:",
            error?.message || error
          );
        }
      }
    }
  } else {
    results.customer = { skipped: true, reason: "email_not_configured" };
    results.clinic = { skipped: true, reason: "email_not_configured" };
  }

  // --- Customer SMS (transactional) ---
  if (!canSendSmsChangeNotify()) {
    results.sms = {
      skipped: true,
      reason: "sms_change_notify_disabled_or_unconfigured",
    };
  } else {
    const phoneRaw = appointment.patient_phone || previous?.patient_phone || "";
    const normalized = normalizeIsraeliMobile(phoneRaw);
    if (!normalized.ok) {
      results.sms = { ok: false, skipped: true, reason: normalized.error || "invalid_phone" };
    } else {
      const smsClaimable =
        !event ||
        canClaimEmailDelivery({
          status: event.customer_sms_status,
          claimedAt: event.customer_sms_claimed_at,
          sentAt: event.customer_sms_sent_at,
        });

      if (smsClaimable && (await claimEventChannel(eventId, "sms"))) {
        try {
          const smsDate =
            eventType === "cancel"
              ? appointment.date || previous?.date
              : appointment.date;
          const smsTime =
            eventType === "cancel"
              ? appointment.time || previous?.time
              : appointment.time;
          const message = buildAppointmentChangeSms({
            eventType,
            patientName: appointment.patient_name || previous?.patient_name,
            date: smsDate,
            time: smsTime,
          });
          const smsResult = await sendSms019({
            phone: normalized.normalized,
            message,
            externalId: `chg-${eventType}-${String(appointment.id || "").slice(0, 8)}-${Date.now()}`,
            campaignName:
              eventType === "cancel" ? "appointment-cancel" : "appointment-reschedule",
          });
          if (!smsResult?.ok) {
            throw new Error(smsResult?.error || "sms_send_failed");
          }
          await markEventChannel(eventId, "sms", { status: "accepted" });
          results.sms = { ok: true, accepted: true };
        } catch (error) {
          await markEventChannel(eventId, "sms", {
            status: "temporary_failure",
            error: error?.message || error,
          });
          results.sms = { ok: false, error: error?.message || String(error) };
          console.error(
            "[appointment-change-notify] customer SMS failed:",
            error?.message || error
          );
        }
      }
    }
  }

  return results;
}

/** @deprecated Prefer notifyAppointmentChange — kept for self-service imports. */
export async function notifySelfServiceChange(args = {}) {
  return notifyAppointmentChange({ ...args, actor: args.actor || "customer" });
}
