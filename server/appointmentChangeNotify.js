/**
 * Shared customer + clinic emails and customer SMS after appointment
 * reschedule / cancel (admin UI or self-service).
 *
 * Runs after DB commit. Failures are logged; booking state stays correct.
 * Idempotent via appointment_change_events.idempotency_key + claim columns.
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

function clinicPhoneFromEnv() {
  return String(process.env.CLINIC_PUBLIC_PHONE || process.env.SMS019_SENDER || "0549000301").trim();
}

/**
 * Stable per-change key so retries / double-submits reuse one notify row.
 */
export function buildChangeIdempotencyKey({
  appointmentId,
  eventType,
  actor = "customer",
  before = null,
  after = null,
} = {}) {
  const parts = [
    String(appointmentId || "").trim(),
    String(eventType || "").trim(),
    actor === "admin" ? "admin" : "customer",
    String(before?.date || "").trim(),
    String(before?.time || "").trim().slice(0, 5),
    String(before?.status || "").trim(),
    String(after?.date || "").trim(),
    String(after?.time || "").trim().slice(0, 5),
    String(after?.status || "").trim(),
  ];
  return parts.join("|").slice(0, 240);
}

export function buildAppointmentChangeSms({
  eventType,
  patientName,
  date,
  time,
  previousDate = null,
  previousTime = null,
  treatmentName = "",
  clinicPhone = "",
} = {}) {
  const phone = String(clinicPhone || "").trim() || clinicPhoneFromEnv();
  const name = String(patientName || "").trim() || "לקוח/ה";
  const treatment = String(treatmentName || "").trim();
  const dateLabel = formatSmsDate(date);
  const timeLabel = formatSmsTime(time);
  const prevDateLabel = previousDate ? formatSmsDate(previousDate) : "";
  const prevTimeLabel = previousTime ? formatSmsTime(previousTime) : "";

  if (eventType === "cancel") {
    const template = DEFAULT_CANCEL_SMS_TEMPLATE;
    const rendered = renderSmsTemplate(
      template,
      { patientName: name, date, time },
      { formatDate: formatSmsDate, formatTime: formatSmsTime }
    );
    if (rendered.ok) {
      const withTreatment = treatment
        ? rendered.message.replace(`התור שלך`, `התור שלך ל${treatment}`)
        : rendered.message;
      return withTreatment.includes(phone)
        ? withTreatment
        : `${withTreatment} ${phone}`.trim();
    }
    const treatBit = treatment ? ` ל${treatment}` : "";
    return `שלום ${name}, התור שלך${treatBit} בתאריך ${dateLabel} בשעה ${timeLabel} בוטל. לתיאום מחדש: ${phone}`;
  }

  // Reschedule — include treatment + previous + new slot + contact.
  if (prevDateLabel && prevTimeLabel) {
    const treatBit = treatment ? ` ל${treatment}` : "";
    return (
      `שלום ${name}, התור שלך${treatBit} עודכן מ־${prevDateLabel} ${prevTimeLabel}` +
      ` ל־${dateLabel} בשעה ${timeLabel}. לשינוי או ביטול: ${phone}`
    );
  }

  const template = DEFAULT_RESCHEDULE_SMS_TEMPLATE;
  const rendered = renderSmsTemplate(
    template,
    { patientName: name, date, time },
    { formatDate: formatSmsDate, formatTime: formatSmsTime }
  );
  if (rendered.ok) {
    const withTreatment = treatment
      ? rendered.message.replace(`התור שלך`, `התור שלך ל${treatment}`)
      : rendered.message;
    return withTreatment.includes(phone)
      ? withTreatment
      : `${withTreatment} ${phone}`.trim();
  }
  const treatBit = treatment ? ` ל${treatment}` : "";
  return `שלום ${name}, התור שלך${treatBit} עודכן ל־${dateLabel} בשעה ${timeLabel}. לשינוי או ביטול: ${phone}`;
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
    // Missing claim columns / table: still attempt delivery once.
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

  // "accepted" = provider accepted (SMS). "sent" = SMTP accepted. Never "delivered".
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

async function fetchChangeEventByIdempotencyKey(idempotencyKey) {
  if (!idempotencyKey) return null;
  try {
    const rows = await supabaseRequest(
      `appointment_change_events?idempotency_key=eq.${encodeURIComponent(idempotencyKey)}` +
        `&select=*&order=created_at.desc&limit=1`
    );
    return Array.isArray(rows) ? rows[0] || null : rows || null;
  } catch (error) {
    if (/idempotency_key|column/i.test(String(error?.message || ""))) return null;
    console.warn(
      "[appointment-change-notify] idempotency lookup failed:",
      error?.message || error
    );
    return null;
  }
}

/**
 * Insert audit + notify claim row. Returns null when table/migration missing.
 * Reuses an existing row when idempotency_key already exists.
 */
export async function recordAppointmentChangeEvent({
  appointmentId,
  tenantId,
  eventType,
  actor = "customer",
  phoneNormalized = null,
  beforeSnapshot = null,
  afterSnapshot = null,
  idempotencyKey = null,
  /** When true, only calendar_sync_* is pending — email/SMS are skipped (booking creates). */
  calendarOnly = false,
} = {}) {
  if (!appointmentId || !eventType) return null;

  const key =
    idempotencyKey ||
    buildChangeIdempotencyKey({
      appointmentId,
      eventType,
      actor,
      before: beforeSnapshot,
      after: afterSnapshot,
    });

  const existing = await fetchChangeEventByIdempotencyKey(key);
  if (existing) return existing;

  const notifyStatus = calendarOnly || eventType === "create" ? "skipped" : "pending";

  const baseRow = {
    appointment_id: appointmentId,
    tenant_id: tenantId || null,
    event_type: eventType,
    actor: actor === "admin" ? "admin" : "customer",
    phone_normalized: phoneNormalized || null,
    before_snapshot: beforeSnapshot,
    after_snapshot: afterSnapshot,
    customer_email_status: notifyStatus,
    clinic_email_status: notifyStatus,
    customer_sms_status: notifyStatus,
    calendar_sync_status: "pending",
    calendar_sync_attempts: 0,
  };

  const tryInsert = async (body) => {
    const rows = await supabaseRequest("appointment_change_events", {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(body),
    });
    return Array.isArray(rows) ? rows[0] : rows;
  };

  try {
    return await tryInsert({ ...baseRow, idempotency_key: key });
  } catch (error) {
    const message = String(error?.message || error || "");

    // Unique conflict — another worker won; reuse their row.
    if (/duplicate|unique|23505/i.test(message)) {
      const raced = await fetchChangeEventByIdempotencyKey(key);
      if (raced) return raced;
    }

    let insertError = error;

    // Pre-migration: no idempotency_key column.
    if (/idempotency_key/i.test(message) || (/column/i.test(message) && /idempotency/i.test(message))) {
      try {
        return await tryInsert(baseRow);
      } catch (retryError) {
        insertError = retryError;
      }
    }

    const insertMessage = String(insertError?.message || insertError || "");

    // Retry without calendar sync columns (pre-migration DBs).
    if (
      /calendar_sync_/i.test(insertMessage) ||
      (/column/i.test(insertMessage) && /calendar/i.test(insertMessage))
    ) {
      try {
        const withoutCalendar = { ...baseRow };
        delete withoutCalendar.calendar_sync_status;
        delete withoutCalendar.calendar_sync_attempts;
        return await tryInsert({ ...withoutCalendar, idempotency_key: key });
      } catch (retryError) {
        insertError = retryError;
      }
    }

    const afterCalendarMessage = String(insertError?.message || insertError || "");

    // Retry without SMS claim columns (pre-migration DBs).
    if (
      /customer_sms_/i.test(afterCalendarMessage) ||
      (/column/i.test(afterCalendarMessage) && /sms/i.test(afterCalendarMessage))
    ) {
      try {
        const withoutSms = { ...baseRow };
        delete withoutSms.customer_sms_status;
        delete withoutSms.calendar_sync_status;
        delete withoutSms.calendar_sync_attempts;
        return await tryInsert({ ...withoutSms, idempotency_key: key });
      } catch (retryError) {
        const retryMsg = String(retryError?.message || "");
        if (/idempotency_key/i.test(retryMsg)) {
          try {
            const withoutSms = { ...baseRow };
            delete withoutSms.customer_sms_status;
            delete withoutSms.calendar_sync_status;
            delete withoutSms.calendar_sync_attempts;
            return await tryInsert(withoutSms);
          } catch (finalError) {
            console.warn(
              "[appointment-change-notify] change event insert failed:",
              finalError?.message || finalError
            );
            return null;
          }
        }
        console.warn(
          "[appointment-change-notify] change event insert failed:",
          retryError?.message || retryError
        );
        return null;
      }
    }

    console.warn(
      "[appointment-change-notify] change event insert failed (run customer-self-service.sql):",
      insertError?.message || insertError
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

  // Run channels independently — one hang/failure must not block the others.
  async function sendCustomerEmail() {
    if (!isEmailConfigured()) {
      results.customer = { skipped: true, reason: "email_not_configured" };
      return;
    }
    const patientEmail = String(
      appointment.patient_email || previous?.patient_email || ""
    ).trim();
    if (!patientEmail) {
      results.customer = { ok: false, skipped: true, reason: "no_customer_email" };
      return;
    }
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
    } else if (event?.customer_email_sent_at || event?.customer_email_status === "sent") {
      results.customer = { ok: true, already: true };
    }
  }

  async function sendClinicEmail() {
    if (!isEmailConfigured()) {
      results.clinic = { skipped: true, reason: "email_not_configured" };
      return;
    }
    const recipients = getBookingNotifyEmails();
    if (!recipients.length) {
      results.clinic = { ok: false, skipped: true, reason: "no_clinic_recipients" };
      return;
    }
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
    } else if (event?.clinic_email_sent_at || event?.clinic_email_status === "sent") {
      results.clinic = { ok: true, already: true };
    }
  }

  async function sendCustomerSms() {
    if (!canSendSmsChangeNotify()) {
      results.sms = {
        skipped: true,
        reason: "sms_change_notify_disabled_or_unconfigured",
      };
      return;
    }
    const phoneRaw = appointment.patient_phone || previous?.patient_phone || "";
    const normalized = normalizeIsraeliMobile(phoneRaw);
    if (!normalized.ok) {
      results.sms = { ok: false, skipped: true, reason: normalized.error || "invalid_phone" };
      return;
    }
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
          previousDate: eventType === "reschedule" ? previous?.date : null,
          previousTime: eventType === "reschedule" ? previous?.time : null,
          treatmentName: appointment.treatment_name || previous?.treatment_name || "",
          clinicPhone: clinicPhoneFromEnv(),
        });
        // Stable external id per change-event (not Date.now) so provider retries stay idempotent.
        const externalId = eventId
          ? `chg-${eventType}-${String(eventId).slice(0, 24)}`
          : `chg-${eventType}-${String(appointment.id || "").slice(0, 8)}-${String(smsDate)}-${String(smsTime).slice(0, 5)}`;
        const smsResult = await sendSms019({
          phone: normalized.normalized,
          message,
          externalId,
          campaignName:
            eventType === "cancel" ? "appointment-cancel" : "appointment-reschedule",
        });
        if (!smsResult?.ok) {
          throw new Error(smsResult?.error || "sms_send_failed");
        }
        // Provider accepted — not confirmed delivered.
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
    } else if (
      event?.customer_sms_sent_at ||
      event?.customer_sms_status === "accepted" ||
      event?.customer_sms_status === "sent"
    ) {
      results.sms = { ok: true, already: true };
    }
  }

  await Promise.allSettled([sendCustomerEmail(), sendClinicEmail(), sendCustomerSms()]);
  return results;
}

