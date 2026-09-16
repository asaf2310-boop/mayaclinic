import { validateCalendarAppointments, resolveDurationMinutes } from "./calendarEventBody.js";
import { getCalendarClient, isGoogleCalendarConfigured } from "./googleCalendarClient.js";

export function isCalendarMutationConfigured() {
  return isGoogleCalendarConfigured();
}

function appointmentStartMs(date, time) {
  const datePart = String(date || "").trim();
  const timePart = String(time || "").trim();
  const match = timePart.match(/^(\d{1,2}):(\d{2})/);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart) || !match) return NaN;
  const [year, month, day] = datePart.split("-").map(Number);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  return new Date(year, month - 1, day, hours, minutes, 0, 0).getTime();
}

export async function deleteCalendarEvent(eventId) {
  if (!eventId || !isGoogleCalendarConfigured()) {
    return { skipped: true, reason: "not_configured_or_no_id" };
  }

  const { calendar, calendarId } = getCalendarClient();
  try {
    await calendar.events.delete({ calendarId, eventId: String(eventId) });
    console.info("[googleCalendarMutation] deleted", { eventId, calendarId });
    return { deleted: true, eventId };
  } catch (error) {
    if (error?.code === 404 || error?.response?.status === 404 || error?.response?.status === 410) {
      return { deleted: false, reason: "not_found", eventId };
    }
    console.error("[googleCalendarMutation] delete failed", {
      eventId,
      message: error?.message,
      status: error?.response?.status,
    });
    throw error;
  }
}

export async function findCalendarEventIdForAppointment(appointment) {
  if (!isGoogleCalendarConfigured()) return null;

  const startMs = appointmentStartMs(appointment.date, appointment.time);
  if (!Number.isFinite(startMs)) return null;

  const durationMinutes = resolveDurationMinutes(appointment);
  const { calendar, calendarId, timezone } = getCalendarClient();
  const timeMin = new Date(startMs - 5 * 60 * 1000).toISOString();
  const timeMax = new Date(startMs + durationMinutes * 60 * 1000 + 5 * 60 * 1000).toISOString();

  const response = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    timeZone: timezone,
  });

  const events = response.data?.items || [];
  const appointmentId = String(appointment.id || "").trim();
  const patientName = String(appointment.patient_name || "").trim();
  const phone = String(appointment.patient_phone || "").replace(/\D/g, "");

  for (const event of events) {
    const summary = String(event.summary || "");
    const description = String(event.description || "");
    if (appointmentId && description.includes(appointmentId)) {
      return event.id || null;
    }
    const nameMatch = patientName && summary.includes(patientName);
    const phoneMatch = phone && description.replace(/\D/g, "").includes(phone);
    if (nameMatch || phoneMatch) {
      return event.id || null;
    }
  }

  return null;
}

export async function resolveCalendarEventId(appointment) {
  const stored = String(appointment?.google_event_id || "").trim();
  if (stored) return stored;
  return findCalendarEventIdForAppointment(appointment);
}

export async function deleteAppointmentCalendarEvent(appointment) {
  const appointmentId = String(appointment?.id || "").trim();
  const primaryId = await resolveCalendarEventId(appointment);
  const related = appointmentId
    ? await listCalendarEventsForAppointment(appointment, { includeRelatedDates: true })
    : [];
  const eventIds = [
    ...new Set(
      [primaryId, ...related.map((event) => event.id)].filter(Boolean).map(String)
    ),
  ];

  if (!eventIds.length) {
    return { skipped: true, reason: "event_not_found" };
  }

  const results = [];
  for (const eventId of eventIds) {
    results.push(await deleteCalendarEvent(eventId));
  }
  return { deleted: true, eventIds, results };
}

function eventMatchesAppointment(event, appointment) {
  const appointmentId = String(appointment?.id || "").trim();
  const description = String(event?.description || "");
  const summary = String(event?.summary || "");
  const patientName = String(appointment?.patient_name || "").trim();
  const phone = String(appointment?.patient_phone || "").replace(/\D/g, "");

  if (appointmentId && description.includes(appointmentId)) return true;
  if (patientName && summary.includes(patientName)) return true;
  if (phone && description.replace(/\D/g, "").includes(phone)) return true;
  return false;
}

