/**
 * Cash on arrival — confirm booking without online payment.
 * Patient pays at the clinic; confirmation emails are sent immediately.
 */

import { bookingFetch } from "@/lib/bookingMount";
import { getBookingAnalyticsContext } from "@/lib/ofirbabyAnalytics";

function countPersistedAppointments(data = {}) {
  const ids = Array.isArray(data.appointmentIds)
    ? data.appointmentIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  const rows = Array.isArray(data.appointments)
    ? data.appointments.filter((row) => String(row?.id || "").trim())
    : [];
  return Math.max(ids.length, rows.length);
}

export async function createCashBooking(booking) {
  const response = await bookingFetch("/api/public-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "createCashBooking",
      booking: { ...booking, analytics: getBookingAnalyticsContext() },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "לא ניתן לשמור את התור");
  }

  // Never treat an empty create as success (blocks false confirmation UI).
  if (countPersistedAppointments(data) < 1) {
    throw new Error("לא ניתן לשמור את התור");
  }

  return data;
}
