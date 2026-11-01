/**
 * Durable Google Calendar sync for appointment_change_events (reschedule/cancel).
 *
 * Immediate sync still runs after DB commit; failures are persisted on the change
 * event and retried from /api/send-reminders. Retries are idempotent: they never
 * overwrite a newer slot or recreate a cancelled appointment.
 */

import { canClaimEmailDelivery, buildEmailClaimOrFilter } from "./emailClaim.js";
import { supabaseRequest } from "./supabaseServer.js";
import { syncClinicCalendarForAppointment } from "./syncClinicCalendar.js";

const MAX_CALENDAR_SYNC_ATTEMPTS = 12;

/**
 * Strip credentials / tokens from provider errors before DB/log persistence.
 */
export function sanitizeCalendarSyncError(error) {
  let msg = String(error?.message || error || "calendar_sync_failed");
  msg = msg.replace(/Bearer\s+\S+/gi, "Bearer [redacted]");
  msg = msg.replace(/ya29\.[0-9A-Za-z._\-]+/g, "[redacted_oauth]");
  msg = msg.replace(/AIza[0-9A-Za-z_\-]+/g, "[redacted_key]");
  msg = msg.replace(/-----BEGIN[\s\S]*?-----END[^-]*-----/g, "[redacted_pem]");
  msg = msg.replace(
    /(client_secret|refresh_token|access_token|private_key|api[_-]?key)["'\s:=]+["']?[^"',\s}]+/gi,
    "$1=[redacted]"
  );
  return msg.slice(0, 240);
}

function normTime(value) {
  return String(value || "")
    .trim()
    .slice(0, 5);
}

function normDate(value) {
  return String(value || "").trim();
}

function normStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

/**
 * Decide whether a delayed calendar job may still mutate GCal for this event.
 * Pure — safe for unit tests.
 *
 * @returns {{
 *   apply: boolean,
 *   action?: 'reschedule' | 'delete',
 *   reason?: string,
 *   terminalStatus?: 'skipped_stale' | 'synced',
 *   appointment?: object,
 *   previous?: object | null,
 * }}
 */
export function resolveCalendarRetryDecision(event, appointment) {
  const eventType = String(event?.event_type || "").trim();
  const after =
    event?.after_snapshot && typeof event.after_snapshot === "object"
      ? event.after_snapshot
      : {};
  const before =
    event?.before_snapshot && typeof event.before_snapshot === "object"
      ? event.before_snapshot
      : {};

  if (eventType !== "reschedule" && eventType !== "cancel") {
    return { apply: false, reason: "unsupported_event_type", terminalStatus: "skipped_stale" };
  }

  // Appointment hard-deleted (admin DELETE) — cancel may still need GCal cleanup.
  if (!appointment) {
    if (eventType === "cancel") {
      return {
        apply: true,
        action: "delete",
        appointment: {
          id: event.appointment_id,
          ...before,
          status: "cancelled",
          google_event_id: before.google_event_id || null,
        },
        previous: null,
      };
    }
    return { apply: false, reason: "appointment_missing", terminalStatus: "skipped_stale" };
  }

  const currentStatus = normStatus(appointment.status);
  const currentDate = normDate(appointment.date);
  const currentTime = normTime(appointment.time);
  const afterDate = normDate(after.date);
  const afterTime = normTime(after.time);
  const afterStatus = normStatus(after.status);

  if (eventType === "reschedule") {
    // Do not recreate / move calendar for a cancelled appointment.
    if (currentStatus === "cancelled") {
      return { apply: false, reason: "now_cancelled", terminalStatus: "skipped_stale" };
    }
    // Newer reschedule (or other edit) moved the slot — this job is stale.
    if (
      (afterDate && currentDate && currentDate !== afterDate) ||
      (afterTime && currentTime && currentTime !== afterTime)
    ) {
      return { apply: false, reason: "newer_slot", terminalStatus: "skipped_stale" };
    }
    // updated_at newer than this event AND status/slot drifted from after_snapshot.
    const eventCreatedMs = new Date(event.created_at || 0).getTime();
    const apptUpdatedMs = new Date(appointment.updated_at || 0).getTime();
    if (
      Number.isFinite(eventCreatedMs) &&
      Number.isFinite(apptUpdatedMs) &&
      apptUpdatedMs > eventCreatedMs + 1000 &&
      afterStatus &&
      currentStatus &&
      currentStatus !== afterStatus
    ) {
      return { apply: false, reason: "newer_status", terminalStatus: "skipped_stale" };
    }

    return {
      apply: true,
      action: "reschedule",
      appointment: {
        ...appointment,
        google_event_id:
          appointment.google_event_id || before.google_event_id || after.google_event_id || null,
      },
      previous: Object.keys(before).length
        ? {
            ...before,
            id: appointment.id,
            google_event_id: before.google_event_id || appointment.google_event_id || null,
          }
        : null,
    };
  }

  // cancel
  if (currentStatus !== "cancelled") {
    // Do not delete GCal if appointment was reactivated / no longer cancelled.
    return { apply: false, reason: "not_cancelled_anymore", terminalStatus: "skipped_stale" };
  }

  // Already cleared and after_snapshot expected cancel — still attempt delete (idempotent 404).
  return {
    apply: true,
    action: "delete",
    appointment: {
      ...appointment,
      google_event_id:
        appointment.google_event_id || before.google_event_id || after.google_event_id || null,
    },
    previous: null,
  };
}

