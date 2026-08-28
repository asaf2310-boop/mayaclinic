import { supabaseRequest } from "./supabaseServer.js";
import { getPelecardTransaction, validatePelecardPayment } from "./pelecard.js";
import {
  buildClinicBookingNotifyEmail,
  buildConfirmationEmail,
  buildGiftVoucherEmail,
  buildClinicGiftVoucherNotifyEmail,
} from "./emailTemplates.js";
import { getClinicName, isEmailConfigured, sendEmail } from "./gmail.js";
import { getBookingNotifyEmails } from "./bookingNotify.js";
import {
  applyMeridianVerifiedNotes,
  findMeridianTreatmentEmail,
  isValidMeridianTreatmentId,
  normalizeMeridianTreatmentId,
} from "./meridianEmail.js";
import { hasAppointmentTimeConflict } from "../src/lib/bookingSlots.js";
import { activateGiftVoucher, appendVoucherAppointments, redeemVoucherAtomic, restoreVoucherBalance } from "./giftVouchers.js";

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

async function fetchActiveAppointmentsForDates(dates = [], tenantId = "") {
  const uniqueDates = [...new Set((dates || []).map((d) => String(d || "").trim()).filter(Boolean))];
  if (!uniqueDates.length) return [];

  const dateList = uniqueDates.map((d) => encodeURIComponent(d)).join(",");
  const tenant = String(tenantId || "").trim();
  const tenantFilter = tenant ? `&tenant_id=eq.${encodeURIComponent(tenant)}` : "";

  try {
    return (
      (await supabaseRequest(
        `appointments?date=in.(${dateList})${tenantFilter}&status=neq.cancelled&select=id,date,time,status,tenant_id&limit=500`
      )) || []
    );
  } catch (error) {
    // Older DBs without tenant_id — retry without tenant filter.
    if (String(error?.message || "").includes("tenant_id")) {
      return (
        (await supabaseRequest(
          `appointments?date=in.(${dateList})&status=neq.cancelled&select=id,date,time,status&limit=500`
        )) || []
      );
    }
    throw error;
  }
}

export async function assertBookingSlotsAvailable(booking, { bookingDurationMinutes = 60 } = {}) {
  const dates = (booking.appointments || []).map((item) => item.date);
  const existing = await fetchActiveAppointmentsForDates(dates, booking.tenant_id);

  for (const appointment of booking.appointments || []) {
    if (
      hasAppointmentTimeConflict(
        { date: appointment.date, time: appointment.time },
        existing,
        { bookingDurationMinutes }
      )
    ) {
      const error = new Error(
        `השעה ${appointment.time} בתאריך ${appointment.date} כבר תפוסה. בחרו מועד אחר.`
      );
      error.status = 409;
      throw error;
    }
  }
}

export async function createAppointmentsFromBooking(
  booking,
  { paymentNote = "", paid = true, status = "confirmed", bookingDurationMinutes = 60 } = {}
) {
  await assertBookingSlotsAvailable(booking, { bookingDurationMinutes });

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
 * Clinic notify is sent after verification (so the email matches the real status).
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

  // Patient confirmation + clinic notify happen after treatment-ID verification.
  return { createdIds, appointments: createdRows };
}

/**
 * Create appointments for Movement (מובמנט) clients.
 * 45-minute sessions, no price, no credit payment — emails patient + clinic immediately.
 */
export async function createMovementBooking(rawBooking = {}) {
  const booking = normalizeBookingPayload(rawBooking);
  if (!isBookingPayloadValid(booking)) {
    const error = new Error("booking payload is required (patient, treatment, appointments)");
    error.status = 400;
    throw error;
  }

  if (!booking.patient_email) {
    const error = new Error("נדרש אימייל לאישור התור");
    error.status = 400;
    throw error;
  }

  const baseName = String(booking.treatment_name || "")
    .replace(/\s*\(מובמנט[^)]*\)\s*$/u, "")
    .trim();
  booking.treatment_name = `${baseName} (מובמנט · 45 דק׳)`;
  booking.treatment_price = null;

  const { createdIds, createdRows } = await createAppointmentsFromBooking(booking, {
    paymentNote: "ערוץ: לקוחת מובמנט · 45 דק׳ · ללא תשלום באשראי באתר",
    paid: false,
    status: "confirmed",
    bookingDurationMinutes: 45,
  });

  await maybeSendConfirmationEmail(createdRows);
  await maybeSendClinicBookingNotify(createdRows, {
    sourceLabel: "מובמנט / Movement",
    extraNote: "תור ללקוחות מובמנט · 45 דקות · ללא תשלום באשראי באתר",
  });

  return { createdIds, appointments: createdRows };
}

