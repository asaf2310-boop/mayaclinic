/**
 * Cash on arrival — confirm booking without online payment.
 * Patient pays at the clinic; confirmation emails are sent immediately.
 */

import { bookingFetch } from "@/lib/bookingMount";
import { getBookingAnalyticsContext } from "@/lib/ofirbabyAnalytics";

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

  return data;
}
