import { supabaseRequest } from "./supabaseServer.js";
import { validatePelecardPayment } from "./pelecard.js";
import { buildConfirmationEmail } from "./emailTemplates.js";
import { getClinicName, isEmailConfigured, sendEmail } from "./gmail.js";
import {
  findMeridianTreatmentEmail,
  isValidMeridianTreatmentId,
  normalizeMeridianTreatmentId,
} from "./meridianEmail.js";

function nowIso() {
  return new Date().toISOString();
}

export function normalizeBookingPayload(raw = {}) {
  const appointments = Array.isArray(raw.appointments) ? raw.appointments : [];
  return {
    patient_name: String(raw.patient_name || "").trim(),
    patient_phone: String(raw.patient_phone || "").trim(),
    patient_email: String(raw.patient_email || "").trim(),
    notes: String(raw.notes || "").trim(),
    marketing_consent: Boolean(raw.marketing_consent),
    treatment_id: raw.treatment_id || null,
    treatment_name: String(raw.treatment_name || "").trim(),
    treatment_price: Number(raw.treatment_price) || null,
    tenant_id: String(raw.tenant_id || process.env.VITE_CLINIC_TENANT_ID || "maya").trim(),
    appointments: appointments
      .map((item) => ({
        date: String(item?.date || "").trim(),
        time: String(item?.time || "").trim(),
      }))
      .filter((item) => item.date && item.time),
  };
}

export function isBookingPayloadValid(booking) {
  return Boolean(
    booking?.patient_name &&
      booking?.patient_phone &&
      booking?.treatment_name &&
      booking?.appointments?.length
  );
}

export async function createPaymentSession({
  bookingRef,
  totalAgorot,
  confirmationKey = "",
  bookingPayload,
  tenantId = "",
}) {
  const row = {
    booking_ref: bookingRef,
    tenant_id: tenantId || bookingPayload?.tenant_id || null,
    status: "pending",
    total_agorot: Math.round(Number(totalAgorot) || 0),
    confirmation_key: confirmationKey || null,
    booking_payload: bookingPayload || {},
    updated_at: nowIso(),
  };

  const created = await supabaseRequest("pelecard_payments", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  });

  return Array.isArray(created) ? created[0] : created;
}

