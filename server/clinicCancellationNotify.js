import { buildClinicCancellationNotifyEmail } from "./emailTemplates.js";
import { getBookingNotifyEmails } from "./bookingNotify.js";
import { getClinicName, isEmailConfigured, sendEmail } from "./gmail.js";

function resolveActionLabel({ previousStatus, reason }) {
  if (reason === "deleted") return "נמחק";
  const prev = String(previousStatus || "").toLowerCase();
  if (prev === "pending") return "נדחה";
  return "בוטל";
}

/**
 * Notify clinic owner inboxes about a cancelled / declined / deleted appointment.
 * Never throws — booking admin actions must not fail on mail errors.
 */
export async function notifyClinicAppointmentCancelled(appointment, {
  previousStatus = "",
  reason = "cancelled",
  extraNote = "",
} = {}) {
  if (!appointment || !isEmailConfigured()) return { sent: 0 };

  const recipients = getBookingNotifyEmails();
  if (!recipients.length) return { sent: 0 };

  const actionLabel = resolveActionLabel({ previousStatus, reason });
  const clinicName = getClinicName();
  const { subject, html } = buildClinicCancellationNotifyEmail({
    patientName: appointment.patient_name || "",
    patientPhone: appointment.patient_phone || "",
    patientEmail: appointment.patient_email || "",
    appointments: [appointment],
    clinicName,
    actionLabel,
    previousStatus,
    extraNote,
  });

  const results = await Promise.allSettled(
    recipients.map((to) => sendEmail({ to, subject, html }))
  );

  const failures = results.filter((result) => result.status === "rejected");
  for (const failure of failures) {
    console.error(
      "Clinic cancellation notify failed:",
      failure.reason?.message || failure.reason
    );
  }

  return {
    sent: results.length - failures.length,
    actionLabel,
    recipients,
  };
}
