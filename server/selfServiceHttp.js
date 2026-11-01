/**
 * Customer self-service HTTP handler: OTP → list → reschedule / cancel.
 * Mounted on /api/public-data (Hobby plan function-count limit) and rewritten
 * from /api/self-service. Ownership enforced via OTP session + phone match.
 */

import { resolveClinicTenantFromHost } from "./clinicTenant.js";
import {
  requestAppointmentOtp,
  verifyAppointmentOtp,
} from "./appointmentOtp.js";
import {
  createSelfServiceSessionToken,
  verifySelfServiceSessionToken,
} from "./selfServiceSession.js";
import {
  cancelOwnedAppointment,
  getOwnedAppointmentPublic,
  listUpcomingAppointmentsForPhone,
  rescheduleOwnedAppointment,
} from "./selfServiceAppointments.js";

export const SELF_SERVICE_ACTIONS = new Set([
  "requestOtp",
  "verifyOtp",
  "listAppointments",
  "getAppointment",
  "reschedule",
  "cancel",
]);

export function isSelfServiceAction(action) {
  return SELF_SERVICE_ACTIONS.has(String(action || "").trim());
}

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

function clientIp(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "")
    .split(",")[0]
    .trim();
  return forwarded || String(req.headers?.["x-real-ip"] || "").trim() || "";
}

function requireSession(req, body, tenantId) {
  const token =
    String(body?.sessionToken || body?.session_token || "").trim() ||
    String(req.headers?.["x-self-service-token"] || "").trim();
  const verified = verifySelfServiceSessionToken(token, { tenantId });
  if (!verified.ok) {
    const error = new Error(
      verified.error === "session_expired"
        ? "פג תוקף האימות. אמתו שוב את מספר הטלפון."
        : "נדרש אימות טלפון"
    );
    error.status = 401;
    error.code = verified.error || "invalid_session";
    throw error;
  }
  return verified;
}

function sendError(res, error) {
  const status = Number(error?.status) || 400;
  const payload = {
    ok: false,
    error: error?.code || "error",
    message: error?.message || "בקשה נכשלה",
  };
  if (error?.clinicPhone) payload.clinic_phone = error.clinicPhone;
  if (error?.retryAfterSec) payload.retryAfterSec = error.retryAfterSec;
  res.status(status).json(payload);
}

/** Handle a self-service POST. Returns true when the request was handled. */
export async function handleSelfServiceRequest(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return true;
  }

  try {
    const tenantId = resolveClinicTenantFromHost(req) || "maya";
    const body = readBody(req);
    const action = String(body.action || "").trim();

    if (!isSelfServiceAction(action)) {
      return false;
    }

    if (action === "requestOtp") {
      const result = await requestAppointmentOtp({
        phone: body.phone,
        tenantId,
        requestIp: clientIp(req),
      });
      if (!result.ok) {
        res.status(result.error === "rate_limited" ? 429 : 400).json(result);
        return true;
      }
      res.status(200).json(result);
      return true;
    }

    if (action === "verifyOtp") {
      const verified = await verifyAppointmentOtp({
        phone: body.phone,
        code: body.code,
        tenantId,
      });
      if (!verified.ok) {
        res.status(400).json(verified);
        return true;
      }

      let sessionToken;
      try {
        sessionToken = createSelfServiceSessionToken({
          phoneNormalized: verified.phoneNormalized,
          tenantId,
        });
      } catch {
        res.status(503).json({
          ok: false,
          error: "session_misconfigured",
          message: "שירות האימות אינו מוגדר במלואו בשרת",
        });
        return true;
      }

      const appointments = await listUpcomingAppointmentsForPhone({
        phoneNormalized: verified.phoneNormalized,
        tenantId,
      });

      res.status(200).json({
        ok: true,
        sessionToken,
        appointments,
        empty: appointments.length === 0,
        message:
          appointments.length === 0
            ? "לא נמצאו תורים קרובים למספר זה"
            : undefined,
      });
      return true;
    }

    if (action === "listAppointments") {
      const session = requireSession(req, body, tenantId);
      const appointments = await listUpcomingAppointmentsForPhone({
        phoneNormalized: session.phoneNormalized,
        tenantId: session.tenantId || tenantId,
      });
      res.status(200).json({
        ok: true,
        appointments,
        empty: appointments.length === 0,
      });
      return true;
    }

    if (action === "getAppointment") {
      const session = requireSession(req, body, tenantId);
      const appointment = await getOwnedAppointmentPublic({
        appointmentId: body.appointmentId || body.id,
        phoneNormalized: session.phoneNormalized,
        tenantId: session.tenantId || tenantId,
      });
      res.status(200).json({ ok: true, appointment });
      return true;
    }

    if (action === "reschedule") {
      const session = requireSession(req, body, tenantId);
      const result = await rescheduleOwnedAppointment({
        appointmentId: body.appointmentId || body.id,
        phoneNormalized: session.phoneNormalized,
        tenantId: session.tenantId || tenantId,
        newDate: body.date || body.newDate,
        newTime: body.time || body.newTime,
        expectedUpdatedAt: body.updated_at || body.expectedUpdatedAt || null,
      });
      res.status(200).json({ ok: true, ...result });
      return true;
    }

    if (action === "cancel") {
      const session = requireSession(req, body, tenantId);
      const result = await cancelOwnedAppointment({
        appointmentId: body.appointmentId || body.id,
        phoneNormalized: session.phoneNormalized,
        tenantId: session.tenantId || tenantId,
        expectedUpdatedAt: body.updated_at || body.expectedUpdatedAt || null,
      });
      res.status(200).json({ ok: true, ...result });
      return true;
    }

    res.status(400).json({ ok: false, error: "unsupported_action", message: "פעולה לא נתמכת" });
    return true;
  } catch (error) {
    console.error("[self-service]", error?.message || error);
    sendError(res, error);
    return true;
  }
}
