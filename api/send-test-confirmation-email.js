import { buildConfirmationEmail } from "../server/emailTemplates.js";
import { getClinicName, isEmailConfigured, sendEmail } from "../server/gmail.js";
import { isAllowedAdminEmail } from "../server/googleAdminAuth.js";

/**
 * Send a sample booking confirmation email for template QA.
 * Restricted to ADMIN_EMAILS allowlist recipients only.
 */
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
    const to = String(body.to || "").trim().toLowerCase();

    if (!to || !isAllowedAdminEmail(to)) {
      res.status(403).json({
        error: "Test confirmation emails may only be sent to allowed admin addresses",
      });
      return;
    }

    const clinicName = getClinicName();
    const appointments = [
      {
        treatment_name: String(body.treatmentName || "מגע שיקומי").trim(),
        date: String(body.date || "2026-09-16").trim(),
        time: String(body.time || "14:30").trim(),
        treatment_price: Number(body.treatmentPrice) || 320,
      },
    ];

    const { subject, html } = buildConfirmationEmail({
      patientName: String(body.patientName || "אסף").trim(),
      appointments,
      clinicName,
    });

    await sendEmail({ to, subject, html });

    res.status(200).json({
      ok: true,
      to,
      subject,
      sample: true,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to send test email" });
  }
}
