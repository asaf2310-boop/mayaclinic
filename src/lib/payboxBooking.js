/**
 * PayBox external link — create the appointment + confirmation emails first,
 * then the UI opens the clinic PayBox URL. No server webhook exists for these
 * static PayBox links, so payment is not verified (paid stays false).
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

export async function createPayboxBooking(booking) {
  const response = await bookingFetch("/api/public-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "createPayboxBooking",
      booking: { ...booking, analytics: getBookingAnalyticsContext() },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "לא ניתן לשמור את התור");
  }

  if (countPersistedAppointments(data) < 1) {
    throw new Error("לא ניתן לשמור את התור");
  }

  return data;
}
