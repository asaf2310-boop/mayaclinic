import {
  clearAdminSessionCookie,
  getAdminAuthOptions,
  getAdminCookiePath,
  getAdminSession,
  hasAdminSession,
  isAdminPasswordConfigured,
  isAdminPasswordValid,
  setAdminSessionCookie,
} from "../server/adminSession.js";
import {
  clearAdminLoginFailures,
  getAdminLoginThrottle,
  recordAdminLoginFailure,
} from "../server/adminRateLimit.js";
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  isAllowedAdminEmail,
  isGoogleAdminAuthConfigured,
  parseOAuthState,
} from "../server/googleAdminAuth.js";
import { getRequestBookingBasePath, resolveAdminAppOrigin, resolveAdminFrontPath } from "../server/bookingMount.js";
import { resolveClinicTenantFromHost } from "../server/clinicTenant.js";
import { supabaseRequest } from "../server/supabaseServer.js";
import { probeMeridianMailbox } from "../server/meridianEmail.js";
import { notifyClinicAppointmentCancelled } from "../server/clinicCancellationNotify.js";
import { syncClinicCalendarForAppointment } from "../server/syncClinicCalendar.js";
import { clearEmailSuppression } from "../server/emailDelivery.js";
import {
  DEFAULT_CLINIC_ADDRESS,
  DEFAULT_CONFIRM_SMS_TEMPLATE,
  DEFAULT_REMINDER_SMS_TEMPLATE,
  SMS_TEMPLATE_VARS,
  describeSmsAutomationGate,
  fetchRecentSmsReminderHistory,
  fetchSmsReminderSettings,
  isAllowedTechnicalAdmin,
  previewSmsTemplate,
  sendAdminTestSms,
  upsertSmsReminderSettings,
} from "../server/smsReminders.js";
import {
  getLiveSmsTestPreview,
  sendAdminLiveTestSms,
} from "../server/smsLiveTest.js";
import {
  bookingEmailErrorMessage,
  normalizeBookingEmail,
  validateBookingEmail,
} from "../src/lib/bookingEmailValidation.js";

const TENANT_ENTITIES = new Set([
  "appointments",
  "treatments",
  "availability",
  "patient_profiles",
  "weekly_schedule",
  "gift_vouchers",
]);

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

function requireTenant(req, res) {
  const tenantId = resolveClinicTenantFromHost(req);
  if (!tenantId) {
    res.status(400).json({ error: "Unknown clinic tenant for this host" });
    return null;
  }
  return tenantId;
}

function withTenantFilter(basePath, entity, tenantId, extra = "") {
  const parts = [];
  if (TENANT_ENTITIES.has(entity)) {
    parts.push(`tenant_id=eq.${encodeURIComponent(tenantId)}`);
  }
  if (extra) parts.push(extra);
  const query = parts.join("&");
  return query ? `${basePath}?${query}` : basePath;
}

function adminOrigin(req, basePath = getRequestBookingBasePath(req)) {
  return resolveAdminAppOrigin(req, basePath);
}

function adminLoginLocation(req, basePath, errorMessage) {
  const origin = adminOrigin(req, basePath);
  const path = resolveAdminFrontPath(basePath, "/admin");
  if (!errorMessage) return `${origin}${path}`;
  return `${origin}${path}?admin_error=${encodeURIComponent(errorMessage)}`;
}

