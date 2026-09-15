import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildBookingInvoiceReceiptDoc } from "../server/invoice4u.js";
import { getBookingNotifyEmails } from "../server/bookingNotify.js";

const doc = buildBookingInvoiceReceiptDoc({
  booking: {
    patient_name: "בדיקה",
    patient_email: "info@allincenter.co.il",
    patient_phone: "050",
    treatment_name: "טיפול",
    appointments: [{ date: "2026-09-20", time: "10:00" }],
  },
  bookingRef: "ref-1",
  totalAgorot: 32000,
});

assert.equal(doc.AssociatedEmails[0].Mail, "info@allincenter.co.il");
assert.equal(doc.AssociatedEmails[0].IsSendDoc, true);
assert.equal(doc.AssociatedEmails[0].IsUserMail, false);

process.env.BOOKING_NOTIFY_EMAILS =
  "Info@AllInCenter.co.il,owner@clinic.com,OWNER@clinic.com";
const recipients = getBookingNotifyEmails();
assert.deepEqual(recipients, ["info@allincenter.co.il", "owner@clinic.com"]);

const patientEmail = String("Info@AllInCenter.co.il").trim().toLowerCase();
const filtered = recipients.filter(
  (email) => String(email || "").trim().toLowerCase() !== patientEmail
);
assert.deepEqual(filtered, ["owner@clinic.com"]);

const pelecardSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../server/pelecardPayments.js"),
  "utf8"
);
assert.match(
  pelecardSrc,
  /status=in\.\(pending,failed\)/,
  "claim must reclaim from pending and failed"
);
assert.match(
  pelecardSrc,
  /status === "paid" \|\| session\.status === "processing"/,
  "finalize must treat processing as already claimed"
);
assert.match(
  pelecardSrc,
  /pelecard-payments-processing-status\.sql/,
  "fallback must point at the processing-status migration"
);

const invoiceSrc = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../server/invoice4u.js"),
  "utf8"
);
assert.match(invoiceSrc, /IsSendDoc:\s*true/);
assert.match(
  invoiceSrc,
  /CreateDocumentWithIdentifierValidation/,
  "must use identifier-validated create for ApiIdentifier idempotency"
);
assert.match(invoiceSrc, /already_issued/);
assert.match(invoiceSrc, /status:\s*"issuing"/);

assert.match(
  pelecardSrc,
  /mergePaymentResultPayload/,
  "paid retry must merge stored invoice4u with fresh Pelecard payload"
);
assert.match(
  pelecardSrc,
  /claimInvoiceIssuance/,
  "finalize must claim invoice issuance before CreateDocument"
);
assert.match(
  pelecardSrc,
  /hasSuccessfulInvoice4u/,
  "paid retry must skip when invoice already ok"
);

console.log("double-confirm guards ok");
