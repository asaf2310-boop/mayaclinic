import { buildConfirmationEmail } from "./lib/emailTemplates.js";
import { getClinicName, isEmailConfigured, sendEmail } from "./lib/gmail.js";
import { fetchRecentAppointmentsByIds } from "./lib/supabaseServer.js";

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

    if (!patientEmail) {
      res.status(400).json({ error: "Patient email missing" });
      return;
    }

    const clinicName = getClinicName();
    const { subject, html } = buildConfirmationEmail({
      patientName,
      appointments,
      clinicName,
    });

    await sendEmail({ to: patientEmail, subject, html });
    res.status(200).json({ ok: true, sent: 1 });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to send email" });
  }
}