export async function listCalendarEventsForAppointment(
  appointment,
  { previous = null, includeRelatedDates = false } = {}
) {
  if (!isGoogleCalendarConfigured()) return [];

  const dates = [appointment?.date, previous?.date].filter(Boolean);
  if (!dates.length) return [];

  const sortedDates = [...dates].sort();
  const minDate = sortedDates[0];
  const maxDate = sortedDates[sortedDates.length - 1];
  const minMs = appointmentStartMs(minDate, "00:00");
  const maxMs = appointmentStartMs(maxDate, "23:59");
  if (!Number.isFinite(minMs) || !Number.isFinite(maxMs)) return [];

  const { calendar, calendarId, timezone } = getCalendarClient();
  const timeMin = new Date(minMs - 24 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(maxMs + 24 * 60 * 60 * 1000).toISOString();

  const response = await calendar.events.list({
    calendarId,
    timeMin,
    timeMax,
    singleEvents: true,
    orderBy: "startTime",
    timeZone: timezone,
  });

  const events = response.data?.items || [];
  const snapshots = includeRelatedDates
    ? [appointment, previous].filter(Boolean)
    : [appointment];

  return events.filter((event) =>
    snapshots.some((snapshot) => eventMatchesAppointment(event, snapshot))
  );
}

async function deleteStaleCalendarEventsForAppointment(appointment, keepEventId, previous = null) {
  const keep = String(keepEventId || "").trim();
  const related = await listCalendarEventsForAppointment(appointment, {
    previous,
    includeRelatedDates: true,
  });
  const deleted = [];

  for (const event of related) {
    const eventId = String(event?.id || "").trim();
    if (!eventId || eventId === keep) continue;
    deleted.push(await deleteCalendarEvent(eventId));
  }

  if (previous) {
    const previousOnlyId = await findCalendarEventIdForAppointment(previous);
    if (previousOnlyId && previousOnlyId !== keep) {
      deleted.push(await deleteCalendarEvent(previousOnlyId));
    }
  }

  return deleted;
}

export async function moveCalendarEventForReschedule(previous, updated) {
  if (!isGoogleCalendarConfigured()) {
    return { skipped: true, reason: "not_configured" };
  }
  if (!updated) {
    return { skipped: true, reason: "no_appointment" };
  }

  const normalized = validateCalendarAppointments({ appointments: [updated] })[0];
  const { calendar, calendarId, timezone } = getCalendarClient();
  const requestBody = buildCalendarEventRequestBody(normalized, timezone);

  let eventId =
    String(previous?.google_event_id || updated?.google_event_id || "").trim() || null;

  if (!eventId && previous) {
    eventId = (await findCalendarEventIdForAppointment(previous)) || null;
  }
  if (!eventId) {
    const related = await listCalendarEventsForAppointment(updated, {
      previous,
      includeRelatedDates: true,
    });
    eventId = String(related[0]?.id || "").trim() || null;
  }

  let result;
  if (eventId) {
    try {
      const response = await calendar.events.patch({
        calendarId,
        eventId,
        sendUpdates: "none",
        requestBody,
      });
      result = { updated: true, eventId: response.data?.id || eventId };
    } catch (error) {
      const status = error?.code || error?.response?.status;
      if (status !== 404 && status !== 410) throw error;
      eventId = null;
    }
  }

  if (!eventId) {
    const response = await calendar.events.insert({
      calendarId,
      sendUpdates: "none",
      requestBody,
    });
    result = { created: true, eventId: response.data?.id };
  }

  const targetEventId = String(result?.eventId || "").trim();
  const cleanup = await deleteStaleCalendarEventsForAppointment(
    updated,
    targetEventId,
    previous
  );

  return { ...result, moved: true, cleanup };
}

function buildCalendarEventRequestBody(normalized, timezone) {
  return {
    summary: `${normalized.patientName} — ${normalized.treatmentName}`,
    description: normalized.description || undefined,
    location: normalized.location || undefined,
    start: { dateTime: normalized.startDateTime, timeZone: timezone },
    end: { dateTime: normalized.endDateTime, timeZone: timezone },
  };
}

export async function createCalendarEventForAppointment(appointment) {
  return updateCalendarEventForAppointment(appointment);
}

const inflightByAppointment = new Map();

export async function updateCalendarEventForAppointment(appointment) {
  const key =
    String(appointment?.id || "").trim() ||
    [appointment?.date, appointment?.time, appointment?.patient_name].filter(Boolean).join("|");
  if (key && inflightByAppointment.has(key)) {
    return inflightByAppointment.get(key);
  }

  const pending = updateCalendarEventForAppointmentOnce(appointment).finally(() => {
    if (key) inflightByAppointment.delete(key);
  });
  if (key) inflightByAppointment.set(key, pending);
  return pending;
}

async function updateCalendarEventForAppointmentOnce(appointment) {
  if (!isGoogleCalendarConfigured()) {
    return { skipped: true, reason: "not_configured" };
  }

  const normalized = validateCalendarAppointments({ appointments: [appointment] })[0];
  const eventId = await resolveCalendarEventId(appointment);
  const { calendar, calendarId, timezone } = getCalendarClient();
  const requestBody = buildCalendarEventRequestBody(normalized, timezone);

  if (eventId) {
    try {
      const response = await calendar.events.patch({
        calendarId,
        eventId,
        sendUpdates: "none",
        requestBody,
      });
      return { updated: true, eventId: response.data?.id || eventId };
    } catch (error) {
      const status = error?.code || error?.response?.status;
      if (status !== 404 && status !== 410) throw error;
    }
  }

  const response = await calendar.events.insert({
    calendarId,
    sendUpdates: "none",
    requestBody,
  });
  return { created: true, eventId: response.data?.id };
}
