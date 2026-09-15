import { bookingFetch } from "@/lib/bookingMount";
/**
 * Meridian benefit booking + treatment-ID verification against clinic email.
 */

export async function checkMeridianTreatmentId(treatmentId) {
  const response = await bookingFetch("/api/public-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "checkMeridianTreatmentId",
      treatmentId,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "לא ניתן לאשר את המזהה. בדקו את המספר ונסו שוב.");
  }

  return data;
}

export async function createMeridianBooking(booking) {
  const {
    meridianTreatmentId,
    meridianVerificationToken,
    ...rest
  } = booking || {};

  const response = await bookingFetch("/api/public-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "createMeridianBooking",
      booking: rest,
      meridianTreatmentId,
      meridianVerificationToken,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "לא ניתן לשמור את התור");
  }

  return data;
}

/** Admin / legacy: verify pending Meridian appointments against IMAP. */
export async function verifyMeridianTreatmentId({ appointmentIds, treatmentId }) {
  const response = await bookingFetch("/api/public-data", {
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
