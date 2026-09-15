/**
 * Invoice4U — issue InvoiceReceipt (חשבונית מס קבלה) after paid booking.
 * Docs: https://invoice4u.gitbook.io/invoice4u-docs
 *
 * POST {base}/CreateDocument
 * body: { doc, token }
 * DocumentType 3 = InvoiceReceipt
 */

export const INVOICE4U_DOCUMENT_TYPE = {
  Invoice: 1,
  Receipt: 2,
  InvoiceReceipt: 3,
};

/** Payments[].PaymentType */
export const INVOICE4U_PAYMENT_TYPE = {
  CreditCard: 1,
  Check: 2,
  MoneyTransfer: 3,
  Cash: 4,
  Credit: 5,
  WithholdingTax: 6,
  Other: 7,
  Bit: 8,
  PayBox: 9,
};

const PROD_BASE = "https://api.invoice4u.co.il/Services/ApiService.svc";
const QA_BASE = "https://apiqa.invoice4u.co.il/Services/ApiService.svc";

export function getInvoice4uConfig() {
  const token = String(process.env.INVOICE4U_TOKEN || "").trim();
  const envHint = String(process.env.INVOICE4U_ENV || "").trim().toLowerCase();
  const baseOverride = String(process.env.INVOICE4U_BASE_URL || "")
    .trim()
    .replace(/\/$/, "");
  const useQa =
    envHint === "qa" ||
    envHint === "staging" ||
    baseOverride.includes("apiqa.invoice4u");
  const baseUrl = baseOverride || (useQa ? QA_BASE : PROD_BASE);
  const enabledFlag = String(process.env.INVOICE4U_ENABLED || "")
    .trim()
    .toLowerCase();
  const enabled =
    Boolean(token) &&
    enabledFlag !== "0" &&
    enabledFlag !== "false" &&
    enabledFlag !== "off";

  return {
    token,
    baseUrl,
    enabled,
    language: Number(process.env.INVOICE4U_LANGUAGE || 1) === 2 ? 2 : 1,
  };
}

export function isInvoice4uConfigured() {
  return getInvoice4uConfig().enabled;
}

