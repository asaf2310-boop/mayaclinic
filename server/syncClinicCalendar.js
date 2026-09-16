import {
  deleteAppointmentCalendarEvent,
  isCalendarMutationConfigured,
  moveCalendarEventForReschedule,
  updateCalendarEventForAppointment,
} from "./googleCalendarMutation.js";
import { patchAppointmentById } from "./supabaseServer.js";

function calendarSlotChanged(previous, updated) {
  if (!previous || !updated) return false;
  return (
    String(previous.date || "") !== String(updated.date || "") ||
    String(previous.time || "") !== String(updated.time || "")
  );
}

/**
 * Best-effort clinic Google Calendar sync for an appointment row.
 * Never throws to the caller — logs and returns a result object.
 */
export async function syncClinicCalendarForAppointment(
  appointment,
  { action = "sync", previous = null } = {}
) {
  if (!appointment || !isCalendarMutationConfigured()) {
    return { skipped: true, reason: "not_configured_or_no_appointment" };
  }

  try {
    if (action === "delete" || String(appointment.status || "").trim() === "cancelled") {
      const deleted = await deleteAppointmentCalendarEvent(appointment);
      if (appointment.id && appointment.google_event_id) {
        try {
          await patchAppointmentById(appointment.id, { google_event_id: null });
        } catch (error) {
          console.warn("[syncClinicCalendar] clear google_event_id failed", error?.message);
        }
      }
      return { deleted };
    }

    const result =
      action === "reschedule" || (previous && calendarSlotChanged(previous, appointment))
        ? await moveCalendarEventForReschedule(previous, appointment)
        : await updateCalendarEventForAppointment(appointment);

    const eventId = String(result?.eventId || "").trim();
    if (
      appointment.id &&
      eventId &&
      eventId !== String(appointment.google_event_id || "").trim()
    ) {
      try {
        await patchAppointmentById(appointment.id, { google_event_id: eventId });
      } catch (error) {
        console.warn("[syncClinicCalendar] save google_event_id failed", error?.message);
      }
    }

    return { ...result, eventId: eventId || null };
  } catch (error) {
    console.error("[syncClinicCalendar] failed", {
      appointmentId: appointment?.id,
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
    });
    return { error: true, message: error?.message || String(error) };
  }
}

export async function syncClinicCalendarForAppointments(appointments = [], options = {}) {
  const results = [];
  for (const appointment of appointments) {
    results.push(await syncClinicCalendarForAppointment(appointment, options));
  }
  return results;
}
