/** Minutes blocked after an existing appointment start (treatment + buffer). */
export const BLOCK_AFTER_MINUTES = 90;

export const timeToMinutes = (time) => {
  const [hours, minutes] = String(time || "").split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

export const getActiveAppointments = (appointments = []) =>
  appointments.filter((appointment) => appointment.status !== "cancelled");

/**
 * True when `slot` must not be offered because of an existing booking at `appointment.time`.
 * Forward: same start and any slot up to BLOCK_AFTER_MINUTES after the booking.
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
    slotMinutes <= appointmentMinutes + BLOCK_AFTER_MINUTES
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
  { bookingDurationMinutes = 60 } = {}
) => {
  const active = getActiveAppointments(appointments);
  return (slots || []).filter(
    (slot) =>
      !active.some((appointment) =>
        isSlotBlockedByAppointment(slot, appointment, { bookingDurationMinutes })
      )
  );
};

export const countAvailableSlotsByDate = (
  availabilityRecords,
  appointmentsByDate,
  { bookingDurationMinutes = 60 } = {}
) => {
  const counts = {};
  for (const record of availabilityRecords || []) {
    if (!record.is_active || !record.slots?.length) continue;
    const dayAppointments = appointmentsByDate[record.date] || [];
    counts[record.date] = filterAvailableSlots(record.slots, dayAppointments, {
      bookingDurationMinutes,
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
  const sameDay = getActiveAppointments(appointments).filter(
    (existing) => existing.date === date && existing.id !== id
  );
  return sameDay.some((existing) =>
    isSlotBlockedByAppointment(time, existing, { bookingDurationMinutes })
  );
};
