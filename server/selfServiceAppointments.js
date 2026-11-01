/**
 * Customer self-service: list / reschedule / cancel upcoming appointments.
 * Ownership is always re-checked server-side from the verified session phone.
 */

import { hasAppointmentTimeConflict } from "../src/lib/bookingSlots.js";
import { supabaseRequest } from "./supabaseServer.js";
import { syncCalendarForChangeEvent } from "./calendarChangeSync.js";
import { recordAdminAuditEvent } from "./adminAuditLog.js";
import {
  canModifyAppointmentWithinPolicy,
  isSameSlot,
  isSlotAllowedForReschedule,
  isUpcomingActiveAppointment,
  phoneLookupVariants,
  phonesMatch,
  POLICY_MESSAGE_HE,
  publicAppointmentView,
} from "./selfServicePolicy.js";
import {
  notifySelfServiceChange,
  recordAppointmentChangeEvent,
} from "./selfServiceNotify.js";

const APPOINTMENT_SELECT =
  "id,patient_name,patient_phone,patient_email,treatment_id,treatment_name,treatment_price," +
  "date,time,status,paid,notes,tenant_id,therapist_ids,therapist_names,duration_minutes," +
  "google_event_id,reminder_sent_at,reminder_email_status,reminder_email_attempts," +
  "reminder_email_last_error,reminder_email_claimed_at,reminder_sms_status,reminder_sms_attempts," +
  "reminder_sms_last_error,reminder_sms_claimed_at,reminder_sms_sent_at,reminder_sms_shipment_id," +
  "updated_at,created_at";

const APPOINTMENT_SELECT_LEGACY =
  "id,patient_name,patient_phone,patient_email,treatment_id,treatment_name,treatment_price," +
  "date,time,status,paid,notes,created_at";

function clinicPhoneFromEnv() {
  return String(process.env.CLINIC_PUBLIC_PHONE || process.env.SMS019_SENDER || "0549000301").trim();
}

function missingColumn(error) {
  const text = String(error?.message || "");
  const match =
    text.match(/column [a-z_]+\.([a-z_0-9]+) does not exist/i) ||
    text.match(/Could not find the '([a-z_0-9]+)' column/i);
  return match?.[1] || null;
}

function stripSelectColumn(select, column) {
  return String(select)
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part && part !== column)
    .join(",");
}

async function supabaseSelectAppointments(pathBuilder) {
  let select = APPOINTMENT_SELECT;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      return (await supabaseRequest(pathBuilder(select))) || [];
    } catch (error) {
      const col = missingColumn(error);
      if (!col) throw error;
      if (select === APPOINTMENT_SELECT && /tenant_id|updated_at|therapist|google_event|duration|reminder_/i.test(col)) {
        select = stripSelectColumn(select, col);
        if (!select.includes("id")) select = APPOINTMENT_SELECT_LEGACY;
        continue;
      }
      select = stripSelectColumn(select, col);
      if (!select) throw error;
    }
  }
  return [];
}

function buildReminderResetPatch() {
  return {
    reminder_sent_at: null,
    reminder_email_status: "pending",
    reminder_email_attempts: 0,
    reminder_email_last_error: null,
    reminder_email_claimed_at: null,
    reminder_sms_sent_at: null,
    reminder_sms_status: "pending",
    reminder_sms_attempts: 0,
    reminder_sms_last_error: null,
    reminder_sms_claimed_at: null,
    reminder_sms_shipment_id: null,
  };
}

function buildReminderCancelPatch() {
  return {
    reminder_sms_status: "cancelled",
    reminder_sms_claimed_at: null,
    reminder_sms_last_error: "appointment_cancelled",
    reminder_email_status: "cancelled",
    reminder_email_claimed_at: null,
    reminder_email_last_error: "appointment_cancelled",
  };
}