export async function claimCalendarSync(eventId, now = new Date()) {
  if (!eventId) return true;
  const orFilter = buildEmailClaimOrFilter(
    "calendar_sync_status",
    "calendar_sync_claimed_at",
    now
  );
  try {
    const rows = await supabaseRequest(
      `appointment_change_events?id=eq.${encodeURIComponent(eventId)}&${orFilter}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          calendar_sync_status: "sending",
          calendar_sync_claimed_at: now.toISOString(),
        }),
      }
    );
    const row = Array.isArray(rows) ? rows[0] : rows;
    return Boolean(row);
  } catch (error) {
    const message = String(error?.message || error || "");
    if (/calendar_sync_/i.test(message) || (/column/i.test(message) && /calendar/i.test(message))) {
      // Pre-migration: allow one attempt without durable claim.
      return true;
    }
    console.warn("[calendar-change-sync] claim failed:", sanitizeCalendarSyncError(error));
    return true;
  }
}

export async function markCalendarSyncOutcome(
  eventId,
  { status, error = null, bumpAttempts = false } = {}
) {
  if (!eventId || !status) return;

  const patch = {
    calendar_sync_status: status,
    calendar_sync_claimed_at: null,
  };
  if (status === "synced") {
    patch.calendar_sync_synced_at = new Date().toISOString();
    patch.calendar_sync_last_error = null;
  }
  if (error) patch.calendar_sync_last_error = sanitizeCalendarSyncError(error);

  try {
    if (bumpAttempts) {
      // Read-modify-write is acceptable here; claim already serializes workers.
      const rows = await supabaseRequest(
        `appointment_change_events?id=eq.${encodeURIComponent(eventId)}&select=calendar_sync_attempts&limit=1`
      );
      const current = Array.isArray(rows) ? rows[0] : rows;
      const attempts = Number(current?.calendar_sync_attempts || 0) + 1;
      patch.calendar_sync_attempts = attempts;
      if (
        status === "temporary_failure" &&
        attempts >= MAX_CALENDAR_SYNC_ATTEMPTS
      ) {
        patch.calendar_sync_status = "permanent_failure";
      }
    }

    await supabaseRequest(`appointment_change_events?id=eq.${encodeURIComponent(eventId)}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    });
  } catch (err) {
    const message = String(err?.message || err || "");
    if (/calendar_sync_/i.test(message) || (/column/i.test(message) && /calendar/i.test(message))) {
      return;
    }
    console.warn("[calendar-change-sync] mark failed:", sanitizeCalendarSyncError(err));
  }
}

/**
 * Run (or re-run) clinic calendar sync for a change event and persist outcome.
 */
export async function syncCalendarForChangeEvent({
  event = null,
  appointment,
  previous = null,
  action = null,
} = {}) {
  const eventId = event?.id || null;
  const resolvedAction =
    action ||
    (String(event?.event_type || "") === "cancel"
      ? "delete"
      : String(event?.event_type || "") === "reschedule"
        ? "reschedule"
        : "sync");

  if (eventId) {
    const claimable =
      !event ||
      canClaimEmailDelivery({
        status: event.calendar_sync_status,
        claimedAt: event.calendar_sync_claimed_at,
        sentAt: event.calendar_sync_synced_at,
      });
    if (!claimable) {
      if (
        event?.calendar_sync_synced_at ||
        event?.calendar_sync_status === "synced" ||
        event?.calendar_sync_status === "skipped_stale"
      ) {
        return { ok: true, already: true, status: event.calendar_sync_status };
      }
      return { skipped: true, reason: "not_claimable" };
    }
    const claimed = await claimCalendarSync(eventId);
    if (!claimed) return { skipped: true, reason: "claim_lost" };
  }

  const result = await syncClinicCalendarForAppointment(appointment, {
    action: resolvedAction,
    previous,
  });

  if (result?.error) {
    await markCalendarSyncOutcome(eventId, {
      status: "temporary_failure",
      error: result.message || "calendar_sync_failed",
      bumpAttempts: true,
    });
    return { ...result, ok: false };
  }

  if (result?.skipped && result?.reason === "not_configured_or_no_appointment") {
    await markCalendarSyncOutcome(eventId, {
      status: "synced",
      error: null,
    });
    return { ...result, ok: true, skipped: true };
  }

  await markCalendarSyncOutcome(eventId, { status: "synced" });
  return { ...result, ok: true };
}