async function handleGoogleCallback(req, res) {
  const parsedState = parseOAuthState(String(req.query?.state || "").trim());
  const basePath = parsedState?.bookingBasePath === "/booking" ? "/booking" : getRequestBookingBasePath(req);
  const cookiePath = basePath === "/booking" ? "/booking" : "/";
  const errorParam = String(req.query?.error || "").trim();
  if (errorParam) {
    clearAdminSessionCookie(res, { cookiePath });
    redirect(res, adminLoginLocation(req, basePath, "ההתחברות עם Google בוטלה"));
    return;
  }

  const code = String(req.query?.code || "").trim();
  if (!code || !parsedState) {
    clearAdminSessionCookie(res, { cookiePath });
    redirect(res, adminLoginLocation(req, basePath, "בקשת התחברות לא תקינה"));
    return;
  }

  try {
    const profile = await exchangeGoogleCode(req, code, basePath);
    if (!profile.emailVerified) {
      clearAdminSessionCookie(res, { cookiePath });
      redirect(res, adminLoginLocation(req, basePath, "יש לאמת את כתובת ה-Gmail לפני כניסה"));
      return;
    }

    if (!isAllowedAdminEmail(profile.email)) {
      clearAdminSessionCookie(res, { cookiePath });
      redirect(res, adminLoginLocation(req, basePath, "החשבון לא מורשה לניהול הקליניקה"));
      return;
    }

    setAdminSessionCookie(res, { email: profile.email, method: "google", cookiePath });
    redirect(res, adminLoginLocation(req, basePath));
  } catch (error) {
    clearAdminSessionCookie(res, { cookiePath });
    redirect(res, adminLoginLocation(req, basePath, error?.message || "התחברות Google נכשלה"));
  }
}

async function listEntity(entity, query = {}, tenantId) {
  const order = String(query.order || "-created_at");
  const limit = Math.max(1, Number(query.limit) || 500);
  const offset = Math.max(0, Number(query.offset) || 0);
  const desc = order.startsWith("-");
  const column = desc ? order.slice(1) : order;
  const tenantClause = TENANT_ENTITIES.has(entity)
    ? `tenant_id=eq.${encodeURIComponent(tenantId)}&`
    : "";

  if (entity === "appointments" && query.date) {
    return (
      (await supabaseRequest(
        `appointments?${tenantClause}date=eq.${encodeURIComponent(query.date)}&select=*&order=time.asc&limit=${limit}&offset=${offset}`
      )) || []
    );
  }

  if (entity === "patient_profiles" && query.customer_key) {
    return (
      (await supabaseRequest(
        `patient_profiles?${tenantClause}customer_key=eq.${encodeURIComponent(query.customer_key)}&select=*&limit=5`
      )) || []
    );
  }

  return (
    (await supabaseRequest(
      `${entity}?${tenantClause}select=*&order=${column}.${desc ? "desc" : "asc"}&limit=${limit}&offset=${offset}`
    )) || []
  );
}

