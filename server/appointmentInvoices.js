/**
 * Attach Invoice4U summaries from pelecard_payments onto admin appointment rows.
 * Invoices are stored only on payment sessions (result_payload.invoice4u), never
 * on the appointments table — so the admin list must join them for a copy/link.
 */

import { hasSuccessfulInvoice4u } from "./invoice4u.js";
import { supabaseRequest } from "./supabaseServer.js";

const PELECARD_UUID_RE =
  /Pelecard:\s*([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

/** Extract Pelecard transaction id from appointment notes written at finalize. */
export function extractPelecardTransactionIdFromNotes(notes) {
  const match = String(notes || "").match(PELECARD_UUID_RE);
  return match?.[1] ? String(match[1]).toLowerCase() : "";
}

/**
 * Safe fields for the admin UI (no raw Pelecard / customer PII beyond what's needed).
 */
export function publicizeInvoice4uSummary(invoiceSummary) {
  const inv =
    invoiceSummary && typeof invoiceSummary === "object" ? invoiceSummary : null;
  if (!inv) return null;

  if (hasSuccessfulInvoice4u(inv)) {
    return {
      ok: true,
      documentNumber: inv.documentNumber ?? null,
      id: inv.id || null,
      pdfUrl: inv.pdfUrl || null,
      apiIdentifier: inv.apiIdentifier || null,
      at: inv.at || null,
    };
  }

  if (inv.skipped || inv.error || inv.reason || inv.status === "issuing") {
    return {
      ok: false,
      skipped: Boolean(inv.skipped),
      reason: inv.reason || null,
      error: inv.error || null,
      status: inv.status || null,
      at: inv.at || null,
    };
  }

  return null;
}

export function invoiceLabelForAdmin(invoice) {
  if (!invoice) return "";
  if (invoice.ok) {
    if (invoice.documentNumber != null && invoice.documentNumber !== "") {
      return `מס׳ ${invoice.documentNumber}`;
    }
    if (invoice.id) return `מסמך ${invoice.id}`;
    return "הופקה";
  }
  if (invoice.status === "issuing") return "בהפקה…";
  if (invoice.reason === "not_configured") return "לא הוגדר Invoice4U";
  if (invoice.reason === "zero_amount") return "סכום אפס — לא הופקה";
  if (invoice.skipped && invoice.reason) return `דולג: ${invoice.reason}`;
  if (invoice.error) return `שגיאה: ${String(invoice.error).slice(0, 120)}`;
  if (invoice.reason) return String(invoice.reason);
  return "לא הופקה";
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

/**
 * Load paid Pelecard sessions that match appointment ids and/or Pelecard tx ids.
 * Returns { byAppointmentId, byTransactionId } maps of public invoice summaries.
 */
export async function loadInvoiceMapsForAppointments(
  appointments,
  { request = supabaseRequest } = {}
) {
  const byAppointmentId = new Map();
  const byTransactionId = new Map();

  const rows = Array.isArray(appointments) ? appointments : [];
  if (!rows.length) {
    return { byAppointmentId, byTransactionId };
  }

  const appointmentIds = [
    ...new Set(rows.map((row) => String(row?.id || "").trim()).filter(Boolean)),
  ];
  const transactionIds = [
    ...new Set(
      rows
        .map((row) => extractPelecardTransactionIdFromNotes(row?.notes))
        .filter(Boolean)
    ),
  ];

  if (!appointmentIds.length && !transactionIds.length) {
    return { byAppointmentId, byTransactionId };
  }

  const paymentRows = [];

  for (const ids of chunk(appointmentIds, 40)) {
    if (!ids.length) continue;
    const orClause = ids
      .map((id) => `appointment_ids.cs.{${encodeURIComponent(id)}}`)
      .join(",");
    try {
      const found =
        (await request(
          `pelecard_payments?or=(${orClause})&select=booking_ref,pelecard_transaction_id,appointment_ids,result_payload&limit=200`
        )) || [];
      if (Array.isArray(found)) paymentRows.push(...found);
    } catch (error) {
      console.error(
        "Invoice lookup by appointment_ids failed:",
        error?.message || error
      );
    }
  }

  for (const ids of chunk(transactionIds, 80)) {
    if (!ids.length) continue;
    const inList = ids.map((id) => encodeURIComponent(id)).join(",");
    try {
      const found =
        (await request(
          `pelecard_payments?pelecard_transaction_id=in.(${inList})&select=booking_ref,pelecard_transaction_id,appointment_ids,result_payload&limit=200`
        )) || [];
      if (Array.isArray(found)) paymentRows.push(...found);
    } catch (error) {
      console.error(
        "Invoice lookup by pelecard_transaction_id failed:",
        error?.message || error
      );
    }
  }

  const seen = new Set();
  for (const payment of paymentRows) {
    const key = String(payment?.booking_ref || payment?.pelecard_transaction_id || "");
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);

    const summary = publicizeInvoice4uSummary(payment?.result_payload?.invoice4u);
    if (!summary) continue;

    const tx = String(payment?.pelecard_transaction_id || "").trim().toLowerCase();
    if (tx) {
      const existing = byTransactionId.get(tx);
      if (!existing || (summary.ok && !existing.ok)) {
        byTransactionId.set(tx, summary);
      }
    }

    const ids = Array.isArray(payment?.appointment_ids)
      ? payment.appointment_ids
      : [];
    for (const id of ids) {
      const apptId = String(id || "").trim();
      if (!apptId) continue;
      const existing = byAppointmentId.get(apptId);
      if (!existing || (summary.ok && !existing.ok)) {
        byAppointmentId.set(apptId, summary);
      }
    }
  }

  return { byAppointmentId, byTransactionId };
}

/**
 * Returns a new appointments array with `invoice4u` attached when found.
 */
export async function attachInvoicesToAppointments(
  appointments,
  { request = supabaseRequest } = {}
) {
  if (!Array.isArray(appointments) || !appointments.length) {
    return appointments || [];
  }

  const { byAppointmentId, byTransactionId } =
    await loadInvoiceMapsForAppointments(appointments, { request });

  return appointments.map((appointment) => {
    const id = String(appointment?.id || "").trim();
    const tx = extractPelecardTransactionIdFromNotes(appointment?.notes);
    const invoice4u =
      (id && byAppointmentId.get(id)) ||
      (tx && byTransactionId.get(tx)) ||
      null;
    if (!invoice4u) return appointment;
    return { ...appointment, invoice4u };
  });
}