function channelNeedsRetry(status) {
  const s = String(status || "");
  // Include stuck `sending` — claim layer reclaims only after STALE_EMAIL_CLAIM_MS.
  return !s || s === "pending" || s === "temporary_failure" || s === "sending";
}

/**
 * Re-attempt failed/pending change notifications (cron). Does not re-send
 * channels already marked sent/accepted. Reloads appointment from DB.
 */
export async function retryFailedAppointmentChangeNotifies({
  limit = 25,
  olderThanMinutes = 2,
  maxAgeDays = 7,
} = {}) {
  const now = Date.now();
  const createdBefore = new Date(now - olderThanMinutes * 60 * 1000).toISOString();
  const createdAfter = new Date(now - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();

  let events = [];
  try {
    events =
      (await supabaseRequest(
        `appointment_change_events?created_at=gte.${encodeURIComponent(createdAfter)}` +
          `&created_at=lte.${encodeURIComponent(createdBefore)}` +
          `&or=(customer_email_status.in.(pending,temporary_failure,sending),` +
          `clinic_email_status.in.(pending,temporary_failure,sending),` +
          `customer_sms_status.in.(pending,temporary_failure,sending),` +
          `customer_email_status.is.null,clinic_email_status.is.null,customer_sms_status.is.null)` +
          `&select=*&order=created_at.asc&limit=${Math.max(1, Math.min(100, Number(limit) || 25))}`
      )) || [];
  } catch (error) {
    console.warn(
      "[appointment-change-notify] retry fetch failed (run customer-self-service.sql):",
      error?.message || error
    );
    return { ok: false, skipped: true, reason: "fetch_failed", retried: 0 };
  }

  let retried = 0;
  let succeeded = 0;
  let failed = 0;

  for (const event of events) {
    // Booking-create rows are calendar-only; never send reschedule/cancel emails.
    if (String(event.event_type || "") === "create") continue;

    const needs =
      channelNeedsRetry(event.customer_email_status) ||
      channelNeedsRetry(event.clinic_email_status) ||
      channelNeedsRetry(event.customer_sms_status);
    if (!needs) continue;

    let appointment = null;
    if (event.appointment_id) {
      try {
        const rows = await supabaseRequest(
          `appointments?id=eq.${encodeURIComponent(event.appointment_id)}&select=*&limit=1`
        );
        appointment = Array.isArray(rows) ? rows[0] : rows;
      } catch (error) {
        console.warn(
          "[appointment-change-notify] retry load appointment failed:",
          error?.message || error
        );
        failed += 1;
        continue;
      }
    }

    // Hard-deleted appointment (FK SET NULL) or missing row — use snapshots.
    if (!appointment && event.after_snapshot) {
      appointment = {
        id: event.appointment_id,
        ...(typeof event.after_snapshot === "object" ? event.after_snapshot : {}),
        patient_phone:
          event.phone_normalized ||
          event.after_snapshot?.patient_phone ||
          event.before_snapshot?.patient_phone ||
          null,
        patient_email:
          event.after_snapshot?.patient_email ||
          event.before_snapshot?.patient_email ||
          null,
        patient_name:
          event.after_snapshot?.patient_name ||
          event.before_snapshot?.patient_name ||
          null,
      };
    }
    if (!appointment) {
      failed += 1;
      continue;
    }

    const previous =
      event.before_snapshot && typeof event.before_snapshot === "object"
        ? event.before_snapshot
        : null;

    retried += 1;
    try {
      const results = await notifyAppointmentChange({
        event,
        eventType: event.event_type,
        appointment,
        previous,
        actor: event.actor === "admin" ? "admin" : "customer",
      });
      const anyOk =
        results?.customer?.ok || results?.clinic?.ok || results?.sms?.ok || results?.sms?.accepted;
      if (anyOk) succeeded += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      console.error(
        "[appointment-change-notify] retry failed:",
        error?.message || error
      );
    }
  }

  return { ok: true, retried, succeeded, failed, scanned: events.length };
}

/** @deprecated Prefer notifyAppointmentChange — kept for self-service imports. */
export async function notifySelfServiceChange(args = {}) {
  return notifyAppointmentChange({ ...args, actor: args.actor || "customer" });
}
