/**
 * Live ₪1 InvoiceReceipt smoke test against Invoice4U.
 *
 * Usage:
 *   INVOICE4U_TOKEN=... node scripts/live-test-invoice4u.mjs
 * Optional:
 *   INVOICE4U_ENV=qa|production
 *   INVOICE4U_TEST_EMAIL=info@allincenter.co.il
 *
 * Never commits the token. Prints redacted request + full response Errors.
 */
import {
  buildBookingInvoiceReceiptDoc,
  getInvoice4uConfig,
  INVOICE4U_PAYMENT_TYPE,
} from "../server/invoice4u.js";

const config = getInvoice4uConfig();
if (!config.enabled) {
  console.error(
    "INVOICE4U_TOKEN missing. Export it (and optionally INVOICE4U_ENV=qa) then re-run."
  );
  process.exit(1);
}

const testEmail =
  String(process.env.INVOICE4U_TEST_EMAIL || "info@allincenter.co.il").trim() ||
  "info@allincenter.co.il";
const apiIdentifier = `agent-1nis-test-${Date.now()}`;

const doc = buildBookingInvoiceReceiptDoc({
  booking: {
    patient_name: "בדיקת מערכת",
    patient_email: testEmail,
    patient_phone: "0500000000",
    treatment_name: "בדיקת חשבונית 1 ש״ח",
    appointments: [{ date: "2026-09-15", time: "12:00" }],
  },
  bookingRef: apiIdentifier,
  totalAgorot: 100, // ₪1.00
  paymentType: INVOICE4U_PAYMENT_TYPE.CreditCard,
  approvalNo: "0001",
  language: config.language,
});

// Force ApiIdentifier to the unique test id (buildBooking prefixes booking-)
doc.ApiIdentifier = apiIdentifier;
doc.ApiDuplicityTimeValidation = 60;

const url = `${config.baseUrl}/CreateDocument`;
const body = { doc, token: config.token };

console.log("POST", url);
console.log(
  "request (redacted):",
  JSON.stringify(
    {
      ...body,
      token: `${config.token.slice(0, 8)}…(redacted)`,
    },
    null,
    2
  )
);

const response = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify(body),
});

const text = await response.text();
let json = null;
try {
  json = text ? JSON.parse(text) : null;
} catch {
  json = null;
}

const document =
  json?.d ||
  json?.CreateDocumentResult ||
  json?.CreateDocumentWithIdentifierValidationResult ||
  json;

console.log("HTTP", response.status);
console.log(
  "result summary:",
  JSON.stringify(
    {
      Errors: document?.Errors || json?.Errors || null,
      DocumentNumber: document?.DocumentNumber ?? null,
      ID: document?.ID ?? null,
      Total: document?.Total ?? null,
      PrintOriginalPDFLink: document?.PrintOriginalPDFLink ?? null,
      Message: json?.Message || null,
    },
    null,
    2
  )
);

const errors = Array.isArray(document?.Errors) ? document.Errors : [];
const ok = response.ok && (!errors.length || Number(document?.DocumentNumber) > 0);
process.exit(ok ? 0 : 2);
