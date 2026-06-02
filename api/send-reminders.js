import { buildReminderEmail } from "./lib/emailTemplates.js";
import { getClinicName, isEmailConfigured, sendEmail } from "./lib/gmail.js";
import {
  fetchTomorrowAppointmentsNeedingReminder,
  markReminderSent,
} from "./lib/supabaseServer.js";

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const auth = req.headers.authorization || "";
  return auth === `Bearer ${secret}`;
}

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!isEmailConfigured()) {
    res.status(503).json({ error: "Email is not configured" });
    return;
  }

  try {
    const appointments = await fetchTomorrowAppointmentsNeedingReminder();
    const clinicName = getClinicName();
    let sent = 0;

    for (const appointment of appointments) {
      const { subject, html } = buildReminderEmail({
        patientName: appointment.patient_name,
        appointments: [appointment],
        clinicName,
      });

      await sendEmail({
        to: appointment.patient_email,
        subject,
        html,
      });

      await markReminderSent(appointment.id);
      sent += 1;
    }

    res.status(200).json({ ok: true, sent, total: appointments.length });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to send reminders" });
  }
}
