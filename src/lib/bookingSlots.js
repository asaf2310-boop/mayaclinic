/**
 * Minutes blocked after an existing appointment start (treatment + buffer).
 *
 * For each active appointment at time T on date D, slot S (same day) is unavailable when:
 *   forward:  minutes(S) >= minutes(T) AND minutes(S) < minutes(T) + BLOCK_AFTER_MINUTES
 *   backward: minutes(S) < minutes(T) AND minutes(T) - minutes(S) < BLOCK_AFTER_MINUTES
 *   overlap:  minutes(S) < minutes(T) AND minutes(S) + bookingDurationMinutes > minutes(T)
 *
 * Next bookable slot after T is the first configured slot with minutes(S) >= minutes(T) + BLOCK_AFTER_MINUTES
 * (e.g. T=10:00 → blocked through 11:00, next is 11:30 on a 30-min grid; T=19:30 → 21:00 is free).
 */
export const BLOCK_AFTER_MINUTES = 90;

export const timeToMinutes = (time) => {
  const [hours, minutes] = String(time || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

/** Asia/Jerusalem "now" as YYYY-MM-DD + minutes-from-midnight (browser + Node). */
export const getJerusalemNowParts = (now = new Date()) => {
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
};

/**
 * True when `slot` on `date` (YYYY-MM-DD) is already in the past in Asia/Jerusalem.
 * Same-day slots at or before the current minute are not bookable.
 */
export const isSlotInThePast = (slot, date, now = new Date()) => {
  const dateIso = String(date || "").trim();
  if (!dateIso) return false;
  const { dateIso: todayIso, minutes: nowMinutes } = getJerusalemNowParts(now);
  if (dateIso < todayIso) return true;
  if (dateIso > todayIso) return false;
  const slotMinutes = timeToMinutes(slot);
  if (slotMinutes === null) return true;
  return slotMinutes <= nowMinutes;
};

export const getActiveAppointments = (appointments = []) =>
  (Array.isArray(appointments) ? appointments : []).filter(
    (appointment) => appointment.status !== "cancelled"
  );

/**
 * True when `slot` must not be offered because of an existing booking at `appointment.time`.
 * Forward: same start and any slot strictly before BLOCK_AFTER_MINUTES after the booking.
 * Backward: slot starts within BLOCK_AFTER_MINUTES before the booking, or would run into it.
 */
export const isSlotBlockedByAppointment = (
  slot,
  appointment,
  { bookingDurationMinutes = 60 } = {}
) => {
  const slotMinutes = timeToMinutes(slot);
  const appointmentMinutes = timeToMinutes(appointment?.time);
  if (slotMinutes === null || appointmentMinutes === null) return true;

  if (
    slotMinutes >= appointmentMinutes &&
    slotMinutes < appointmentMinutes + BLOCK_AFTER_MINUTES
  ) {
    return true;
  }

  if (
    slotMinutes < appointmentMinutes &&
    appointmentMinutes - slotMinutes < BLOCK_AFTER_MINUTES
  ) {
    return true;
  }

  if (
    slotMinutes < appointmentMinutes &&
    slotMinutes + bookingDurationMinutes > appointmentMinutes
  ) {
    return true;
  }

  return false;
};

export const filterAvailableSlots = (
  slots,
  appointments,
  { bookingDurationMinutes = 60, date = null, now = new Date() } = {}
) => {
  const slotList = Array.isArray(slots) ? slots : [];
  const active = getActiveAppointments(appointments);
  return slotList.filter((slot) => {
    if (date && isSlotInThePast(slot, date, now)) return false;
    return !active.some((appointment) =>
      isSlotBlockedByAppointment(slot, appointment, { bookingDurationMinutes })
    );
  });
};

export const countAvailableSlotsByDate = (
  availabilityRecords,
  appointmentsByDate,
  { bookingDurationMinutes = 60, now = new Date() } = {}
) => {
  const counts = {};
  for (const record of Array.isArray(availabilityRecords) ? availabilityRecords : []) {
    if (!record.is_active || !Array.isArray(record.slots) || !record.slots.length) continue;
    const dayAppointments = appointmentsByDate?.[record.date] || [];
    counts[record.date] = filterAvailableSlots(record.slots, dayAppointments, {
      bookingDurationMinutes,
      date: record.date,
      now,
    }).length;
  }
  return counts;
};

/** Used by demo + DB-style validation before insert. */
export const hasAppointmentTimeConflict = (
  { date, time, id },
  appointments,
  { bookingDurationMinutes = 60 } = {}
) => {
  const sameDay = getActiveAppointments(appointments).filter((existing) => {
    if (existing.date !== date) return false;
    // When both sides lack an id (new booking checks), still compare the slot.
    if (id && existing.id && existing.id === id) return false;
    return true;
  });
  return sameDay.some((existing) =>
    isSlotBlockedByAppointment(time, existing, { bookingDurationMinutes })
  );
};