function calendarChannelNeedsRetry(status) {
  const s = String(status || "");
  return !s || s === "pending" || s === "temporary_failure" || s === "sending";
}

/**
 * Cron reclaim for failed / pending calendar syncs on change events.
 */
export async function retryFailedCalendarSyncs({
  limit = 25,
  olderThanMinutes = 2,
  maxAgeDays = 7,
} = {}) {
  const now = Date.now();
  const createdBefore = new Date(now - olderThanMinutes * 60 * 1000).toISOString();
  const createdAfter = new Date(now - maxAgeDays * 24 * 60 * 60 * 1000).toISOString();

  let events = [];
  try {
    events =
      (await supabaseRequest(
        `appointment_change_events?created_at=gte.${encodeURIComponent(createdAfter)}` +
          `&created_at=lte.${encodeURIComponent(createdBefore)}` +
          `&or=(calendar_sync_status.in.(pending,temporary_failure,sending),` +
          `calendar_sync_status.is.null)` +
          `&select=*&order=created_at.asc&limit=${Math.max(1, Math.min(100, Number(limit) || 25))}`
      )) || [];
  } catch (error) {
    const message = String(error?.message || error || "");
    if (/calendar_sync_/i.test(message) || (/column/i.test(message) && /calendar/i.test(message))) {
      return { ok: true, skipped: true, reason: "calendar_columns_missing", retried: 0 };
    }
    console.warn(
      "[calendar-change-sync] retry fetch failed:",
      sanitizeCalendarSyncError(error)
    );
    return { ok: false, skipped: true, reason: "fetch_failed", retried: 0 };
  }

  let retried = 0;
  let succeeded = 0;
  let failed = 0;
  let skippedStale = 0;

  for (const event of events) {
    if (!calendarChannelNeedsRetry(event.calendar_sync_status)) continue;
    if (Number(event.calendar_sync_attempts || 0) >= MAX_CALENDAR_SYNC_ATTEMPTS) {
      await markCalendarSyncOutcome(event.id, {
        status: "permanent_failure",
        error: event.calendar_sync_last_error || "max_attempts",
      });
      failed += 1;
      continue;
    }

    let appointment = null;
    if (event.appointment_id) {
      try {
        const rows = await supabaseRequest(
          `appointments?id=eq.${encodeURIComponent(event.appointment_id)}` +
            `&select=id,date,time,status,patient_name,patient_phone,patient_email,` +
            `treatment_name,treatment_id,duration_minutes,google_event_id,updated_at,` +
            `notes,tenant_id,therapist_ids,therapist_names&limit=1`
        );
        appointment = Array.isArray(rows) ? rows[0] : rows;
      } catch (error) {
        console.warn(
          "[calendar-change-sync] retry load appointment failed:",
          sanitizeCalendarSyncError(error)
        );
        failed += 1;
        continue;
      }
    }

    const decision = resolveCalendarRetryDecision(event, appointment || null);
    if (!decision.apply) {
      await markCalendarSyncOutcome(event.id, {
        status: decision.terminalStatus || "skipped_stale",
        error: decision.reason || "stale",
      });
      skippedStale += 1;
      continue;
    }

    retried += 1;
    try {
      const result = await syncCalendarForChangeEvent({
        event,
        appointment: decision.appointment,
        previous: decision.previous,
        action: decision.action,
      });
      if (result?.ok || result?.already) succeeded += 1;
      else failed += 1;
    } catch (error) {
      failed += 1;
      await markCalendarSyncOutcome(event.id, {
        status: "temporary_failure",
        error: sanitizeCalendarSyncError(error),
        bumpAttempts: true,
      });
      console.error(
        "[calendar-change-sync] retry failed:",
        sanitizeCalendarSyncError(error)
      );
    }
  }

  return {
    ok: true,
    retried,
    succeeded,
    failed,
    skippedStale,
    scanned: events.length,
  };
}