async function findTenantRow(entity, tenantId, filters = {}) {
  const parts = [`tenant_id=eq.${encodeURIComponent(tenantId)}`];
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${key}=eq.${encodeURIComponent(value)}`);
  }
  const rows =
    (await supabaseRequest(`${entity}?${parts.join("&")}&select=*&limit=1`)) || [];
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function createEntity(entity, row, tenantId) {
  const payload = { ...(row || {}) };
  if (TENANT_ENTITIES.has(entity)) {
    payload.tenant_id = tenantId;
  }

  // Availability/weekly unique keys make "create" fail when UI missed an existing row
  // (e.g. truncated lists). Upsert by natural key so Save always persists.
  if (entity === "availability" && payload.date) {
    const existing = await findTenantRow("availability", tenantId, { date: payload.date });
    if (existing?.id) {
      return updateEntity(entity, existing.id, payload, tenantId);
    }
  }

  if (entity === "weekly_schedule" && payload.day_of_week !== undefined && payload.day_of_week !== null) {
    const existing = await findTenantRow("weekly_schedule", tenantId, {
      day_of_week: payload.day_of_week,
    });
    if (existing?.id) {
      return updateEntity(entity, existing.id, payload, tenantId);
    }
  }

  try {
    const created = await supabaseRequest(entity, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    const row = Array.isArray(created) ? created[0] : created;
    if (entity === "appointments" && row) {
      await syncClinicCalendarForAppointment(row, { action: "create" });
    }
    return row;
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("23505")) throw error;

    if (entity === "availability" && payload.date) {
      const existing = await findTenantRow("availability", tenantId, { date: payload.date });
      if (existing?.id) return updateEntity(entity, existing.id, payload, tenantId);

      // Legacy unique index is (date, location_id) without tenant — recover same-location row.
      const locationId = payload.location_id || "pardes_hanna";
      const legacyRows =
        (await supabaseRequest(
          `availability?date=eq.${encodeURIComponent(payload.date)}&location_id=eq.${encodeURIComponent(
            locationId
          )}&select=*&limit=5`
        )) || [];
      const ownLegacy = (Array.isArray(legacyRows) ? legacyRows : []).find(
        (row) => String(row?.tenant_id || "") === tenantId || !row?.tenant_id
      );
      if (ownLegacy?.id) {
        return updateEntity(
          entity,
          ownLegacy.id,
          { ...payload, tenant_id: tenantId },
          tenantId
        );
      }
    }
    if (entity === "weekly_schedule" && payload.day_of_week !== undefined) {
      const existing = await findTenantRow("weekly_schedule", tenantId, {
        day_of_week: payload.day_of_week,
      });
      if (existing?.id) return updateEntity(entity, existing.id, payload, tenantId);
    }
    throw error;
  }
}

async function getEntityById(entity, id, tenantId) {
  const path = withTenantFilter(
    entity,
    entity,
    tenantId,
    `id=eq.${encodeURIComponent(id)}&select=*`
  );
  const rows = await supabaseRequest(path);
  return Array.isArray(rows) ? rows[0] || null : rows || null;
}

async function updateEntity(entity, id, row, tenantId) {
  const payload = { ...(row || {}) };
  delete payload.tenant_id;
  delete payload.id;

  const previous =
    entity === "appointments" ? await getEntityById(entity, id, tenantId) : null;

  if (entity === "appointments" && Object.prototype.hasOwnProperty.call(payload, "patient_email")) {
    const emailResult = validateBookingEmail(payload.patient_email, { required: false });
    if (!emailResult.ok) {
      const error = new Error(bookingEmailErrorMessage(emailResult.error));
      error.statusCode = 400;
      throw error;
    }
    payload.patient_email = emailResult.normalized || "";

    const prevEmail = normalizeBookingEmail(previous?.patient_email || "").normalized.toLowerCase();
    const nextEmail = normalizeBookingEmail(payload.patient_email || "").normalized.toLowerCase();
    if (nextEmail && nextEmail !== prevEmail) {
      // Explicit correction: lift suppression for the new address only.
      // Do not auto-resend old confirmations.
      await clearEmailSuppression(nextEmail);
      payload.confirmation_email_last_error = null;
      if (
        String(previous?.reminder_email_status || "") === "permanent_failure" ||
        String(previous?.reminder_email_status || "") === "suppressed"
      ) {
        payload.reminder_email_status = "pending";
        payload.reminder_email_attempts = 0;
        payload.reminder_email_last_error = null;
        payload.reminder_email_claimed_at = null;
      }
    }
  }

  // Date change = new reminder occurrence. Invalidate prior reminder claim/sent state.
  // Do not touch confirmation_* audit fields or auto-resend confirmations.
  if (
    entity === "appointments" &&
    previous &&
    Object.prototype.hasOwnProperty.call(payload, "date") &&
    String(payload.date || "") !== String(previous.date || "")
  ) {
    payload.reminder_sent_at = null;
    payload.reminder_email_status = "pending";
    payload.reminder_email_attempts = 0;
    payload.reminder_email_last_error = null;
    payload.reminder_email_claimed_at = null;
  }

  // Date or time change = new SMS reminder occurrence. Clear SMS claim so the new slot can remind.
  // Cancelled appointments are never SMS'd (cron + eligibility skip status=cancelled).
  if (
    entity === "appointments" &&
    previous &&
    ((Object.prototype.hasOwnProperty.call(payload, "date") &&
      String(payload.date || "") !== String(previous.date || "")) ||
      (Object.prototype.hasOwnProperty.call(payload, "time") &&
        String(payload.time || "") !== String(previous.time || "")))
  ) {
    payload.reminder_sms_sent_at = null;
    payload.reminder_sms_status = "pending";
    payload.reminder_sms_attempts = 0;
    payload.reminder_sms_last_error = null;
    payload.reminder_sms_claimed_at = null;
    payload.reminder_sms_shipment_id = null;
  }

  if (
    entity === "appointments" &&
    Object.prototype.hasOwnProperty.call(payload, "status") &&
    String(payload.status || "") === "cancelled"
  ) {
    // Stop in-flight / pending SMS; do not send after cancel.
    payload.reminder_sms_status = "cancelled";
    payload.reminder_sms_claimed_at = null;
    payload.reminder_sms_last_error = "appointment_cancelled";
  }

  const path = withTenantFilter(
    `${entity}`,
    entity,
    tenantId,
    `id=eq.${encodeURIComponent(id)}&select=*`
  );

  const patchOpts = {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
  };

  let updated;
  try {
    updated = await supabaseRequest(path, {
      ...patchOpts,
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // Pre-SMS-migration DBs: never block cancel/reschedule on missing reminder_sms_* columns.
    const message = String(error?.message || error || "");
    const smsKeys = Object.keys(payload).filter((key) => key.startsWith("reminder_sms_"));
    if (
      smsKeys.length > 0 &&
      (/reminder_sms_/i.test(message) ||
        (/column/i.test(message) && /reminder_sms/i.test(message)))
    ) {
      console.warn(
        "reminder sms columns missing on appointment update — run supabase/appointment-sms-delivery.sql"
      );
      const stripped = { ...payload };
      for (const key of smsKeys) delete stripped[key];
      updated = await supabaseRequest(path, {
        ...patchOpts,
        body: JSON.stringify(stripped),
      });
    } else {
      throw error;
    }
  }
  const rowOut = Array.isArray(updated) ? updated[0] : updated;
  if (!rowOut) {
    throw new Error("Record not found for this clinic tenant");
  }

  const previousStatus = String(previous?.status || "");
  const nextStatus = String(rowOut.status || "");
  if (
    entity === "appointments" &&
    nextStatus === "cancelled" &&
    previousStatus &&
    previousStatus !== "cancelled"
  ) {
    void notifyClinicAppointmentCancelled(rowOut, {
      previousStatus,
      reason: "cancelled",
    });
  }

  if (entity === "appointments" && rowOut) {
    const merged = {
      ...(previous || {}),
      ...rowOut,
      google_event_id: rowOut.google_event_id || previous?.google_event_id,
    };
    const dateTimeChanged =
      previous &&
      (String(previous.date || "") !== String(rowOut.date || "") ||
        String(previous.time || "") !== String(rowOut.time || ""));
    await syncClinicCalendarForAppointment(merged, {
      action:
        nextStatus === "cancelled"
          ? "delete"
          : dateTimeChanged
            ? "reschedule"
            : "sync",
      previous: dateTimeChanged ? previous : null,
    });
  }

  return rowOut;
}

async function deleteEntity(entity, id, tenantId) {
  const previous =
    entity === "appointments" ? await getEntityById(entity, id, tenantId) : null;

  const path = withTenantFilter(entity, entity, tenantId, `id=eq.${encodeURIComponent(id)}`);
  await supabaseRequest(path, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });

  if (previous && String(previous.status || "") !== "cancelled") {
    void notifyClinicAppointmentCancelled(previous, {
      previousStatus: previous.status || "",
      reason: "deleted",
      extraNote: "התור נמחק מהמערכת.",
    });
  }

  if (previous) {
    await syncClinicCalendarForAppointment(previous, { action: "delete" });
  }

  return { ok: true };
}

export default async function handler(req, res) {
  const action = String(req.query?.action || "").trim().toLowerCase();

  if (req.method === "GET" && action === "session") {
    const session = getAdminSession(req);
    res.status(200).json({
      ok: Boolean(session),
      email: session?.email || null,
      method: session?.method || null,
      tenantId: resolveClinicTenantFromHost(req) || null,
      ...getAdminAuthOptions(),
    });
    return;
  }

  if (req.method === "GET" && action === "google-start") {
    const basePath = getRequestBookingBasePath(req);
    if (!isGoogleAdminAuthConfigured()) {
      redirect(res, adminLoginLocation(req, basePath, "התחברות Google עדיין לא הוגדרה בשרת"));
      return;
    }
    try {
      redirect(res, buildGoogleAuthUrl(req, basePath));
    } catch (error) {
      redirect(res, adminLoginLocation(req, basePath, error?.message || "לא ניתן להתחיל התחברות Google"));
    }
    return;
  }

  if (req.method === "GET" && action === "google-callback") {
    await handleGoogleCallback(req, res);
    return;
  }

  if (req.method === "POST" && action === "login") {
    const throttle = getAdminLoginThrottle(req);
    if (!throttle.allowed) {
      res.status(429).json({
        error: "יותר מדי ניסיונות כושלים. נסו שוב מאוחר יותר.",
        retryAfterSec: throttle.retryAfterSec,
      });
      return;
    }

    if (!isAdminPasswordConfigured()) {
      res.status(503).json({
        error: "כניסת סיסמה לא מוגדרת. יש להגדיר ADMIN_ACCESS_PASSWORD ב-Vercel.",
      });
      return;
    }

    const body = readBody(req);
    if (!isAdminPasswordValid(body.password)) {
      recordAdminLoginFailure(req);
      clearAdminSessionCookie(res, { cookiePath: getAdminCookiePath(req) });
      res.status(401).json({ error: "סיסמת אדמין שגויה" });
      return;
    }
    clearAdminLoginFailures(req);
    setAdminSessionCookie(res, { method: "password", cookiePath: getAdminCookiePath(req) });
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "DELETE" && action === "session") {
    clearAdminSessionCookie(res, { cookiePath: getAdminCookiePath(req) });
    res.status(200).json({ ok: true });
    return;
  }

  if (!hasAdminSession(req)) {
    res.status(401).json({ error: "Admin session required" });
    return;
  }

  const tenantId = requireTenant(req, res);
  if (!tenantId) return;

  if (req.method === "GET" && action === "meridian-imap-probe") {
    try {
      const result = await probeMeridianMailbox();
      res.status(result.ok ? 200 : 503).json(result);
    } catch (error) {
      res.status(500).json({
        ok: false,
        error: error?.message || "IMAP probe failed",
      });
    }
    return;
  }

  if (req.method === "GET" && action === "sms-reminder-settings") {
    try {
      const settings = await fetchSmsReminderSettings(tenantId);
      const session = getAdminSession(req);
      const gate = {
        ...describeSmsAutomationGate(settings),
        techTestAllowed: isAllowedTechnicalAdmin(session?.email),
      };
      res.status(200).json({
        ok: true,
        settings,
        gate,
        variables: SMS_TEMPLATE_VARS,
        defaults: {
          clinic_address: DEFAULT_CLINIC_ADDRESS,
          confirm_template: DEFAULT_CONFIRM_SMS_TEMPLATE,
          reminder_template: DEFAULT_REMINDER_SMS_TEMPLATE,
        },
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Failed to load SMS settings" });
    }
    return;
  }

  if (req.method === "PATCH" && action === "sms-reminder-settings") {
    try {
      const body = readBody(req);
      const patch = {};
      if (Object.prototype.hasOwnProperty.call(body, "enabled")) {
        patch.enabled = body.enabled;
      }
      if (Object.prototype.hasOwnProperty.call(body, "booking_confirm_enabled")) {
        patch.booking_confirm_enabled = body.booking_confirm_enabled;
      }
      if (Object.prototype.hasOwnProperty.call(body, "lead_hours")) {
        patch.lead_hours = body.lead_hours;
      }
      if (Object.prototype.hasOwnProperty.call(body, "clinic_address")) {
        patch.clinic_address = body.clinic_address;
      }
      if (Object.prototype.hasOwnProperty.call(body, "confirm_template")) {
        patch.confirm_template = body.confirm_template;
      }
      if (Object.prototype.hasOwnProperty.call(body, "reminder_template")) {
        patch.reminder_template = body.reminder_template;
      }
      if (body?.restore_confirm_default) {
        patch.confirm_template = DEFAULT_CONFIRM_SMS_TEMPLATE;
      }
      if (body?.restore_reminder_default) {
        patch.reminder_template = DEFAULT_REMINDER_SMS_TEMPLATE;
      }
      const settings = await upsertSmsReminderSettings(tenantId, patch);
      const session = getAdminSession(req);
      res.status(200).json({
        ok: true,
        settings,
        gate: {
          ...describeSmsAutomationGate(settings),
          techTestAllowed: isAllowedTechnicalAdmin(session?.email),
        },
      });
    } catch (error) {
      const message = String(error?.message || error || "");
      if (error?.code === "unsupported_placeholders" || message === "unsupported_placeholders") {
        res.status(400).json({
          ok: false,
          error: "unsupported_placeholders",
          unsupported: error?.unsupported || [],
          message: "התבנית מכילה משתנים שאינם נתמכים",
        });
        return;
      }
      if (error?.code === "empty_template" || message === "empty_template") {
        res.status(400).json({ ok: false, error: "empty_template", message: "התבנית ריקה" });
        return;
      }
      if (/sms_reminder_settings|Could not find the table|relation/i.test(message)) {
        res.status(503).json({
          ok: false,
          error:
            "יש להריץ את supabase/appointment-sms-delivery.sql ו־supabase/appointment-sms-templates.sql לפני הפעלת הודעות SMS",
        });
        return;
      }
      res.status(500).json({ ok: false, error: error?.message || "Failed to save SMS settings" });
    }
    return;
  }

  if (req.method === "POST" && action === "sms-template-preview") {
    try {
      const body = readBody(req);
      const kind = body?.kind === "confirm" ? "confirm" : "reminder";
      const settings = await fetchSmsReminderSettings(tenantId);
      const template =
        body?.template != null
          ? body.template
          : kind === "confirm"
            ? settings.confirm_template
            : settings.reminder_template;
      const preview = previewSmsTemplate(kind, template, {
        clinicAddress: body?.clinic_address || settings.clinic_address,
        patientName: body?.patient_name,
        date: body?.date,
        time: body?.time,
      });
      res.status(preview.ok ? 200 : 400).json({ ok: Boolean(preview.ok), ...preview });
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Failed to preview SMS template" });
    }
    return;
  }

  if (req.method === "GET" && action === "sms-reminder-history") {
    try {
      const limit = Number(req.query?.limit || 50);
      const rows = await fetchRecentSmsReminderHistory({ limit, tenantId });
      res.status(200).json({ ok: true, rows });
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Failed to load SMS history" });
    }
    return;
  }

  if (req.method === "POST" && action === "sms-test") {
    try {
      const session = getAdminSession(req);
      if (!isAllowedTechnicalAdmin(session?.email)) {
        res.status(403).json({
          ok: false,
          error: "technical_admin_required",
          message: "בדיקות SMS טכניות אינן זמינות למנהלי הקליניקה",
        });
        return;
      }
      const body = readBody(req);
      if (!body?.confirm) {
        res.status(400).json({
          ok: false,
          error: "confirm_required",
          message: "יש לאשר במפורש לפני שליחת SMS לבדיקה",
        });
        return;
      }
      const result = await sendAdminTestSms({
        phone: body.phone,
        message: body.message,
        confirm: true,
        // Live only when env gate is on AND caller explicitly requests it.
        // Dedicated live path is action=sms-live-test (allowlisted).
        useLive: Boolean(body.useLive),
      });
      res.status(result.ok ? 200 : 400).json({
        ok: Boolean(result.ok),
        ...result,
        // Never echo credentials; include safety flags for the UI.
        note: result.usedTestEndpoint
          ? "נשלח ל-endpoint בדיקה של 019 (ללא שליחה חיה)"
          : result.sentLive
            ? "נשלח ב-endpoint חי — ודאו שההודעה התקבלה"
            : undefined,
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "SMS test failed" });
    }
    return;
  }

  // Preview for live allowlisted test (no send). Automation env gate not required.
  if (req.method === "GET" && action === "sms-live-test") {
    try {
      const session = getAdminSession(req);
      if (!isAllowedTechnicalAdmin(session?.email)) {
        res.status(403).json({
          ok: false,
          error: "technical_admin_required",
          message: "בדיקות SMS טכניות אינן זמינות למנהלי הקליניקה",
        });
        return;
      }
      res.status(200).json({ ok: true, preview: getLiveSmsTestPreview() });
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Failed to load live SMS preview" });
    }
    return;
  }

  // One live SMS to hard-allowlisted number only. Does NOT require SMS_REMINDERS_ENABLED.
  if (req.method === "POST" && action === "sms-live-test") {
    try {
      const body = readBody(req);
      const session = getAdminSession(req);
      if (!isAllowedTechnicalAdmin(session?.email)) {
        res.status(403).json({
          ok: false,
          error: "technical_admin_required",
          message: "בדיקות SMS טכניות אינן זמינות למנהלי הקליניקה",
        });
        return;
      }
      const result = await sendAdminLiveTestSms({
        confirm: Boolean(body?.confirm),
        // Server ignores arbitrary destinations; allowlist is enforced inside.
        phone: body?.phone,
        actorEmail: session?.email || null,
        actorMethod: session?.method || null,
        tenantId,
      });
      const status = result.ok
        ? 200
        : result.error === "live_test_in_flight" || result.error === "live_test_cooldown"
          ? 429
          : result.error === "confirm_required" || result.error === "recipient_not_allowlisted"
            ? 400
            : result.error === "sms019_not_configured"
              ? 503
              : 400;
      res.status(status).json({
        ok: Boolean(result.ok),
        ...result,
      });
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Live SMS test failed" });
    }
    return;
  }

  try {
    const entity = String(req.query?.entity || "").trim();
    if (!entity) {
      res.status(400).json({ error: "entity required" });
      return;
    }

    if (req.method === "GET" && (action === "list" || action === "filter")) {
      res.status(200).json(await listEntity(entity, req.query || {}, tenantId));
      return;
    }

    if (req.method === "POST" && action === "create") {
      if (entity === "gift_vouchers") {
        res.status(405).json({ error: "Gift vouchers cannot be created manually" });
        return;
      }
      res.status(200).json(await createEntity(entity, readBody(req).row, tenantId));
      return;
    }

    if (req.method === "PATCH" && action === "update") {
      const id = String(req.query?.id || "").trim();
      if (!id) {
        res.status(400).json({ error: "id required" });
        return;
      }
      res.status(200).json(await updateEntity(entity, id, readBody(req).row, tenantId));
      return;
    }

    if (req.method === "DELETE" && action === "delete") {
      const id = String(req.query?.id || "").trim();
      if (!id) {
        res.status(400).json({ error: "id required" });
        return;
      }
      res.status(200).json(await deleteEntity(entity, id, tenantId));
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Admin request failed" });
  }
}
