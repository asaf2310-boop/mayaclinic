import {
  buildEmailClaimOrFilter,
  canClaimEmailDelivery,
} from "./emailClaim.js";

function cleanEnv(value) {
  return String(value || "")
    .split(/\s+/)
    .map((part) => part.trim())
    .find(Boolean) || "";
}

export function getSupabaseConfig() {
  const url = cleanEnv(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const key = cleanEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY
  );

  if (!url || !key) {
    throw new Error("Supabase is not configured on the server");
  }

  return { url, key };
}

export async function supabaseRequest(path, options = {}) {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed (${response.status})`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

export async function fetchRecentAppointmentsByIds(ids = [], { maxAgeMs = 10 * 60 * 1000 } = {}) {
  if (!ids.length) return [];

  const idList = ids.map((id) => encodeURIComponent(id)).join(",");
  const rows =
    (await supabaseRequest(
      `appointments?id=in.(${idList})&select=id,patient_name,patient_email,patient_phone,treatment_name,treatment_price,date,time,status,created_at`
    )) || [];

  const oldestAllowed = Date.now() - Math.max(0, Number(maxAgeMs) || 0);
  return rows.filter((row) => {
    const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
    return createdAt >= oldestAllowed && row.status !== "cancelled";
  });
}

export function getTomorrowDateIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));

  return tomorrow.toISOString().slice(0, 10);
}

export async function fetchTomorrowAppointmentsNeedingReminder() {
  const tomorrow = getTomorrowDateIso();
  const rows =
    (await supabaseRequest(
      `appointments?date=eq.${tomorrow}&status=neq.cancelled&patient_email=not.is.null&reminder_sent_at=is.null&select=id,patient_name,patient_email,treatment_name,treatment_price,date,time,status,reminder_email_status,reminder_email_attempts,reminder_email_claimed_at,reminder_sent_at`
    )) || [];

  return rows.filter((row) => {
    if (!String(row.patient_email || "").trim()) return false;
    const status = String(row.reminder_email_status || "");
    if (status === "permanent_failure" || status === "suppressed" || status === "cancelled") {
      return false;
    }
    // Fresh in-flight claims stay out of the candidate list; stale ones are reclaimable.
    if (
      status === "sending" &&
      !canClaimEmailDelivery({
        status,
        claimedAt: row.reminder_email_claimed_at,
        sentAt: row.reminder_sent_at,
      })
    ) {
      return false;
    }
    const attempts = Number(row.reminder_email_attempts || 0);
    return attempts < 3;
  });
}

export async function fetchAppointmentById(id) {
  const rows = await supabaseRequest(
    `appointments?id=eq.${encodeURIComponent(id)}&select=*&limit=1`
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

/**
 * Claim a reminder send so concurrent cron workers cannot both SMTP-send.
 * Single conditional PATCH: only one worker receives a row representation.
 * Stale `sending` (crash) can be reclaimed after STALE_EMAIL_CLAIM_MS.
 */
export async function claimReminderSend(id, now = new Date()) {
  const orFilter = buildEmailClaimOrFilter(
    "reminder_email_status",
    "reminder_email_claimed_at",
    now
  );
  try {
    const rows = await supabaseRequest(
      `appointments?id=eq.${encodeURIComponent(id)}&reminder_sent_at=is.null&${orFilter}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          reminder_email_status: "sending",
          reminder_email_claimed_at: now.toISOString(),
        }),
      }
    );
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (error) {
    if (/reminder_email_/i.test(String(error?.message || ""))) {
      console.warn(
        "reminder email columns missing — run supabase/appointment-email-delivery.sql"
      );
      // Without claim columns we cannot safely de-dupe concurrent workers — skip send.
      return null;
    }
    throw error;
  }
}

export async function markReminderOutcome(id, { status, error = null, attempts = null } = {}) {
  const patch = {
    reminder_email_status: status,
    reminder_email_claimed_at: null,
  };
  if (error != null) patch.reminder_email_last_error = String(error).slice(0, 240);
  if (attempts != null) patch.reminder_email_attempts = attempts;
  if (status === "accepted" || status === "delivered") {
    patch.reminder_sent_at = new Date().toISOString();
  }
  await supabaseRequest(`appointments?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  });
}

/** @deprecated Prefer markReminderOutcome — kept for callers/tests. */
export async function markReminderSent(id) {
  await markReminderOutcome(id, { status: "accepted" });
}

export async function claimConfirmationSend(id, now = new Date()) {
  const orFilter = buildEmailClaimOrFilter(
    "confirmation_email_status",
    "confirmation_email_claimed_at",
    now
  );
  try {
    const rows = await supabaseRequest(
      `appointments?id=eq.${encodeURIComponent(id)}&confirmation_sent_at=is.null&${orFilter}`,
      {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          confirmation_email_status: "sending",
          confirmation_email_claimed_at: now.toISOString(),
        }),
      }
    );
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (error) {
    if (/confirmation_email_|confirmation_sent_at|confirmation_email_claimed_at/i.test(String(error?.message || ""))) {
      console.warn(
        "confirmation email columns missing — run supabase/appointment-email-delivery.sql"
      );
      // No unsafe send without claim — migration must run before production rely-on.
      return null;
    }
    throw error;
  }
}

export async function markConfirmationOutcome(
  id,
  { status, error = null, attempts = null } = {}
) {
  const patch = {
    confirmation_email_status: status,
    confirmation_email_claimed_at: null,
  };
  if (error != null) patch.confirmation_email_last_error = String(error).slice(0, 240);
  if (attempts != null) patch.confirmation_email_attempts = attempts;
  if (status === "accepted" || status === "delivered") {
    patch.confirmation_sent_at = new Date().toISOString();
  }
  try {
    await supabaseRequest(`appointments?id=eq.${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(patch),
    });
  } catch (error) {
    // Columns may be missing until migration is applied — do not fail booking.
    if (/confirmation_email_|confirmation_sent_at|confirmation_email_claimed_at/i.test(String(error?.message || ""))) {
      console.warn(
        "confirmation email columns missing — run supabase/appointment-email-delivery.sql"
      );
      return;
    }
    throw error;
  }
}

export async function patchAppointmentById(id, patch) {
  const data = await supabaseRequest(
    `appointments?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(patch),
    }
  );
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    throw new Error("appointment_update_failed");
  }
  return row;
}