function roundMoney(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

/**
 * Invoice4U / WCF accepts local datetime without timezone suffix, e.g. 2026-07-05T00:00:00
 * (docs CreateDocument example). Avoid ISO "Z" which some endpoints reject.
 */
function paymentDateIso(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${safe.getFullYear()}-${pad(safe.getMonth() + 1)}-${pad(safe.getDate())}` +
    `T${pad(safe.getHours())}:${pad(safe.getMinutes())}:${pad(safe.getSeconds())}`
  );
}

/**
 * Infer PaymentType from Pelecard payload / free text. Default: CreditCard.
 */
export function resolveInvoice4uPaymentType(resultPayload = {}, hint = "") {
  const blob = [
    hint,
    typeof resultPayload === "string"
      ? resultPayload
      : JSON.stringify(resultPayload || {}),
  ]
    .join(" ")
    .toLowerCase();

  if (/\bpaybox\b|פייבוקס|פייבקס/.test(blob)) {
    return INVOICE4U_PAYMENT_TYPE.PayBox;
  }
  if (/\bbit\b|ביט/.test(blob)) {
    return INVOICE4U_PAYMENT_TYPE.Bit;
  }
  return INVOICE4U_PAYMENT_TYPE.CreditCard;
}

function unwrapCreateDocumentResult(payload) {
  if (!payload || typeof payload !== "object") return payload;
  return (
    payload.CreateDocumentResult ||
    payload.CreateDocumentWithIdentifierValidationResult ||
    payload
  );
}

function formatErrors(errors) {
  if (!Array.isArray(errors) || !errors.length) return "";
  return errors
    .map((item) => {
      const id = item?.ID ?? item?.Id ?? "";
      const name = item?.Error || item?.error || "Error";
      const params = item?.Paramters || item?.Parameters || "";
      return [id, name, params].filter(Boolean).join(" ");
    })
    .join("; ");
}

async function postInvoice4u(path, body, { token, baseUrl }) {
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ ...body, token }),
  });

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    const err = new Error(
      `Invoice4U HTTP ${response.status}: ${text?.slice(0, 300) || response.statusText}`
    );
    err.status = response.status;
    err.body = json || text;
    throw err;
  }

  return json;
}

function readBookingFields(booking = {}) {
  return {
    patientName:
      String(booking.patient_name || booking.patientName || "").trim() || "לקוח",
    patientEmail: String(
      booking.patient_email || booking.patientEmail || ""
    ).trim(),
    patientPhone: String(
      booking.patient_phone || booking.patientPhone || ""
    ).trim(),
    treatmentName:
      String(
        booking.treatment_name || booking.treatmentName || "טיפול"
      ).trim() || "טיפול",
    appointments: Array.isArray(booking.appointments) ? booking.appointments : [],
  };
}

/**
 * Build CreateDocument `doc` for InvoiceReceipt (type 3).
 * Field names follow Invoice4U CreateDocument examples.
 */
export function buildBookingInvoiceReceiptDoc({
  booking,
  bookingRef,
  totalAgorot,
  paymentType = INVOICE4U_PAYMENT_TYPE.CreditCard,
  pelecardTransactionId = "",
  approvalNo = "",
  language = 1,
  issueDate = new Date(),
}) {
  const amountIls = roundMoney((Number(totalAgorot) || 0) / 100);
  const fields = readBookingFields(booking);
  const qty = Math.max(1, fields.appointments.length || 1);
  const unitPrice = roundMoney(amountIls / qty);
  const itemsTotal = roundMoney(unitPrice * qty);
  const ref = String(bookingRef || "").trim();

  const scheduleNote = fields.appointments
    .map((item) => `${item.date || ""} ${item.time || ""}`.trim())
    .filter(Boolean)
    .join(", ");

  const externalBits = [
    fields.patientPhone ? `טלפון: ${fields.patientPhone}` : "",
    scheduleNote ? `מועדים: ${scheduleNote}` : "",
    pelecardTransactionId ? `Pelecard: ${pelecardTransactionId}` : "",
    approvalNo ? `אישור: ${approvalNo}` : "",
    ref ? `הזמנה: ${ref}` : "",
  ].filter(Boolean);

  const doc = {
    DocumentType: INVOICE4U_DOCUMENT_TYPE.InvoiceReceipt,
    Subject: `${fields.treatmentName} — ${fields.patientName}`,
    TaxIncluded: true,
    Currency: "ILS",
    Language: language,
    ApiIdentifier: ref ? `booking-${ref}` : undefined,
    ApiDuplicityTimeValidation: 86400,
    AutoFixPaymentsMismatchItems: true,
    // Document property is GeneralCustomer; schema type is misspelled GenerelCustomer.
    GeneralCustomer: {
      Name: fields.patientName,
    },
    Items: [
      {
        Name: fields.treatmentName,
        Quantity: qty,
        Price: unitPrice,
        PriceIncludeTax: unitPrice,
        Description: scheduleNote || undefined,
      },
    ],
    Payments: [
      {
        PaymentType: Number(paymentType) || INVOICE4U_PAYMENT_TYPE.CreditCard,
        Amount: itemsTotal,
        Date: paymentDateIso(issueDate),
        NumberOfPayments: 1,
        PaymentNumber:
          String(approvalNo || pelecardTransactionId || "").slice(-4) ||
          undefined,
      },
    ],
    ExternalComments: externalBits.join(" | ").slice(0, 5000) || undefined,
  };

  if (fields.patientEmail) {
    doc.AssociatedEmails = [{ Mail: fields.patientEmail, IsUserMail: false }];
  }

  return doc;
}

export function summarizeInvoiceDocument(document, extras = {}) {
  if (!document || typeof document !== "object") {
    return { ok: false, ...extras, at: new Date().toISOString() };
  }
  return {
    ok: extras.error ? false : true,
    id: document.ID || document.Id || null,
    documentNumber: document.DocumentNumber ?? null,
    documentType:
      document.DocumentType ?? INVOICE4U_DOCUMENT_TYPE.InvoiceReceipt,
    apiIdentifier: document.ApiIdentifier || null,
    total: document.Total ?? null,
    pdfUrl:
      document.PrintOriginalPDFLink ||
      document.PrintCertifiedCopyPDFLink ||
      document.PrintOriginalPDFUrl ||
      document.PrintCertifiedCopyPDFUrl ||
      null,
    error: extras.error || null,
    at: new Date().toISOString(),
  };
}

/**
 * Create InvoiceReceipt for a paid booking.
 * Never throws for API/business errors — returns { ok, skipped, ... }.
 */
export async function createBookingInvoiceReceipt(options = {}) {
  const config = getInvoice4uConfig();
  if (!config.enabled) {
    console.warn(
      "Invoice4U skipped: not_configured (set INVOICE4U_TOKEN on Vercel Production and redeploy)"
    );
    return {
      ok: false,
      skipped: true,
      reason: "not_configured",
      summary: {
        ok: false,
        skipped: true,
        reason: "not_configured",
        at: new Date().toISOString(),
      },
    };
  }

  const totalAgorot = Math.round(Number(options.totalAgorot) || 0);
  if (totalAgorot <= 0) {
    console.warn("Invoice4U skipped: zero_amount");
    return {
      ok: false,
      skipped: true,
      reason: "zero_amount",
      summary: {
        ok: false,
        skipped: true,
        reason: "zero_amount",
        at: new Date().toISOString(),
      },
    };
  }

  const paymentType =
    options.paymentType != null
      ? Number(options.paymentType)
      : resolveInvoice4uPaymentType(options.resultPayload, options.paymentHint);

  const doc = buildBookingInvoiceReceiptDoc({
    booking: options.booking,
    bookingRef: options.bookingRef,
    totalAgorot,
    paymentType,
    pelecardTransactionId: options.pelecardTransactionId,
    approvalNo: options.approvalNo,
    language: config.language,
  });

  try {
    const raw = await postInvoice4u(
      "/CreateDocument",
      { doc },
      { token: config.token, baseUrl: config.baseUrl }
    );
    const document = unwrapCreateDocumentResult(raw);
    const errors = Array.isArray(document?.Errors) ? document.Errors : [];
    if (errors.length) {
      const message = formatErrors(errors) || "Invoice4U returned Errors";
      console.error("Invoice4U CreateDocument errors:", message, document);
      return {
        ok: false,
        skipped: false,
        error: message,
        document,
        summary: summarizeInvoiceDocument(document, { error: message }),
      };
    }

    const summary = summarizeInvoiceDocument(document);
    console.info(
      "Invoice4U CreateDocument ok:",
      summary.documentNumber || summary.id,
      options.bookingRef || ""
    );
    return {
      ok: true,
      skipped: false,
      document,
      summary,
    };
  } catch (error) {
    console.error("Invoice4U CreateDocument failed:", error?.message || error);
    return {
      ok: false,
      skipped: false,
      error: error?.message || String(error),
      summary: {
        ok: false,
        error: error?.message || String(error),
        at: new Date().toISOString(),
      },
    };
  }
}

/**
 * Issue invoice if configured; merge summary into payment session result_payload.
 * Name imported by server/pelecardPayments.js
 */
export async function maybeIssueBookingInvoiceReceipt({
  bookingRef,
  booking,
  totalAgorot,
  resultPayload,
  pelecardTransactionId,
  approvalNo,
  paymentHint = "",
  updateSession,
}) {
  const existing =
    resultPayload && typeof resultPayload === "object"
      ? resultPayload.invoice4u
      : null;
  if (existing?.ok && (existing.documentNumber || existing.id)) {
    console.info(
      "Invoice4U skipped: already_issued",
      existing.documentNumber || existing.id,
      bookingRef || ""
    );
    return {
      ok: true,
      skipped: true,
      reason: "already_issued",
      summary: existing,
    };
  }

  const result = await createBookingInvoiceReceipt({
    bookingRef,
    booking,
    totalAgorot,
    resultPayload,
    pelecardTransactionId,
    approvalNo,
    paymentHint,
  });

  if (typeof updateSession === "function" && result.summary) {
    const basePayload =
      resultPayload &&
      typeof resultPayload === "object" &&
      !Array.isArray(resultPayload)
        ? { ...resultPayload }
        : { pelecard: resultPayload || null };
    try {
      await updateSession({
        result_payload: {
          ...basePayload,
          invoice4u: result.summary,
        },
      });
    } catch (error) {
      console.error(
        "Failed to store Invoice4U summary on payment session:",
        error?.message || error
      );
    }
  }

  return result;
}
