import { buildReminderEmail } from "../server/emailTemplates.js";
import { getClinicName, isEmailConfigured } from "../server/gmail.js";
import {
  MAX_EMAIL_ATTEMPTS,
  isAppointmentReminderEligible,
  isReminderIneligibilityTerminal,
  sendPatientEmail,
} from "../server/emailDelivery.js";
import { normalizeIsraeliMobile } from "../server/israeliPhone.js";
import { sendSms019 } from "../server/sms019.js";
import {
  buildAppointmentReminderSms,
  canSendLiveSmsReminders,
  fetchSmsReminderSettings,
  getReminderTargetDateIso,
  isSmsReminderAppointmentEligible,
  isSmsReminderIneligibilityTerminal,
} from "../server/smsReminders.js";
import {
  claimReminderSend,
  claimSmsReminderSend,
  fetchAppointmentById,
  fetchAppointmentsNeedingSmsReminder,
  fetchTomorrowAppointmentsNeedingReminder,
  markReminderOutcome,
  markSmsReminderOutcome,
} from "../server/supabaseServer.js";
import { retryFailedAppointmentChangeNotifies } from "../server/appointmentChangeNotify.js";

function isAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";

  const auth = req.headers.authorization || "";
  return auth === `Bearer ${secret}`;
}

async function processEmailReminders() {
  if (!isEmailConfigured()) {
    return { ok: false, skipped: true, reason: "email_not_configured", sent: 0, skippedCount: 0, failed: 0, total: 0 };
  }

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
        // Only terminal-skip cancelled/past appointments. Soft skips (e.g. odd
        // same-day time text) must not permanently block a later retry.
        if (isReminderIneligibilityTerminal(latest)) {
          await markReminderOutcome(latest.id, {
            status: "cancelled",
            error: "ineligible_or_expired",
            attempts: Number(latest.reminder_email_attempts || 0),
          });
        }
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

  return {
    ok: true,
    sent,
    skippedCount: skipped,
    failed,
    total: candidates.length,
  };
}

