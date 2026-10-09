import { buildReminderEmail } from "../server/emailTemplates.js";
import { getClinicName, isEmailConfigured } from "../server/gmail.js";
import {
  MAX_EMAIL_ATTEMPTS,
  isAppointmentReminderEligible,
  sendPatientEmail,
} from "../server/emailDelivery.js";
import {
  claimReminderSend,
  fetchAppointmentById,
  fetchTomorrowAppointmentsNeedingReminder,
  markReminderOutcome,
} from "../server/supabaseServer.js";

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
    const candidates = await fetchTomorrowAppointmentsNeedingReminder();
    const clinicName = getClinicName();
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const candidate of candidates) {
      let claimed = null;
      let smtpAccepted = false;
      let attempts = 0;
      try {
        // Re-fetch latest row before any send (cancel / reschedule / past start).
        const latest = await fetchAppointmentById(candidate.id);
        if (!latest) {
          skipped += 1;
          continue;
        }

        if (!isAppointmentReminderEligible(latest)) {
          await markReminderOutcome(latest.id, {
            status: "cancelled",
            error: "ineligible_or_expired",
            attempts: Number(latest.reminder_email_attempts || 0),
          });
          skipped += 1;
          continue;
        }

        attempts = Number(latest.reminder_email_attempts || 0);
        if (attempts >= MAX_EMAIL_ATTEMPTS) {
          await markReminderOutcome(latest.id, {
            status: "permanent_failure",
            error: "max_attempts",
            attempts,
          });
          skipped += 1;
          continue;
        }

        claimed = await claimReminderSend(latest.id);
        if (!claimed) {
          skipped += 1;
          continue;
        }

        const emailContent = buildReminderEmail({
          patientName: claimed.patient_name,
          appointments: [claimed],
          clinicName,
        });
        const result = await sendPatientEmail({
          to: claimed.patient_email,
          subject: emailContent.subject,
          html: emailContent.html,
          appointmentId: claimed.id,
          requireValid: true,
        });

        const nextAttempts = attempts + 1;

        if (result.ok) {
          smtpAccepted = true;
          await markReminderOutcome(claimed.id, {
            status: "accepted",
            attempts: nextAttempts,
            error: null,
          });
          sent += 1;
          continue;
        }

        if (result.status === "suppressed" || result.status === "cancelled") {
          await markReminderOutcome(claimed.id, {
            status: result.status,
            attempts: nextAttempts,
            error: result.error,
          });
          skipped += 1;
          continue;
        }

        if (result.status === "permanent_failure" || !result.retryable) {
          await markReminderOutcome(claimed.id, {
            status: "permanent_failure",
            attempts: nextAttempts,
            error: result.error,
          });
          failed += 1;
          continue;
        }

        // Transient: release claim so a later cron can retry.
        // Do NOT set reminder_sent_at.
        await markReminderOutcome(claimed.id, {
          status:
            nextAttempts >= MAX_EMAIL_ATTEMPTS
              ? "permanent_failure"
              : "temporary_failure",
          attempts: nextAttempts,
          error: result.error,
        });
        failed += 1;
      } catch (error) {
        failed += 1;
        console.error(
          "reminder send failed:",
          String(error?.message || error).slice(0, 200)
        );
        // Release or finalize claim so reminders are not stuck in `sending`.
        if (claimed?.id) {
          try {
            if (smtpAccepted) {
              // SMTP accepted but outcome write failed — prefer accepted to avoid duplicate.
              await markReminderOutcome(claimed.id, {
                status: "accepted",
                attempts: attempts + 1,
                error: "outcome_write_failed_after_accept",
              });
            } else {
              await markReminderOutcome(claimed.id, {
                status: "temporary_failure",
                attempts,
                error: "send_interrupted",
              });
            }
          } catch {
            // Leave for stale-claim reclaim after STALE_EMAIL_CLAIM_MS.
          }
        }
      }
    }

    res.status(200).json({
      ok: true,
      sent,
      skipped,
      failed,
      total: candidates.length,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to send reminders" });
  }
}
