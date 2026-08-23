import {
  buildClinicBookingNotifyEmail,
  buildConfirmationEmail,
} from "../server/emailTemplates.js";
import { getClinicName, isEmailConfigured, sendEmail } from "../server/gmail.js";
import { getBookingNotifyEmails } from "../server/bookingNotify.js";
import { fetchRecentAppointmentsByIds } from "../server/supabaseServer.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!isEmailConfigured()) {
    res.status(503).json({ error: "Email is not configured" });
    return;
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const appointmentIds = Array.isArray(body.appointmentIds) ? body.appointmentIds : [];

    if (!appointmentIds.length) {
      res.status(400).json({ error: "appointmentIds required" });
      return;
    }

    const appointments = await fetchRecentAppointmentsByIds(appointmentIds);
    if (!appointments.length) {
      res.status(404).json({ error: "No recent appointments found" });
      return;
    }

    const patientEmail = String(appointments[0].patient_email || "").trim();
    const patientName = appointments[0].patient_name || "";
    const clinicName = getClinicName();
    let sent = 0;
    const errors = [];

    if (patientEmail) {
      try {
        const { subject, html } = buildConfirmationEmail({
          patientName,
          appointments,
          clinicName,
        });
        await sendEmail({ to: patientEmail, subject, html });
        sent += 1;
      } catch (error) {
        errors.push(`patient: ${error.message || error}`);
      }
    }

    const clinicRecipients = getBookingNotifyEmails();
    if (clinicRecipients.length) {
      try {
        const first = appointments[0] || {};
        const clinicMail = buildClinicBookingNotifyEmail({
          patientName: first.patient_name || patientName,
          patientPhone: first.patient_phone || "",
          patientEmail: first.patient_email || patientEmail,
          appointments,
          clinicName,
          sourceLabel: "האתר",
        });
        await Promise.all(
          clinicRecipients.map((to) =>
            sendEmail({ to, subject: clinicMail.subject, html: clinicMail.html })
          )
        );
        sent += clinicRecipients.length;
      } catch (error) {
        errors.push(`clinic: ${error.message || error}`);
      }
    }

    if (!patientEmail && !clinicRecipients.length) {
      res.status(400).json({ error: "No email recipients" });
      return;
    }

    res.status(200).json({
      ok: true,
      sent,
      patientEmailed: Boolean(patientEmail),
      clinicEmailed: clinicRecipients.length > 0,
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to send email" });
  }
}