async function fetchActiveAppointmentsForDate(date, tenantId, { excludeId = "" } = {}) {
  const tenant = String(tenantId || "").trim();
  const tenantFilter = tenant ? `&tenant_id=eq.${encodeURIComponent(tenant)}` : "";
  let rows;
  try {
    rows =
      (await supabaseRequest(
        `appointments?date=eq.${encodeURIComponent(date)}${tenantFilter}` +
          `&status=neq.cancelled&select=id,date,time,status,tenant_id&limit=500`
      )) || [];
  } catch (error) {
    if (String(error?.message || "").includes("tenant_id")) {
      rows =
        (await supabaseRequest(
          `appointments?date=eq.${encodeURIComponent(date)}&status=neq.cancelled&select=id,date,time,status&limit=500`
        )) || [];
    } else {
      throw error;
    }
  }
  if (!excludeId) return rows;
  return rows.filter((row) => String(row.id) !== String(excludeId));
}

async function assertSlotAvailable({ date, time, tenantId, excludeId, bookingDurationMinutes = 60 }) {
  const existing = await fetchActiveAppointmentsForDate(date, tenantId, { excludeId });
  if (
    hasAppointmentTimeConflict(
      { date, time, id: excludeId },
      existing,
      { bookingDurationMinutes }
    )
  ) {
    const error = new Error("המועד שנבחר כבר תפוס. בחרו מועד אחר.");
    error.code = "slot_taken";
    error.status = 409;
    throw error;
  }

  // Slot must exist on an active availability day when availability rows exist.
  try {
    const tenant = String(tenantId || "").trim();
    const tenantFilter = tenant ? `&tenant_id=eq.${encodeURIComponent(tenant)}` : "";
    let rows =
      (await supabaseRequest(
        `availability?date=eq.${encodeURIComponent(date)}${tenantFilter}&is_active=eq.true&select=id,date,slots,is_active&limit=5`
      )) || [];
    if (!rows.length && tenant) {
      rows =
        (await supabaseRequest(
          `availability?date=eq.${encodeURIComponent(date)}&is_active=eq.true&select=id,date,slots,is_active&limit=5`
        )) || [];
    }
    if (rows.length) {
      const slots = rows.flatMap((row) => (Array.isArray(row.slots) ? row.slots : []));
      const normalizedTime = String(time || "").slice(0, 5);
      if (slots.length && !slots.some((slot) => String(slot).slice(0, 5) === normalizedTime)) {
        const error = new Error("השעה שנבחרה אינה זמינה ביום זה.");
        error.code = "slot_unavailable";
        error.status = 409;
        throw error;
      }
    }
  } catch (error) {
    if (error?.code === "slot_unavailable") throw error;
    // Availability table/query issues should not silently allow past conflicts — only skip day-slot check.
    if (!/availability/i.test(String(error?.message || ""))) throw error;
  }
}

async function loadOwnedAppointment({ appointmentId, phoneNormalized, tenantId }) {
  const tenant = String(tenantId || "").trim();
  const rows = await supabaseSelectAppointments(
    (select) =>
      `appointments?id=eq.${encodeURIComponent(appointmentId)}` +
      (tenant ? `&tenant_id=eq.${encodeURIComponent(tenant)}` : "") +
      `&select=${select}&limit=1`
  );
  const row = rows[0] || null;
  if (!row) {
    const error = new Error("התור לא נמצא");
    error.code = "not_found";
    error.status = 404;
    throw error;
  }
  if (!phonesMatch(row.patient_phone, phoneNormalized)) {
    const error = new Error("התור לא נמצא");
    error.code = "not_found";
    error.status = 404;
    throw error;
  }
  return row;
}