export async function getPaymentSessionByRef(bookingRef) {
  const ref = encodeURIComponent(String(bookingRef || "").trim());
  if (!ref) return null;
  const rows = await supabaseRequest(
    `pelecard_payments?booking_ref=eq.${ref}&select=*&limit=1`
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

export async function updatePaymentSession(bookingRef, patch) {
  const ref = encodeURIComponent(String(bookingRef || "").trim());
  const rows = await supabaseRequest(`pelecard_payments?booking_ref=eq.${ref}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...patch, updated_at: nowIso() }),
  });
  return Array.isArray(rows) ? rows[0] : rows;
}

export async function createAppointmentsFromBooking(
  booking,
  { paymentNote = "", paid = true, status = "confirmed" } = {}
) {
  const notes = [String(booking.notes || "").trim(), paymentNote].filter(Boolean).join("\n");
  const createdIds = [];
  const createdRows = [];

  for (const appointment of booking.appointments) {
    const row = {
      patient_name: booking.patient_name,
      patient_phone: booking.patient_phone,
      patient_email: booking.patient_email || null,
      notes: notes || null,
      marketing_consent: Boolean(booking.marketing_consent),
      treatment_id: booking.treatment_id || null,
      treatment_name: booking.treatment_name,
      treatment_price: booking.treatment_price,
      date: appointment.date,
      time: appointment.time,
      paid: Boolean(paid),
      status: status || "confirmed",
      tenant_id: booking.tenant_id || "maya",
    };

    let created;
    try {
      created = await supabaseRequest("appointments", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(row),
      });
    } catch (error) {
      // Older DBs without tenant_id / marketing_consent — retry without optional cols.
      const message = String(error?.message || "");
      const stripped = { ...row };
      if (message.includes("tenant_id")) delete stripped.tenant_id;
      if (message.includes("marketing_consent")) delete stripped.marketing_consent;
      created = await supabaseRequest("appointments", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(stripped),
      });
    }

    const record = Array.isArray(created) ? created[0] : created;
    if (record?.id) {
      createdIds.push(record.id);
      createdRows.push(record);
    }
  }

  return { createdIds, createdRows };
}

/**
 * Create appointments for Meridian benefit flow.
 * Reserves the slot; client then submits Meridian treatment ID for email verification.
 */
export async function createMeridianBooking(rawBooking = {}) {
  const booking = normalizeBookingPayload(rawBooking);
  if (!isBookingPayloadValid(booking)) {
    const error = new Error("booking payload is required (patient, treatment, appointments)");
    error.status = 400;
    throw error;
  }

  const { createdIds, createdRows } = await createAppointmentsFromBooking(booking, {
    paymentNote: "תשלום דרך מרידיאן — ממתין לאימות מזהה טיפול",
    paid: false,
    status: "confirmed",
  });

  await maybeSendConfirmationEmail(createdRows);

  return { createdIds, appointments: createdRows };
}

function normalizeAppointmentIds(rawIds = []) {
  return [...new Set(
    (Array.isArray(rawIds) ? rawIds : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
  )].slice(0, 10);
}

async function fetchAppointmentsByIds(ids = []) {
  if (!ids.length) return [];
  const idList = ids.map((id) => encodeURIComponent(id)).join(",");
  return (
    (await supabaseRequest(
      `appointments?id=in.(${idList})&select=id,patient_name,patient_email,patient_phone,treatment_name,treatment_price,date,time,status,paid,notes,tenant_id,created_at`
    )) || []
  );
}

/**
 * Verify a Meridian treatment ID against Maya's inbox, then mark appointments paid.
 */
export async function verifyMeridianTreatmentId({
  appointmentIds = [],
  treatmentId = "",
  tenantId = "",
} = {}) {
  const ids = normalizeAppointmentIds(appointmentIds);
  const meridianId = normalizeMeridianTreatmentId(treatmentId);

  if (!ids.length) {
    const error = new Error("חסרים מזהי תורים לאימות");
    error.status = 400;
    throw error;
  }
  if (!isValidMeridianTreatmentId(meridianId)) {
    const error = new Error("מזהה טיפול לא תקין");
    error.status = 400;
    throw error;
  }

  const rows = await fetchAppointmentsByIds(ids);
  if (!rows.length) {
    const error = new Error("התורים לא נמצאו");
    error.status = 404;
    throw error;
  }

  const tenant = String(tenantId || "").trim();
  const scoped = tenant
    ? rows.filter((row) => !row.tenant_id || String(row.tenant_id) === tenant)
    : rows;

  if (!scoped.length) {
    const error = new Error("התורים לא שייכים לקליניקה זו");
    error.status = 403;
    throw error;
  }

  const active = scoped.filter((row) => String(row.status || "") !== "cancelled");
  if (!active.length) {
    const error = new Error("התורים בוטלו ולא ניתן לאמת אותם");
    error.status = 400;
    throw error;
  }

  const alreadyVerified = active.every((row) => {
    const notes = String(row.notes || "");
    return (
      Boolean(row.paid) &&
      notes.includes(meridianId) &&
      notes.includes("מזהה טיפול מרידיאן")
    );
  });
  if (alreadyVerified) {
    return {
      ok: true,
      found: true,
      alreadyVerified: true,
      treatmentId: meridianId,
      appointments: active,
    };
  }

  const match = await findMeridianTreatmentEmail(meridianId);
  if (!match) {
    return {
      ok: false,
      found: false,
      treatmentId: meridianId,
      message:
        "לא נמצא מייל ממרידיאן עם מזהה הטיפול הזה. בדקו שההזמנה הושלמה במרידיאן ונסו שוב בעוד דקה.",
    };
  }

  const verificationNote = `מזהה טיפול מרידיאן שאומת: ${meridianId}`;
  const updated = [];

  for (const row of active) {
    const existingNotes = String(row.notes || "").trim();
    const notes = existingNotes.includes(verificationNote)
      ? existingNotes
      : [existingNotes, verificationNote].filter(Boolean).join("\n");

    const patched = await supabaseRequest(`appointments?id=eq.${encodeURIComponent(row.id)}`, {
      method: "PATCH",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify({
        paid: true,
        notes: notes || null,
      }),
    });
    const record = Array.isArray(patched) ? patched[0] : patched;
    updated.push(record || { ...row, paid: true, notes });
  }

  return {
    ok: true,
    found: true,
    alreadyVerified: false,
    treatmentId: meridianId,
    email: {
      from: match.from,
      subject: match.subject,
      date: match.date,
    },
    appointments: updated,
  };
}

async function maybeSendConfirmationEmail(appointments) {
  if (!isEmailConfigured() || !appointments?.length) return;
  const patientEmail = String(appointments[0].patient_email || "").trim();
  if (!patientEmail) return;

  try {
    const clinicName = getClinicName();
    const { subject, html } = buildConfirmationEmail({
      patientName: appointments[0].patient_name || "",
      appointments,
      clinicName,
    });
    await sendEmail({ to: patientEmail, subject, html });
  } catch (error) {
    console.error("Pelecard confirmation email failed:", error?.message || error);
  }
}

/**
 * Authoritative server-side finalization after Pelecard callback.
 */
export async function finalizePaymentFromPelecard({
  bookingRef,
  outcome,
  confirmationKey,
  pelecardTransactionId,
  pelecardStatusCode,
  approvalNo,
  resultPayload,
}) {
  const session = await getPaymentSessionByRef(bookingRef);
  if (!session) {
    const error = new Error("Payment session not found");
    error.status = 404;
    throw error;
  }

  if (session.status === "paid") {
    return { session, alreadyProcessed: true };
  }

  const isGoodOutcome = outcome === "good";
  const statusOk = !pelecardStatusCode || pelecardStatusCode === "000";

  if (!isGoodOutcome || !statusOk) {
    const updated = await updatePaymentSession(bookingRef, {
      status: "failed",
      pelecard_transaction_id: pelecardTransactionId || session.pelecard_transaction_id,
      approval_no: approvalNo || null,
      result_payload: resultPayload || null,
      error_message: `Payment failed (${pelecardStatusCode || outcome || "error"})`,
    });
    return { session: updated, alreadyProcessed: false, valid: false };
  }

  const uniqueKey = bookingRef;
  const totalAgorot = session.total_agorot;
  const key = confirmationKey || session.confirmation_key || "";

  const valid = await validatePelecardPayment({
    confirmationKey: key,
    uniqueKey,
    totalAgorot,
  });

  if (!valid) {
    const updated = await updatePaymentSession(bookingRef, {
      status: "failed",
      pelecard_transaction_id: pelecardTransactionId || null,
      result_payload: resultPayload || null,
      error_message: "ValidateByUniqueKey failed",
    });
    return { session: updated, alreadyProcessed: false, valid: false };
  }

  const booking = normalizeBookingPayload(session.booking_payload || {});
  if (!isBookingPayloadValid(booking)) {
    const updated = await updatePaymentSession(bookingRef, {
      status: "failed",
      error_message: "Invalid booking payload on payment session",
      result_payload: resultPayload || null,
    });
    return { session: updated, alreadyProcessed: false, valid: false };
  }

  const paymentNote = pelecardTransactionId
    ? `Pelecard: ${pelecardTransactionId}`
    : `Pelecard: ${bookingRef}`;

  const { createdIds, createdRows } = await createAppointmentsFromBooking(booking, {
    paymentNote,
    paid: true,
    status: "confirmed",
  });

  const updated = await updatePaymentSession(bookingRef, {
    status: "paid",
    confirmation_key: key || session.confirmation_key,
    pelecard_transaction_id: pelecardTransactionId || null,
    approval_no: approvalNo || null,
    appointment_ids: createdIds,
    result_payload: resultPayload || null,
    error_message: null,
  });

  await maybeSendConfirmationEmail(createdRows);

  return {
    session: updated,
    appointments: createdRows,
    alreadyProcessed: false,
    valid: true,
  };
}

export function collectPelecardParams(req) {
  const query = req.query || {};
  const body =
    typeof req.body === "string"
      ? (() => {
          try {
            return JSON.parse(req.body);
          } catch {
            return {};
          }
        })()
      : req.body || {};

  // Pelecard may send form-urlencoded; Vercel usually parses into body object.
  const merged = { ...query, ...body };
  const params = {};
  for (const [key, value] of Object.entries(merged)) {
    if (Array.isArray(value)) params[key] = value[0];
    else if (value != null) params[key] = String(value);
  }
  return params;
}