export async function redeemGiftVoucher({ rawBooking, code, tenantId }) {
  const booking = normalizeBookingPayload({ ...rawBooking, tenant_id: tenantId });
  if (!isBookingPayloadValid(booking)) throw Object.assign(new Error("פרטי ההזמנה אינם תקינים"), { status: 400 });
  await assertBookingSlotsAvailable(booking);
  const redeemed = await redeemVoucherAtomic({ code, count: booking.appointments.length, tenantId });
  const voucher = Array.isArray(redeemed) ? redeemed[0] : redeemed;
  try {
    const { createdIds, createdRows } = await createAppointmentsFromBooking(booking, { paymentNote: `שולם בשובר מתנה ${voucher.code}`, paid: true, status: "confirmed" });
    await appendVoucherAppointments(voucher.id, createdIds);
    await maybeSendConfirmationEmail(createdRows);
    await maybeSendClinicBookingNotify(createdRows, { sourceLabel: "שובר מתנה", extraNote: `שובר: ${voucher.code}` });
    return { createdIds, appointments: createdRows, voucher };
  } catch (error) {
    // Compensation is deliberately explicit; the SQL RPC guarantees the debit itself is atomic.
    await restoreVoucherBalance(voucher.id, booking.appointments.length).catch(() => {});
    throw error;
  }
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
    const cleaned = [];
    for (const row of active) {
      const notes = applyMeridianVerifiedNotes(row.notes, meridianId);
      if (notes === String(row.notes || "").trim()) {
        cleaned.push(row);
        continue;
      }
      const patched = await supabaseRequest(`appointments?id=eq.${encodeURIComponent(row.id)}`, {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({ notes }),
      });
      const record = Array.isArray(patched) ? patched[0] : patched;
      cleaned.push(record || { ...row, notes });
    }
    return {
      ok: true,
      found: true,
      alreadyVerified: true,
      treatmentId: meridianId,
      appointments: cleaned,
    };
  }

  const match = await findMeridianTreatmentEmail(meridianId);
  if (!match) {
    return {
      ok: false,
      found: false,
      treatmentId: meridianId,
      message:
        "מזהה הטיפול לא אושר. בדקו את המספר ונסו שוב בעוד רגע.",
    };
  }

  const updated = [];

  for (const row of active) {
    const notes = applyMeridianVerifiedNotes(row.notes, meridianId);

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

  await maybeSendConfirmationEmail(updated);
  await maybeSendClinicBookingNotify(updated, {
    sourceLabel: "מרידיאן",
    extraNote: `מזהה טיפול מרידיאן שאומת: ${meridianId}`,
  });

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
    console.error("Patient confirmation email failed:", error?.message || error);
  }
}