async function conditionalPatchAppointment(appointment, patch) {
  const id = encodeURIComponent(appointment.id);
  const filters = [`id=eq.${id}`];

  if (appointment.updated_at) {
    filters.push(`updated_at=eq.${encodeURIComponent(appointment.updated_at)}`);
  } else {
    // Fallback versioning before updated_at migration.
    filters.push(`date=eq.${encodeURIComponent(appointment.date)}`);
    filters.push(`time=eq.${encodeURIComponent(appointment.time)}`);
    filters.push(`status=eq.${encodeURIComponent(appointment.status)}`);
  }

  let payload = { ...patch };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    try {
      const updated = await supabaseRequest(`appointments?${filters.join("&")}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });
      const row = Array.isArray(updated) ? updated[0] : updated;
      if (!row) {
        const error = new Error("התור עודכן במקביל. רעננו את הפרטים ונסו שוב.");
        error.code = "concurrent_modification";
        error.status = 409;
        throw error;
      }
      return row;
    } catch (error) {
      if (error?.code === "concurrent_modification") throw error;
      const col = missingColumn(error);
      if (col && Object.prototype.hasOwnProperty.call(payload, col)) {
        delete payload[col];
        continue;
      }
      // Conflict trigger from DB
      if (/appointment_time_conflict/i.test(String(error?.message || ""))) {
        const conflict = new Error("המועד שנבחר כבר תפוס. בחרו מועד אחר.");
        conflict.code = "slot_taken";
        conflict.status = 409;
        throw conflict;
      }
      throw error;
    }
  }
  throw new Error("לא ניתן לעדכן את התור");
}

async function insertChangeEvent({
  appointmentId,
  tenantId,
  eventType,
  phoneNormalized,
  beforeSnapshot,
  afterSnapshot,
}) {
  return recordAppointmentChangeEvent({
    appointmentId,
    tenantId,
    eventType,
    actor: "customer",
    phoneNormalized,
    beforeSnapshot,
    afterSnapshot,
  });
}

export async function listUpcomingAppointmentsForPhone({
  phoneNormalized,
  tenantId,
  now = new Date(),
} = {}) {
  const variants = phoneLookupVariants(phoneNormalized);
  if (!variants.length) return [];

  const tenant = String(tenantId || "").trim();
  const orFilter = variants.map((v) => `patient_phone.eq.${encodeURIComponent(v)}`).join(",");
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const rows = await supabaseSelectAppointments((select) => {
    let path =
      `appointments?or=(${orFilter})` +
      `&status=in.(pending,confirmed)` +
      `&date=gte.${today}` +
      `&select=${select}` +
      `&order=date.asc,time.asc&limit=50`;
    if (tenant) path += `&tenant_id=eq.${encodeURIComponent(tenant)}`;
    return path;
  });

  const clinicPhone = clinicPhoneFromEnv();
  return rows
    .filter((row) => phonesMatch(row.patient_phone, phoneNormalized))
    .filter((row) => isUpcomingActiveAppointment(row, now))
    .map((row) => publicAppointmentView(row, { now, clinicPhone }));
}

export async function getOwnedAppointmentPublic({
  appointmentId,
  phoneNormalized,
  tenantId,
  now = new Date(),
} = {}) {
  const row = await loadOwnedAppointment({ appointmentId, phoneNormalized, tenantId });
  return publicAppointmentView(row, { now, clinicPhone: clinicPhoneFromEnv() });
}

export async function rescheduleOwnedAppointment({
  appointmentId,
  phoneNormalized,
  tenantId,
  newDate,
  newTime,
  expectedUpdatedAt = null,
  now = new Date(),
} = {}) {
  const appointment = await loadOwnedAppointment({ appointmentId, phoneNormalized, tenantId });

  if (expectedUpdatedAt && appointment.updated_at && String(appointment.updated_at) !== String(expectedUpdatedAt)) {
    const error = new Error("התור עודכן במקביל. רעננו את הפרטים ונסו שוב.");
    error.code = "concurrent_modification";
    error.status = 409;
    throw error;
  }

  if (!isUpcomingActiveAppointment(appointment, now)) {
    const error = new Error("לא ניתן לעדכן תור זה");
    error.code = "not_modifiable";
    error.status = 400;
    throw error;
  }

  if (!canModifyAppointmentWithinPolicy(appointment, now)) {
    const error = new Error(POLICY_MESSAGE_HE);
    error.code = "within_24h";
    error.status = 403;
    error.clinicPhone = clinicPhoneFromEnv();
    throw error;
  }

  const date = String(newDate || "").trim();
  const time = String(newTime || "").trim().slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) {
    const error = new Error("תאריך או שעה לא תקינים");
    error.code = "invalid_slot";
    error.status = 400;
    throw error;
  }

  if (isSameSlot(appointment, { date, time })) {
    const error = new Error("בחרו מועד חדש השונה מהמועד הנוכחי");
    error.code = "same_slot";
    error.status = 400;
    throw error;
  }

  if (!isSlotAllowedForReschedule({ date, time }, now)) {
    const error = new Error(POLICY_MESSAGE_HE);
    error.code = "new_slot_within_24h";
    error.status = 403;
    error.clinicPhone = clinicPhoneFromEnv();
    throw error;
  }

  const durationMinutes = Number(appointment.duration_minutes) || 60;
  await assertSlotAvailable({
    date,
    time,
    tenantId,
    excludeId: appointment.id,
    bookingDurationMinutes: durationMinutes,
  });

  const beforeSnapshot = {
    date: appointment.date,
    time: appointment.time,
    status: appointment.status,
    treatment_name: appointment.treatment_name,
    patient_name: appointment.patient_name || null,
    patient_phone: appointment.patient_phone || null,
    patient_email: appointment.patient_email || null,
    google_event_id: appointment.google_event_id || null,
  };

  const patch = {
    date,
    time,
    ...buildReminderResetPatch(),
  };

  const updated = await conditionalPatchAppointment(appointment, patch);

  // Re-check uniqueness: only one active row for this id (in-place update).
  if (String(updated.status) === "cancelled") {
    const error = new Error("התור בוטל במקביל");
    error.code = "concurrent_modification";
    error.status = 409;
    throw error;
  }

  const event = await insertChangeEvent({
    appointmentId: updated.id,
    tenantId,
    eventType: "reschedule",
    phoneNormalized,
    beforeSnapshot,
    afterSnapshot: {
      date: updated.date,
      time: updated.time,
      status: updated.status,
      treatment_name: updated.treatment_name,
      patient_name: updated.patient_name || appointment.patient_name || null,
      patient_phone: updated.patient_phone || appointment.patient_phone || null,
      patient_email: updated.patient_email || appointment.patient_email || null,
      google_event_id: updated.google_event_id || appointment.google_event_id || null,
    },
  });

  recordAdminAuditEvent({
    action: "customer_reschedule",
    tenantId,
    ok: true,
    detail: {
      appointmentId: updated.id,
      from: beforeSnapshot,
      to: { date: updated.date, time: updated.time },
    },
  });

  // Await post-commit side effects on Vercel — fire-and-forget is killed when
  // the response finishes. Booking already committed: never throw to the client.
  const mergedForCalendar = {
    ...appointment,
    ...updated,
    google_event_id: updated.google_event_id || appointment.google_event_id,
  };

  // Calendar + notify in parallel — one hang must not starve the other.
  // Calendar failures persist on the change event for cron retry.
  const [calendarSettled, notifySettled] = await Promise.allSettled([
    syncCalendarForChangeEvent({
      event,
      appointment: mergedForCalendar,
      previous: appointment,
      action: "reschedule",
    }),
    notifySelfServiceChange({
      event,
      eventType: "reschedule",
      appointment: updated,
      previous: appointment,
    }),
  ]);

  const calendar =
    calendarSettled.status === "fulfilled"
      ? calendarSettled.value
      : {
          error: true,
          message: calendarSettled.reason?.message || String(calendarSettled.reason),
        };
  if (calendarSettled.status === "rejected") {
    console.error(
      "[self-service] calendar reschedule failed:",
      calendarSettled.reason?.message || calendarSettled.reason
    );
  }

  const notify =
    notifySettled.status === "fulfilled"
      ? notifySettled.value
      : {
          error: true,
          message: notifySettled.reason?.message || String(notifySettled.reason),
        };
  if (notifySettled.status === "rejected") {
    console.error(
      "[self-service] notify reschedule failed:",
      notifySettled.reason?.message || notifySettled.reason
    );
  }

  return {
    appointment: publicAppointmentView(updated, { now, clinicPhone: clinicPhoneFromEnv() }),
    previous: beforeSnapshot,
    booking: { ok: true },
    calendar,
    notify,
  };
}

export async function cancelOwnedAppointment({
  appointmentId,
  phoneNormalized,
  tenantId,
  expectedUpdatedAt = null,
  now = new Date(),
} = {}) {
  const appointment = await loadOwnedAppointment({ appointmentId, phoneNormalized, tenantId });

  if (expectedUpdatedAt && appointment.updated_at && String(appointment.updated_at) !== String(expectedUpdatedAt)) {
    const error = new Error("התור עודכן במקביל. רעננו את הפרטים ונסו שוב.");
    error.code = "concurrent_modification";
    error.status = 409;
    throw error;
  }

  if (String(appointment.status) === "cancelled") {
    return {
      appointment: publicAppointmentView(appointment, { now, clinicPhone: clinicPhoneFromEnv() }),
      alreadyCancelled: true,
    };
  }

  if (!isUpcomingActiveAppointment(appointment, now)) {
    const error = new Error("לא ניתן לבטל תור זה");
    error.code = "not_modifiable";
    error.status = 400;
    throw error;
  }

  if (!canModifyAppointmentWithinPolicy(appointment, now)) {
    const error = new Error(POLICY_MESSAGE_HE);
    error.code = "within_24h";
    error.status = 403;
    error.clinicPhone = clinicPhoneFromEnv();
    throw error;
  }

  const beforeSnapshot = {
    date: appointment.date,
    time: appointment.time,
    status: appointment.status,
    treatment_name: appointment.treatment_name,
    patient_name: appointment.patient_name || null,
    patient_phone: appointment.patient_phone || null,
    patient_email: appointment.patient_email || null,
    google_event_id: appointment.google_event_id || null,
  };

  const updated = await conditionalPatchAppointment(appointment, {
    status: "cancelled",
    ...buildReminderCancelPatch(),
  });

  const event = await insertChangeEvent({
    appointmentId: updated.id,
    tenantId,
    eventType: "cancel",
    phoneNormalized,
    beforeSnapshot,
    afterSnapshot: {
      date: updated.date,
      time: updated.time,
      status: updated.status,
      treatment_name: updated.treatment_name,
      patient_name: updated.patient_name || appointment.patient_name || null,
      patient_phone: updated.patient_phone || appointment.patient_phone || null,
      patient_email: updated.patient_email || appointment.patient_email || null,
      google_event_id: updated.google_event_id || appointment.google_event_id || null,
    },
  });

  recordAdminAuditEvent({
    action: "customer_cancel",
    tenantId,
    ok: true,
    detail: { appointmentId: updated.id, before: beforeSnapshot },
  });

  const mergedForCalendar = {
    ...appointment,
    ...updated,
    google_event_id: updated.google_event_id || appointment.google_event_id,
  };

  const [calendarSettled, notifySettled] = await Promise.allSettled([
    syncCalendarForChangeEvent({
      event,
      appointment: mergedForCalendar,
      action: "delete",
    }),
    notifySelfServiceChange({
      event,
      eventType: "cancel",
      appointment: updated,
      previous: appointment,
    }),
  ]);

  const calendar =
    calendarSettled.status === "fulfilled"
      ? calendarSettled.value
      : {
          error: true,
          message: calendarSettled.reason?.message || String(calendarSettled.reason),
        };
  if (calendarSettled.status === "rejected") {
    console.error(
      "[self-service] calendar cancel failed:",
      calendarSettled.reason?.message || calendarSettled.reason
    );
  }

  const notify =
    notifySettled.status === "fulfilled"
      ? notifySettled.value
      : {
          error: true,
          message: notifySettled.reason?.message || String(notifySettled.reason),
        };
  if (notifySettled.status === "rejected") {
    console.error(
      "[self-service] notify cancel failed:",
      notifySettled.reason?.message || notifySettled.reason
    );
  }

  return {
    appointment: publicAppointmentView(updated, { now, clinicPhone: clinicPhoneFromEnv() }),
    previous: beforeSnapshot,
    booking: { ok: true },
    calendar,
    notify,
  };
}
