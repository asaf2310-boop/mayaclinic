import assert from "node:assert/strict";
import {
  attachInvoicesToAppointments,
  extractPelecardTransactionIdFromNotes,
  invoiceLabelForAdmin,
  publicizeInvoice4uSummary,
} from "../server/appointmentInvoices.js";

const tx = "4ad73daa-0dfd-4eb9-9bcd-92a3ceef22ab";
assert.equal(
  extractPelecardTransactionIdFromNotes(`Pelecard: ${tx}`),
  tx
);
assert.equal(extractPelecardTransactionIdFromNotes("no payment"), "");

assert.deepEqual(
  publicizeInvoice4uSummary({
    ok: true,
    documentNumber: 1204,
    id: "doc-1",
    pdfUrl: "https://example.com/inv.pdf",
    at: "2026-10-06T10:00:00.000Z",
  }),
  {
    ok: true,
    documentNumber: 1204,
    id: "doc-1",
    pdfUrl: "https://example.com/inv.pdf",
    apiIdentifier: null,
    at: "2026-10-06T10:00:00.000Z",
  }
);

assert.equal(
  publicizeInvoice4uSummary({ ok: false, status: "issuing" })?.status,
  "issuing"
);
assert.equal(publicizeInvoice4uSummary(null), null);
assert.equal(invoiceLabelForAdmin({ ok: true, documentNumber: 9 }), "מס׳ 9");
assert.equal(
  invoiceLabelForAdmin({ ok: false, reason: "not_configured", skipped: true }),
  "לא הוגדר Invoice4U"
);

const appointments = [
  {
    id: "appt-1",
    notes: `Pelecard: ${tx}`,
    paid: true,
  },
  {
    id: "appt-2",
    notes: "",
    paid: true,
  },
  {
    id: "appt-orphan",
    notes: "Pelecard: 11111111-1111-1111-1111-111111111111",
    paid: true,
  },
];

const payments = [
  {
    booking_ref: "ref-1",
    pelecard_transaction_id: tx,
    appointment_ids: ["appt-1"],
    result_payload: {
      invoice4u: {
        ok: true,
        documentNumber: 77,
        pdfUrl: "https://example.com/77.pdf",
        at: "2026-10-06T12:01:00.000Z",
      },
    },
  },
  {
    booking_ref: "ref-2",
    pelecard_transaction_id: null,
    appointment_ids: ["appt-2"],
    result_payload: {
      invoice4u: {
        ok: false,
        skipped: true,
        reason: "not_configured",
        at: "2026-10-06T12:02:00.000Z",
      },
    },
  },
];

const request = async (path) => {
  if (path.includes("appointment_ids.cs")) {
    return payments.filter((row) =>
      (row.appointment_ids || []).some((id) => path.includes(id))
    );
  }
  if (path.includes("pelecard_transaction_id=in.")) {
    return payments.filter((row) =>
      row.pelecard_transaction_id &&
      path.toLowerCase().includes(String(row.pelecard_transaction_id).toLowerCase())
    );
  }
  return [];
};

const enriched = await attachInvoicesToAppointments(appointments, { request });
assert.equal(enriched[0].invoice4u.documentNumber, 77);
assert.equal(enriched[0].invoice4u.pdfUrl, "https://example.com/77.pdf");
assert.equal(enriched[1].invoice4u.reason, "not_configured");
assert.equal(enriched[2].invoice4u, undefined);

console.log("test-appointment-invoices: ok");
