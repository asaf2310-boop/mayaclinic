/**
 * Meridian benefit booking + treatment-ID verification against clinic email.
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

export async function verifyMeridianTreatmentId({ appointmentIds, treatmentId }) {
  const response = await fetch("/api/public-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "verifyMeridianTreatmentId",
      appointmentIds,
      treatmentId,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "לא ניתן לאשר את המזהה. בדקו את המספר ונסו שוב.");
  }

  return data;
}
