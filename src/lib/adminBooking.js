/**
 * Admin manual appointment create — server sends email/SMS and syncs calendar.
 */

import { bookingFetch } from "@/lib/bookingMount";

function countPersistedAppointments(data = {}) {
  const ids = Array.isArray(data.appointmentIds)
    ? data.appointmentIds.map((id) => String(id || "").trim()).filter(Boolean)
    : [];
  const rows = Array.isArray(data.appointments)
    ? data.appointments.filter((row) => String(row?.id || "").trim())
    : [];
  return Math.max(ids.length, rows.length);
}

export async function createAdminAppointment(booking) {
  const response = await bookingFetch("/api/admin?action=create-appointment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ booking }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "לא ניתן ליצור את התור");
  }

  if (countPersistedAppointments(data) < 1) {
    throw new Error("לא ניתן לשמור את התור");
  }

  return data;
}
