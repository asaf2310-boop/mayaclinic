const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^(\d{1,2}):(\d{2})$/;
const DEFAULT_DURATION_MINUTES = 60;

function pad(value) {
  return String(value).padStart(2, "0");
}

function normalizeTime(time) {
  const match = String(time || "").trim().match(TIME_PATTERN);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes > 59) {
    return null;
  }
  return `${pad(hours)}:${pad(minutes)}:00`;
}

function addMinutesToLocalParts(date, time, minutesToAdd) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const start = new Date(year, month - 1, day, hours, minutes, 0, 0);
  const end = new Date(start.getTime() + minutesToAdd * 60 * 1000);
  return {
    date: `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}`,
    time: `${pad(end.getHours())}:${pad(end.getMinutes())}:00`,
  };
}

export function resolveDurationMinutes(appointment = {}) {
  const explicit = Number(appointment.duration_minutes ?? appointment.durationMinutes);
  if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);

  const name = String(appointment.treatment_name || "");
  const match = name.match(/(\d+)\s*דק/);
  if (match) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return DEFAULT_DURATION_MINUTES;
}

function notesForCalendar(notes) {
  const text = String(notes || "").trim();
  if (!text) return "";
  if (text.startsWith("{") || text.startsWith("[")) return "";
  return text;
}

export function buildEventDescription(appointment) {
  const detailsParts = [];
  const appointmentId = String(appointment?.id || "").trim();
  if (appointmentId) detailsParts.push(`מזהה תור: ${appointmentId}`);
  const treatmentName = appointment?.treatment_name;
  if (treatmentName) detailsParts.push(`טיפול: ${treatmentName}`);

  const notesText = notesForCalendar(appointment?.notes);
  if (notesText) detailsParts.push(notesText);
  if (appointment?.patient_phone) detailsParts.push(`טלפון: ${appointment.patient_phone}`);
  if (appointment?.patient_email) detailsParts.push(`אימייל: ${appointment.patient_email}`);
  return detailsParts.filter(Boolean).join("\n\n");
}

export function validateCalendarAppointments(body) {
  if (!body || typeof body !== "object") {
    const error = new Error("invalid_body");
    error.statusCode = 400;
    throw error;
  }

  const appointments = Array.isArray(body.appointments) ? body.appointments : [];
  if (appointments.length === 0) {
    const error = new Error("appointments_required");
    error.statusCode = 400;
    throw error;
  }
  if (appointments.length > 10) {
    const error = new Error("too_many_appointments");
    error.statusCode = 400;
    throw error;
  }

  return appointments.map((appointment, index) => {
    if (!appointment || typeof appointment !== "object") {
      const error = new Error(`invalid_appointment_${index}`);
      error.statusCode = 400;
      throw error;
    }

    const date = String(appointment.date || "").trim();
    const time = String(appointment.time || "").trim();
    const normalizedTime = normalizeTime(time);

    if (!DATE_PATTERN.test(date) || !normalizedTime) {
      const error = new Error(`invalid_datetime_${index}`);
      error.statusCode = 400;
      throw error;
    }

    const durationMinutes = resolveDurationMinutes(appointment);
    const endParts = addMinutesToLocalParts(date, normalizedTime.slice(0, 5), durationMinutes);

    return {
      id: String(appointment.id || "").trim() || null,
      date,
      time: normalizedTime,
      durationMinutes,
      patientEmail: String(appointment.patient_email || "").trim(),
      patientName: String(appointment.patient_name || "לקוחה").trim() || "לקוחה",
      treatmentName: String(appointment.treatment_name || "תור").trim() || "תור",
      location: String(appointment.location || process.env.CLINIC_LOCATION || "").trim(),
      description: buildEventDescription(appointment),
      startDateTime: `${date}T${normalizedTime}`,
      endDateTime: `${endParts.date}T${endParts.time}`,
    };
  });
}

export { DEFAULT_DURATION_MINUTES };