async function processSmsReminders() {
  const settings = await fetchSmsReminderSettings("maya");
  if (!canSendLiveSmsReminders(settings)) {
    return {
      ok: true,
      skipped: true,
      reason: "sms_reminders_disabled",
      gate: {
        envEnabled: process.env.SMS_REMINDERS_ENABLED || "false",
        adminEnabled: Boolean(settings?.enabled),
        migrationMissing: Boolean(settings?.migrationMissing),
      },
      sent: 0,
      skippedCount: 0,
      failed: 0,
      total: 0,
    };
  }

  const targetDate = getReminderTargetDateIso(settings.lead_hours);
  const candidates = await fetchAppointmentsNeedingSmsReminder(targetDate);
  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const candidate of candidates) {
    let claimed = null;
    let providerAccepted = false;
    let shipmentId = null;
    let attempts = 0;
    try {
      const latest = await fetchAppointmentById(candidate.id);
      if (!latest) {
        skipped += 1;
        continue;
      }

      if (!isSmsReminderAppointmentEligible(latest)) {
        if (isSmsReminderIneligibilityTerminal(latest)) {
          await markSmsReminderOutcome(latest.id, {
            status: "cancelled",
            error: "ineligible_or_expired",
            attempts: Number(latest.reminder_sms_attempts || 0),
          });
        } else if (!normalizeIsraeliMobile(latest.patient_phone).ok) {
          await markSmsReminderOutcome(latest.id, {
            status: "invalid_phone",
            error: "invalid_israeli_mobile",
            attempts: Number(latest.reminder_sms_attempts || 0),
          });
        }
        skipped += 1;
        continue;
      }

      attempts = Number(latest.reminder_sms_attempts || 0);
      claimed = await claimSmsReminderSend(latest.id);
      if (!claimed) {
        skipped += 1;
        continue;
      }

      // Re-check cancel after claim (race with admin cancel).
      if (String(claimed.status || "") === "cancelled" || String(claimed.status || "") === "completed") {
        await markSmsReminderOutcome(claimed.id, {
          status: "cancelled",
          error: "cancelled_after_claim",
          attempts,
        });
        skipped += 1;
        continue;
      }

      const phoneCheck = normalizeIsraeliMobile(claimed.patient_phone);
      if (!phoneCheck.ok) {
        await markSmsReminderOutcome(claimed.id, {
          status: "invalid_phone",
          error: phoneCheck.error,
          attempts: attempts + 1,
        });
        skipped += 1;
        continue;
      }

      const message = buildAppointmentReminderSms({
        patientName: claimed.patient_name,
        date: claimed.date,
        time: claimed.time,
        clinicAddress: settings.clinic_address,
        template: settings.reminder_template,
      });

      const result = await sendSms019({
        phone: phoneCheck.normalized,
        message,
        externalId: claimed.id,
        useTestEndpoint: false,
        campaignName: "appointment-reminder",
      });

      const nextAttempts = attempts + 1;

      if (result.ok && result.accepted) {
        providerAccepted = true;
        shipmentId = result.shipmentId || null;
        await markSmsReminderOutcome(claimed.id, {
          status: "accepted",
          attempts: nextAttempts,
          error: null,
          shipmentId,
        });
        sent += 1;
        continue;
      }

      // Definitive provider / validation failure — no auto-retry (avoids duplicates).
      await markSmsReminderOutcome(claimed.id, {
        status: "permanent_failure",
        attempts: nextAttempts,
        error: result.error || result.message || "sms_send_failed",
        shipmentId: result.shipmentId || null,
      });
      failed += 1;
    } catch (error) {
      failed += 1;
      console.error(
        "sms reminder send failed:",
        String(error?.message || error).slice(0, 200)
      );
      if (claimed?.id) {
        try {
          if (providerAccepted) {
            await markSmsReminderOutcome(claimed.id, {
              status: "accepted",
              attempts: attempts + 1,
              error: "outcome_write_failed_after_accept",
              shipmentId,
            });
          } else {
            // Uncertain / interrupted: do NOT auto-retry (could double-send).
            await markSmsReminderOutcome(claimed.id, {
              status: "temporary_failure",
              attempts: attempts + 1,
              error: "send_interrupted_no_retry",
            });
          }
        } catch {
          // Leave for stale-claim reclaim only if still `sending`.
        }
      }
    }
  }

  return {
    ok: true,
    targetDate,
    leadHours: settings.lead_hours,
    sent,
    skippedCount: skipped,
    failed,
    total: candidates.length,
  };
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

  const emailConfigured = isEmailConfigured();
  // SMS may run independently when env+admin gates allow; email remains default path.
  let smsSettings;
  try {
    smsSettings = await fetchSmsReminderSettings("maya");
  } catch {
    smsSettings = { enabled: false };
  }
  const smsMayRun = canSendLiveSmsReminders(smsSettings);

  try {
    // Always attempt change-notify retries (independent of reminder env gates).
    let changeNotify = { ok: true, skipped: true, reason: "not_run", retried: 0 };
    try {
      changeNotify = await retryFailedAppointmentChangeNotifies({ limit: 25 });
    } catch (error) {
      console.error(
        "[send-reminders] change-notify retry failed:",
        error?.message || error
      );
      changeNotify = {
        ok: false,
        error: error?.message || String(error),
        retried: 0,
      };
    }

    if (!emailConfigured && !smsMayRun) {
      res.status(200).json({
        ok: true,
        skipped: true,
        reason: "reminders_not_configured",
        emailConfigured: false,
        smsRemindersEnabled: false,
        changeNotify,
      });
      return;
    }

    const email = emailConfigured
      ? await processEmailReminders()
      : { ok: true, skipped: true, reason: "email_not_configured", sent: 0, skippedCount: 0, failed: 0, total: 0 };
    const sms = await processSmsReminders();

    res.status(200).json({
      ok: true,
      // Backward-compatible top-level email counters
      sent: email.sent,
      skipped: email.skippedCount,
      failed: email.failed,
      total: email.total,
      email,
      sms,
      changeNotify,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to send reminders" });
  }
}
