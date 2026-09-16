import { bookingFetch } from "@/lib/bookingMount";
import { getBookingAnalyticsContext } from "@/lib/ofirbabyAnalytics";
/**
 * Movement (מובמנט) booking — confirm without credit/PayBox payment.
 */

export async function createMovementBooking(booking) {
  const response = await bookingFetch("/api/public-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "createMovementBooking",
      booking: { ...booking, analytics: getBookingAnalyticsContext() },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "לא ניתן לשמור את התור");
  }

  return data;
}
