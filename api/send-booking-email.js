import {
  buildClinicBookingNotifyEmail,
  buildConfirmationEmail,
} from "../server/emailTemplates.js";
import { getClinicName, isEmailConfigured, sendEmail } from "../server/gmail.js";
import { getBookingNotifyEmails } from "../server/bookingNotify.js";
import { isAllowedAdminEmail } from "../server/googleAdminAuth.js";
import { fetchRecentAppointmentsByIds } from "../server/supabaseServer.js";

/** Allow resend for same-day bookings when explicit appointment IDs are provided. */
const RESEND_MAX_AGE_MS = 48 * 60 * 60 * 1000;

function maskEmail(email) {
  const value = String(email || "").trim();
  const at = value.indexOf("@");
  if (at <= 1) return value ? "***" : "";
  return `${value.slice(0, 2)}***${value.slice(at)}`;
}

function sampleAppointments(body = {}) {
  return [
    {
      treatment_name: String(body.treatmentName || "מגע שיקומי").trim(),
      date: String(body.date || "2026-09-16").trim(),
      time: String(body.time || "14:30").trim(),
      treatment_price: Number(body.treatmentPrice) || 320,
    },
  ];
}

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
    const testTo = String(body.testTo || "").trim().toLowerCase();
    const isAdminTest = Boolean(testTo && isAllowedAdminEmail(testTo));

    if (isAdminTest && !appointmentIds.length) {
      const clinicName = getClinicName();
      const appointments = sampleAppointments(body);
      const { subject, html } = buildConfirmationEmail({
        patientName: String(body.patientName || "אסף").trim(),
        appointments,
        clinicName,
      });
      await sendEmail({ to: testTo, subject, html });
      res.status(200).json({
        ok: true,
        sent: 1,
        test: true,
        patientEmailed: true,
        patientEmailMasked: maskEmail(testTo),
        clinicEmailed: false,
      });
      return;
    }

    if (!appointmentIds.length) {
      res.status(400).json({ error: "appointmentIds required" });
      return;
    }

    const appointments = await fetchRecentAppointmentsByIds(appointmentIds, {
      maxAgeMs: RESEND_MAX_AGE_MS,
    });
    if (!appointments.length) {
      res.status(404).json({ error: "No recent appointments found" });
      return;
    }

    const patientEmail = isAdminTest
      ? testTo
      : String(appointments[0].patient_email || "").trim();
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

    const clinicRecipients = isAdminTest ? [] : getBookingNotifyEmails();
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
      ok: errors.length === 0,
      sent,
      patientEmailed: Boolean(patientEmail),
      patientEmailMasked: patientEmail ? maskEmail(patientEmail) : "",
      clinicEmailed: clinicRecipients.length > 0,
      clinicRecipientsMasked: clinicRecipients.map(maskEmail),
      errors: errors.length ? errors : undefined,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to send email" });
  }
}