async function maybeSendClinicBookingNotify(
  appointments,
  { sourceLabel = "האתר", extraNote = "" } = {}
) {
  if (!isEmailConfigured() || !appointments?.length) return;

  const recipients = getBookingNotifyEmails();
  if (!recipients.length) return;

  try {
    const clinicName = getClinicName();
    const first = appointments[0] || {};
    const { subject, html } = buildClinicBookingNotifyEmail({
      patientName: first.patient_name || "",
      patientPhone: first.patient_phone || "",
      patientEmail: first.patient_email || "",
      appointments,
      clinicName,
      sourceLabel,
      extraNote,
    });

    await Promise.all(
      recipients.map((to) => sendEmail({ to, subject, html }))
    );
  } catch (error) {
    console.error("Clinic booking notify email failed:", error?.message || error);
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

  const totalAgorot = session.total_agorot;
  // Prefer the ConfirmationKey from init (stored on the session). Callback keys
  // can differ; Pelecard binds the init key to UserKey + Total.
  const confirmationCandidates = [
    ...new Set(
      [session.confirmation_key, confirmationKey]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    ),
  ];
  // UniqueKey = UserKey from init (bookingRef). If UserKey was empty Pelecard
  // accepts PelecardTransactionId instead — try both.
  const uniqueCandidates = [
    ...new Set(
      [bookingRef, pelecardTransactionId, resultPayload?.ParamX, resultPayload?.UserKey]
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    ),
  ];

  let valid = false;
  let key = confirmationCandidates[0] || "";
  for (const candidateKey of confirmationCandidates) {
    valid = await validatePelecardPayment({
      confirmationKey: candidateKey,
      uniqueKeys: uniqueCandidates,
      totalAgorot,
    });
    if (valid) {
      key = candidateKey;
      break;
    }
  }

  // Fallback: authenticated GetTransaction when status is already 000.
  if (!valid && pelecardTransactionId && statusOk) {
    try {
      const txn = await getPelecardTransaction(pelecardTransactionId);
      const status =
        String(txn?.StatusCode || txn?.ResultData?.StatusCode || txn?.statusCode || "").trim();
      const debitTotal = Number(
        txn?.ResultData?.DebitTotal ?? txn?.DebitTotal ?? txn?.ResultData?.Total ?? NaN
      );
      const amountMatches =
        !Number.isFinite(debitTotal) ||
        Math.round(debitTotal) === Math.round(Number(totalAgorot) || 0) ||
        // Some payloads return shekels rather than agorot.
        Math.round(debitTotal * 100) === Math.round(Number(totalAgorot) || 0);
      if ((status === "000" || status === "") && amountMatches && txn) {
        valid = true;
        key =
          String(txn?.ResultData?.ConfirmationKey || txn?.ConfirmationKey || "").trim() || key;
      }
    } catch (error) {
      console.error("Pelecard GetTransaction fallback failed:", error?.message || error);
    }
  }

  if (!valid) {
    const updated = await updatePaymentSession(bookingRef, {
      status: "failed",
      pelecard_transaction_id: pelecardTransactionId || null,
      result_payload: resultPayload || null,
      error_message: "ValidateByUniqueKey failed",
    });
    return { session: updated, alreadyProcessed: false, valid: false };
  }

  if (session.booking_payload?.kind === "gift_voucher") {
    const activation = await activateGiftVoucher(bookingRef);
    const voucher = activation.voucher;
    const updated = await updatePaymentSession(bookingRef, { status: "paid", confirmation_key: key || session.confirmation_key, pelecard_transaction_id: pelecardTransactionId || null, approval_no: approvalNo || null, result_payload: resultPayload || null, error_message: null });
    if (!activation.alreadyActive && isEmailConfigured()) {
      const clinicName = getClinicName(); const amountIls = voucher.amount_agorot / 100;
      const publicOrigin = String(process.env.PUBLIC_ORIGIN || process.env.PELECARD_PUBLIC_ORIGIN || "").replace(/\/$/, "");
      const voucherUrl = publicOrigin ? `${publicOrigin}/gift/card?${new URLSearchParams({ code: voucher.code, name: voucher.recipient_name || "", greeting: voucher.greeting || "", quantity: String(voucher.treatments_total) })}` : "";
      const customerMail = buildGiftVoucherEmail({ purchaserName: voucher.purchaser_name, recipientName: voucher.recipient_name, greeting: voucher.greeting, code: voucher.code, quantity: voucher.treatments_total, amountIls, clinicName, bookingUrl: voucherUrl || (publicOrigin ? `${publicOrigin}/book` : "") });
      await sendEmail({ to: voucher.purchaser_email, ...customerMail }).catch((error) => console.error("Gift voucher email failed:", error?.message || error));
      if (voucher.send_to_recipient && voucher.recipient_email) {
        const recipientMail = buildGiftVoucherEmail({ purchaserName: voucher.recipient_name || "", recipientName: voucher.recipient_name, greeting: voucher.greeting, code: voucher.code, quantity: voucher.treatments_total, amountIls, clinicName, bookingUrl: voucherUrl || (publicOrigin ? `${publicOrigin}/book` : "") });
        await sendEmail({ to: voucher.recipient_email, ...recipientMail }).catch((error) => console.error("Recipient gift voucher email failed:", error?.message || error));
      }
      const clinicMail = buildClinicGiftVoucherNotifyEmail({ purchaserName: voucher.purchaser_name, purchaserPhone: voucher.purchaser_phone, purchaserEmail: voucher.purchaser_email, recipientName: voucher.recipient_name, recipientEmail: voucher.send_to_recipient ? voucher.recipient_email : "", greeting: voucher.greeting, code: voucher.code, quantity: voucher.treatments_total, amountIls, clinicName });
      await Promise.all(getBookingNotifyEmails().map((to) => sendEmail({ to, ...clinicMail }).catch((error) => console.error("Clinic gift email failed:", error?.message || error))));
    }
    return { session: updated, voucher, alreadyProcessed: false, valid: true };
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
  await maybeSendClinicBookingNotify(createdRows, {
    sourceLabel: "תשלום באשראי",
    extraNote: paymentNote,
  });

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
