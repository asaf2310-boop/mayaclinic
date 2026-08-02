/**
 * Create a clinic appointment for the Meridian benefit flow, then open Meridian pay.
 */
export async function createMeridianBooking(booking) {
  const response = await fetch("/api/public-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "createMeridianBooking",
      booking,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "לא ניתן לשמור את התור");
  }

  return data;
}
