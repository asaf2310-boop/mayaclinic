/**
 * Customer + clinic emails after self-service reschedule/cancel.
 * Runs after DB commit. Failures are logged; booking state stays correct.
 * Idempotent via appointment_change_events claim columns when present.
 */

import {
  buildCustomerCancellationEmail,
  buildCustomerRescheduleEmail,
  buildClinicRescheduleNotifyEmail,
  buildClinicCancellationNotifyEmail,
} from "./emailTemplates.js";
import { getBookingNotifyEmails } from "./bookingNotify.js";
import { getClinicName, isEmailConfigured, sendEmail } from "./gmail.js";
import { canClaimEmailDelivery, buildEmailClaimOrFilter } from "./emailClaim.js";
import { supabaseRequest } from "./supabaseServer.js";

async function claimEventEmail(eventId, kind) {
  if (!eventId) return true; // no event row — send once best-effort

  const statusCol = kind === "customer" ? "customer_email_status" : "clinic_email_status";
  const claimedCol =
    kind === "customer" ? "customer_email_claimed_at" : "clinic_email_claimed_at";
  const now = new Date();
  const orFilter = buildEmailClaimOrFilter(statusCol, claimedCol, now);

  try {
    const rows = await supabaseRequest(
      `appointment_change_events?id=eq.${encodeURIComponent(eventId)}&${orFilter}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          [statusCol]: "sending",
          [claimedCol]: now.toISOString(),
        }),
      }
    );
    const row = Array.isArray(rows) ? rows[0] : rows;
    return Boolean(row);
  } catch (error) {
    console.warn("[self-service-notify] claim failed:", error?.message || error);
    // If claim table/columns missing, allow send (best-effort).
    return true;
  }
}

async function markEventEmail(eventId, kind, { status, error = null } = {}) {
  if (!eventId) return;
  const statusCol = kind === "customer" ? "customer_email_status" : "clinic_email_status";
  const claimedCol =
    kind === "customer" ? "customer_email_claimed_at" : "clinic_email_claimed_at";
  const sentCol = kind === "customer" ? "customer_email_sent_at" : "clinic_email_sent_at";
  const errCol =
    kind === "customer" ? "customer_email_last_error" : "clinic_email_last_error";

  const patch = {
    [statusCol]: status,
    [claimedCol]: null,
  };
  if (status === "sent") patch[sentCol] = new Date().toISOString();
  if (error) patch[errCol] = String(error).slice(0, 240);

  try {
    await supabaseRequest(`appointment_change_events?id=eq.${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  } catch (err) {
    console.warn("[self-service-notify] mark failed:", err?.message || err);
  }
}

/**
 * @param {{
 *   event: object | null,
 *   eventType: 'reschedule' | 'cancel',
 *   appointment: object,
 *   previous: object,
 * }} args
 */
export async function notifySelfServiceChange({
  event = null,
  eventType,
  appointment,
  previous,
} = {}) {
  if (!appointment || !isEmailConfigured()) {
    return { skipped: true, reason: "no_appointment_or_email" };
  }

  const clinicName = getClinicName();
  const eventId = event?.id || null;
  const results = { customer: null, clinic: null };

  // --- Customer ---
  const patientEmail = String(appointment.patient_email || previous?.patient_email || "").trim();
  if (patientEmail) {
    const claimable =
      !event ||
      canClaimEmailDelivery({
        status: event.customer_email_status,
        claimedAt: event.customer_email_claimed_at,
        sentAt: event.customer_email_sent_at,
      });

    if (claimable && (await claimEventEmail(eventId, "customer"))) {
      try {
        const built =
          eventType === "cancel"
            ? buildCustomerCancellationEmail({
                patientName: appointment.patient_name,
                appointment,
                clinicName,
              })
            : buildCustomerRescheduleEmail({
                patientName: appointment.patient_name,
                previous,
                appointment,
                clinicName,
              });
        await sendEmail({ to: patientEmail, subject: built.subject, html: built.html });
        await markEventEmail(eventId, "customer", { status: "sent" });
        results.customer = { ok: true };
      } catch (error) {
        await markEventEmail(eventId, "customer", {
          status: "temporary_failure",
          error: error?.message || error,
        });
        results.customer = { ok: false, error: error?.message || String(error) };
        console.error("[self-service-notify] customer email failed:", error?.message || error);
      }
    }
  } else {
    results.customer = { ok: false, skipped: true, reason: "no_customer_email" };
  }

  // --- Clinic ---
  const recipients = getBookingNotifyEmails();
  if (recipients.length) {
    const claimable =
      !event ||
      canClaimEmailDelivery({
        status: event.clinic_email_status,
        claimedAt: event.clinic_email_claimed_at,
        sentAt: event.clinic_email_sent_at,
      });

    if (claimable && (await claimEventEmail(eventId, "clinic"))) {
      try {
        const built =
          eventType === "cancel"
            ? buildClinicCancellationNotifyEmail({
                patientName: appointment.patient_name || "",
                patientPhone: appointment.patient_phone || "",
                patientEmail: appointment.patient_email || "",
                appointments: [appointment],
                clinicName,
                actionLabel: "בוטל ע״י הלקוח",
                previousStatus: previous?.status || "",
                extraNote: "הלקוח ביטל את התור דרך האתר (שירות עצמי).",
              })
            : buildClinicRescheduleNotifyEmail({
                patientName: appointment.patient_name || "",
                patientPhone: appointment.patient_phone || "",
                patientEmail: appointment.patient_email || "",
                previous,
                appointment,
                clinicName,
              });

        const settled = await Promise.allSettled(
          recipients.map((to) => sendEmail({ to, subject: built.subject, html: built.html }))
        );
        const failures = settled.filter((r) => r.status === "rejected");
        if (failures.length === settled.length) {
          throw failures[0]?.reason || new Error("clinic_email_failed");
        }
        await markEventEmail(eventId, "clinic", { status: "sent" });
        results.clinic = { ok: true, sent: settled.length - failures.length };
      } catch (error) {
        await markEventEmail(eventId, "clinic", {
          status: "temporary_failure",
          error: error?.message || error,
        });
        results.clinic = { ok: false, error: error?.message || String(error) };
        console.error("[self-service-notify] clinic email failed:", error?.message || error);
      }
    }
  }

  return results;
}
