import assert from "node:assert/strict";
import {
  buildBookingInvoiceReceiptDoc,
  createBookingInvoiceReceipt,
  maybeIssueBookingInvoiceReceipt,
  resolveInvoice4uPaymentType,
  getInvoice4uConfig,
  INVOICE4U_PAYMENT_TYPE,
  INVOICE4U_DOCUMENT_TYPE,
} from "../server/invoice4u.js";

delete process.env.INVOICE4U_TOKEN;
delete process.env.INVOICE4U_ENABLED;
delete process.env.INVOICE4U_ENV;
delete process.env.INVOICE4U_BASE_URL;

assert.equal(getInvoice4uConfig().enabled, false);
assert.equal(resolveInvoice4uPaymentType({}, "פייבוקס"), INVOICE4U_PAYMENT_TYPE.PayBox);
assert.equal(resolveInvoice4uPaymentType({}, "ביט"), INVOICE4U_PAYMENT_TYPE.Bit);
assert.equal(resolveInvoice4uPaymentType({}, ""), INVOICE4U_PAYMENT_TYPE.CreditCard);

const doc = buildBookingInvoiceReceiptDoc({
  booking: {
    patient_name: "נועה כהן",
    patient_email: "noa@example.com",
    patient_phone: "0500000000",
    treatment_name: "עיסוי רפואי",
    appointments: [
      { date: "2026-10-01", time: "10:00" },
      { date: "2026-10-08", time: "10:00" },
    ],
  },
  bookingRef: "abc-123",
  totalAgorot: 64000,
  paymentType: INVOICE4U_PAYMENT_TYPE.CreditCard,
  pelecardTransactionId: "TX998877",
  approvalNo: "4321",
});

assert.equal(doc.DocumentType, INVOICE4U_DOCUMENT_TYPE.InvoiceReceipt);
assert.equal(doc.Items[0].Quantity, 2);
assert.equal(doc.Items[0].Price, 320);
assert.equal(doc.Payments[0].Amount, 640);
assert.equal(doc.AssociatedEmails[0].Mail, "noa@example.com");
assert.equal(String(doc.Payments[0].Date).includes("Z"), false);
assert.match(doc.ApiIdentifier, /^booking-abc-123$/);

const skipped = await createBookingInvoiceReceipt({
  booking: {
    patient_name: "x",
    treatment_name: "y",
    appointments: [{ date: "2026-01-01", time: "09:00" }],
  },
  bookingRef: "r",
  totalAgorot: 10000,
});
assert.equal(skipped.skipped, true);
assert.equal(skipped.reason, "not_configured");

process.env.INVOICE4U_TOKEN = "test-token";
process.env.INVOICE4U_ENV = "qa";

const calls = [];
globalThis.fetch = async (url, init) => {
  calls.push({ url, body: JSON.parse(init.body) });
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        CreateDocumentResult: {
          ID: "doc-1",
          DocumentNumber: 2001,
          DocumentType: 3,
          Total: 320,
          ApiIdentifier: "booking-ref-9",
          PrintOriginalPDFLink: "https://example.com/pdf",
          Errors: [],
        },
      }),
  };
};

const created = await createBookingInvoiceReceipt({
  booking: {
    patient_name: "נועה",
    patient_email: "noa@example.com",
    treatment_name: "עיסוי",
    appointments: [{ date: "2026-10-01", time: "10:00" }],
  },
  bookingRef: "ref-9",
  totalAgorot: 32000,
  pelecardTransactionId: "TX1",
  approvalNo: "99",
});

assert.equal(created.ok, true);
assert.equal(created.summary.documentNumber, 2001);
assert.equal(created.summary.pdfUrl, "https://example.com/pdf");
assert.equal(calls[0].body.token, "test-token");
assert.equal(calls[0].body.doc.DocumentType, 3);
assert.match(calls[0].url, /apiqa\.invoice4u/);

let stored = null;
const issued = await maybeIssueBookingInvoiceReceipt({
  bookingRef: "ref-10",
  booking: {
    patient_name: "נועה",
    treatment_name: "עיסוי",
    appointments: [{ date: "2026-10-01", time: "10:00" }],
  },
  totalAgorot: 32000,
  resultPayload: { pelecardStatus: "000" },
  updateSession: async (patch) => {
    stored = patch;
  },
});
assert.equal(issued.ok, true);
assert.equal(stored.result_payload.invoice4u.ok, true);
assert.equal(stored.result_payload.pelecardStatus, "000");

const again = await maybeIssueBookingInvoiceReceipt({
  bookingRef: "ref-10",
  booking: {
    patient_name: "נועה",
    treatment_name: "עיסוי",
    appointments: [{ date: "2026-10-01", time: "10:00" }],
  },
  totalAgorot: 32000,
  resultPayload: {
    invoice4u: { ok: true, documentNumber: 2001, id: "doc-1" },
  },
  updateSession: async () => {
    throw new Error("should not update");
  },
});
assert.equal(again.reason, "already_issued");

console.log("invoice4u helpers ok");
