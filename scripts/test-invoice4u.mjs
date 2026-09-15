import assert from "node:assert/strict";
import {
  buildBookingInvoiceReceiptDoc,
  createBookingInvoiceReceipt,
  hasSuccessfulInvoice4u,
  isInvoice4uIssuing,
  maybeIssueBookingInvoiceReceipt,
  mergePaymentResultPayload,
  resolveInvoice4uPaymentType,
  getInvoice4uConfig,
  paymentDateJson,
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
assert.match(paymentDateJson(new Date("2026-09-15T12:00:00Z")), /^\/Date\(\d+\)\/$/);

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
assert.equal(doc.AssociatedEmails[0].IsSendDoc, true);
assert.equal(doc.GeneralCustomer.Name, "נועה כהן");
assert.equal(doc.GenerelCustomer, undefined);
assert.match(String(doc.Payments[0].Date), /^\/Date\(\d+\)\/$/);
assert.match(doc.ApiIdentifier, /^booking-abc-123$/);
assert.equal(doc.ApiDuplicityTimeValidation, 86400);

assert.equal(
  hasSuccessfulInvoice4u({ ok: true, documentNumber: 1 }),
  true
);
assert.equal(hasSuccessfulInvoice4u({ ok: false, status: "issuing" }), false);
assert.equal(
  isInvoice4uIssuing({
    ok: false,
    status: "issuing",
    at: new Date().toISOString(),
  }),
  true
);

const mergedKeepsInvoice = mergePaymentResultPayload(
  {
    pelecardStatus: "000",
    invoice4u: { ok: true, documentNumber: 55, id: "doc-55" },
  },
  { PelecardTransactionId: "TX-NEW", ApprovalNo: "99" }
);
assert.equal(mergedKeepsInvoice.invoice4u.documentNumber, 55);
assert.equal(mergedKeepsInvoice.PelecardTransactionId, "TX-NEW");

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
assert.equal(skipped.summary?.reason, "not_configured");

let skippedStored = null;
const skippedIssue = await maybeIssueBookingInvoiceReceipt({
  bookingRef: "ref-skip",
  booking: {
    patient_name: "x",
    treatment_name: "y",
    appointments: [{ date: "2026-01-01", time: "09:00" }],
  },
  totalAgorot: 10000,
  resultPayload: { pelecardStatus: "000" },
  updateSession: async (patch) => {
    skippedStored = patch;
  },
});
assert.equal(skippedIssue.reason, "not_configured");
assert.equal(skippedStored.result_payload.invoice4u.reason, "not_configured");
assert.equal(skippedStored.result_payload.pelecardStatus, "000");

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
        // Production WCF envelope
        d: {
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
assert.match(String(calls[0].body.doc.Payments[0].Date), /^\/Date\(\d+\)\/$/);
assert.match(calls[0].url, /CreateDocumentWithIdentifierValidation/);
assert.match(calls[0].url, /apiqa\.invoice4u/);

let sessionStore = {
  result_payload: { pelecardStatus: "000" },
};
const issued = await maybeIssueBookingInvoiceReceipt({
  bookingRef: "ref-10",
  booking: {
    patient_name: "נועה",
    treatment_name: "עיסוי",
    appointments: [{ date: "2026-10-01", time: "10:00" }],
  },
  totalAgorot: 32000,
  resultPayload: { pelecardStatus: "000" },
  loadSession: async () => sessionStore,
  updateSession: async (patch) => {
    sessionStore = {
      ...sessionStore,
      result_payload: patch.result_payload,
    };
  },
});
assert.equal(issued.ok, true);
assert.equal(sessionStore.result_payload.invoice4u.ok, true);
assert.equal(sessionStore.result_payload.pelecardStatus, "000");

// Skip when already issued (even if caller only passes a fresh Pelecard payload).
calls.length = 0;
const again = await maybeIssueBookingInvoiceReceipt({
  bookingRef: "ref-10",
  booking: {
    patient_name: "נועה",
    treatment_name: "עיסוי",
    appointments: [{ date: "2026-10-01", time: "10:00" }],
  },
  totalAgorot: 32000,
  resultPayload: {
    PelecardTransactionId: "TX-RETRY",
    ApprovalNo: "1",
  },
  loadSession: async () => sessionStore,
  updateSession: async () => {
    throw new Error("should not update when already issued");
  },
});
assert.equal(again.reason, "already_issued");
assert.equal(calls.length, 0);

// Paid-retry without prior invoice still issues once.
sessionStore = { result_payload: { pelecardStatus: "000" } };
calls.length = 0;
const paidRetryIssue = await maybeIssueBookingInvoiceReceipt({
  bookingRef: "ref-paid-retry",
  booking: {
    patient_name: "נועה",
    treatment_name: "עיסוי",
    appointments: [{ date: "2026-10-01", time: "10:00" }],
  },
  totalAgorot: 32000,
  resultPayload: { PelecardTransactionId: "TX-PR", ApprovalNo: "2" },
  loadSession: async () => sessionStore,
  claimIssuance: async (claimSummary) => {
    sessionStore = {
      result_payload: {
        ...sessionStore.result_payload,
        invoice4u: claimSummary,
      },
    };
    return { claimed: true, reason: "claimed", session: sessionStore };
  },
  updateSession: async (patch) => {
    sessionStore = {
      ...sessionStore,
      result_payload: patch.result_payload,
    };
  },
});
assert.equal(paidRetryIssue.ok, true);
assert.equal(paidRetryIssue.skipped, false);
assert.equal(calls.length, 1);
assert.equal(sessionStore.result_payload.invoice4u.ok, true);

// Second paid-retry with fresh Pelecard payload must not CreateDocument again.
calls.length = 0;
const paidRetrySkip = await maybeIssueBookingInvoiceReceipt({
  bookingRef: "ref-paid-retry",
  booking: {
    patient_name: "נועה",
    treatment_name: "עיסוי",
    appointments: [{ date: "2026-10-01", time: "10:00" }],
  },
  totalAgorot: 32000,
  resultPayload: { PelecardTransactionId: "TX-PR-2" },
  loadSession: async () => sessionStore,
  claimIssuance: async () => {
    throw new Error("should not claim when already issued");
  },
  updateSession: async () => {
    throw new Error("should not update when already issued");
  },
});
assert.equal(paidRetrySkip.reason, "already_issued");
assert.equal(calls.length, 0);

// DocumentAlreadyCreated (134) with DocumentNumber must count as success
calls.length = 0;
globalThis.fetch = async (url, init) => {
  calls.push({ url, body: JSON.parse(init.body) });
  return {
    ok: true,
    status: 200,
    text: async () =>
      JSON.stringify({
        CreateDocumentWithIdentifierValidationResult: {
          ID: "doc-dup",
          DocumentNumber: 2002,
          DocumentType: 3,
          Errors: [{ ID: 134, Error: "DocumentAlreadyCreated", Paramters: null }],
        },
      }),
  };
};
const dup = await createBookingInvoiceReceipt({
  booking: {
    patient_name: "נועה",
    patient_email: "noa@example.com",
    treatment_name: "עיסוי",
    appointments: [{ date: "2026-10-01", time: "10:00" }],
  },
  bookingRef: "ref-dup",
  totalAgorot: 100,
});
assert.equal(dup.ok, true);
assert.equal(dup.summary.documentNumber, 2002);
assert.match(calls[0].url, /CreateDocumentWithIdentifierValidation/);

console.log("invoice4u helpers ok");
