/**
 * Cash on arrival — confirm booking without online payment.
 * Patient pays at the clinic; confirmation emails are sent immediately.
 */

export async function createCashBooking(booking) {
  const response = await fetch("/api/public-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "createCashBooking",
      booking,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "לא ניתן לשמור את התור");
  }

  return data;
}
