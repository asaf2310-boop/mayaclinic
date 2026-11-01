/**
 * Customer self-service policy helpers: Jerusalem time, 24h cutoff, phone ownership match.
 */

import { normalizeIsraeliMobile, digitsOnly } from "./israeliPhone.js";
import { getJerusalemNowParts, parseAppointmentTimeMinutes } from "./emailDelivery.js";

export const SELF_SERVICE_MIN_LEAD_MS = 24 * 60 * 60 * 1000;

export const POLICY_MESSAGE_HE =
  "ניתן לעדכן או לבטל תור עד 24 שעות לפני מועד התור. לשינוי בשלב זה יש ליצור קשר עם בית העסק.";

/** Convert Asia/Jerusalem civil date+time to UTC epoch ms (DST-correct). */
export function jerusalemLocalToUtcMs(dateIso, timeHm, nowHint = new Date()) {
  const date = String(dateIso || "").trim();
  const timeMinutes = parseAppointmentTimeMinutes(timeHm);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || timeMinutes == null) return null;

  const [year, month, day] = date.split("-").map(Number);
  const hour = Math.floor(timeMinutes / 60);
  const minute = timeMinutes % 60;

  // Iteratively reconcile UTC guess with Jerusalem wall-clock (handles DST).
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  if (!Number.isFinite(guess)) return null;

  for (let i = 0; i < 4; i += 1) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date(guess));

    const got = {
      year: Number(parts.find((p) => p.type === "year")?.value),
      month: Number(parts.find((p) => p.type === "month")?.value),
      day: Number(parts.find((p) => p.type === "day")?.value),
      hour: Number(parts.find((p) => p.type === "hour")?.value),
      minute: Number(parts.find((p) => p.type === "minute")?.value),
      second: Number(parts.find((p) => p.type === "second")?.value),
    };

    const wantMs =
      Date.UTC(year, month - 1, day, hour, minute, 0) -
      Date.UTC(1970, 0, 1);
    const gotAsUtcMs =
      Date.UTC(got.year, got.month - 1, got.day, got.hour, got.minute, got.second) -
      Date.UTC(1970, 0, 1);
    const delta = wantMs - gotAsUtcMs;
    if (delta === 0) break;
    guess += delta;
  }

  void nowHint;
  return guess;
}

export function getAppointmentStartUtcMs(appointment) {
  if (!appointment) return null;
  return jerusalemLocalToUtcMs(appointment.date, appointment.time);
}

/** True when appointment start is ≥24h from now (Asia/Jerusalem wall clock → absolute). */
export function canModifyAppointmentWithinPolicy(appointment, now = new Date()) {
  const startMs = getAppointmentStartUtcMs(appointment);
  if (startMs == null) return false;
  return startMs - now.getTime() >= SELF_SERVICE_MIN_LEAD_MS;
}

/** New slot must also be ≥24h from now and not in the past. */
export function isSlotAllowedForReschedule({ date, time }, now = new Date()) {
  const startMs = jerusalemLocalToUtcMs(date, time);
  if (startMs == null) return false;
  return startMs - now.getTime() >= SELF_SERVICE_MIN_LEAD_MS;
}

export function isSameSlot(a, b) {
  return (
    String(a?.date || "") === String(b?.date || "") &&
    String(a?.time || "").slice(0, 5) === String(b?.time || "").slice(0, 5)
  );
}

/** Upcoming active appointment: not cancelled/completed, start still in the future (Jerusalem). */
export function isUpcomingActiveAppointment(appointment, now = new Date()) {
  if (!appointment) return false;
  const status = String(appointment.status || "");
  if (status === "cancelled" || status === "completed") return false;

  const startMs = getAppointmentStartUtcMs(appointment);
  if (startMs == null) {
    // Fall back to date-only compare when time is unparsable.
    const { dateIso } = getJerusalemNowParts(now);
    return String(appointment.date || "") >= dateIso;
  }
  return startMs > now.getTime();
}

export function phoneDigitsKey(raw) {
  const normalized = normalizeIsraeliMobile(raw);
  if (normalized.ok) return normalized.normalized;
  const digits = digitsOnly(raw);
  if (digits.startsWith("972") && digits.length >= 12) {
    return `0${digits.slice(3)}`;
  }
  if (digits.length === 9 && digits.startsWith("5")) return `0${digits}`;
  return digits;
}

export function phonesMatch(a, b) {
  const left = phoneDigitsKey(a);
  const right = phoneDigitsKey(b);
  if (!left || !right) return false;
  return left === right;
}

/** PostgREST-friendly phone variants for an Israeli mobile. */
export function phoneLookupVariants(raw) {
  const normalized = normalizeIsraeliMobile(raw);
  if (!normalized.ok) return [];
  const local = normalized.normalized; // 05xxxxxxxx
  const national = local.slice(1); // 5xxxxxxxx
  const intl = `972${national}`;
  const plusIntl = `+972${national}`;
  const dashed = `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  const dashed2 = `${local.slice(0, 3)}-${local.slice(3, 10)}`;
  return [...new Set([local, national, intl, plusIntl, dashed, dashed2])];
}

export function publicAppointmentView(appointment, { now = new Date(), clinicPhone = "" } = {}) {
  if (!appointment) return null;
  const canModify = canModifyAppointmentWithinPolicy(appointment, now);
  const duration =
    Number(appointment.duration_minutes) ||
    Number(appointment.durationMinutes) ||
    null;

  return {
    id: appointment.id,
    date: appointment.date,
    time: String(appointment.time || "").slice(0, 5),
    treatment_name: appointment.treatment_name || "",
    treatment_id: appointment.treatment_id || null,
    therapist_names: appointment.therapist_names || "",
    duration_minutes: duration,
    status: appointment.status,
    patient_name: appointment.patient_name || "",
    patient_email: appointment.patient_email || "",
    notes: appointment.notes || "",
    updated_at: appointment.updated_at || null,
    can_modify: canModify,
    policy_message: canModify ? null : POLICY_MESSAGE_HE,
    clinic_phone: clinicPhone || null,
  };
}
