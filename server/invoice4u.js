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
 * WCF DataContractJsonSerializer requires Microsoft JSON dates:
 * `/Date(<epoch-ms>)/` — ISO-8601 (even without Z) returns HTTP 500:
 * "DateTime content '...' does not start with '/Date(' ..."
 * (GitBook CreateDocument examples show ISO; production API rejects them.)
 */
export function paymentDateJson(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const safe = Number.isNaN(d.getTime()) ? new Date() : d;
  return `/Date(${safe.getTime()})/`;
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
  // Production WCF REST wraps the Document in `{ d: {...} }`.
  // Some docs / SOAP-style clients use CreateDocumentResult instead.
  return (
    payload.d ||
    payload.CreateDocumentWithIdentifierValidationResult ||
    payload.CreateDocumentResult ||
    payload
  );
}

function isDocumentAlreadyCreatedSuccess(document, errors) {
  if (!document || typeof document !== "object") return false;
  const hasNumber =
    Number(document.DocumentNumber) > 0 || Boolean(document.ID || document.Id);
  if (!hasNumber) return false;
  return (errors || []).some((item) => {
    const id = Number(item?.ID ?? item?.Id);
    const name = String(item?.Error || item?.error || "");
    return id === 134 || name === "DocumentAlreadyCreated";
  });
}

/** Successful Invoice4U summary already stored on a payment session. */
export function hasSuccessfulInvoice4u(invoiceSummary) {
  const inv =
    invoiceSummary && typeof invoiceSummary === "object" ? invoiceSummary : null;
  return Boolean(inv?.ok && (inv.documentNumber || inv.id));
}

/**
 * Another worker claimed CreateDocument and has not finished yet.
 * Stale claims (default 2 min) are ignored so a crashed worker can retry.
 */
export function isInvoice4uIssuing(invoiceSummary, { staleMs = 120_000 } = {}) {
  const inv =
    invoiceSummary && typeof invoiceSummary === "object" ? invoiceSummary : null;
  if (!inv || inv.ok || inv.status !== "issuing") return false;
  const at = Date.parse(String(inv.at || ""));
  if (!Number.isFinite(at)) return true;
  return Date.now() - at < staleMs;
}

export function mergePaymentResultPayload(storedPayload, incomingPayload) {
  const stored =
    storedPayload && typeof storedPayload === "object" && !Array.isArray(storedPayload)
      ? storedPayload
      : null;
  const incoming =
    incomingPayload &&
    typeof incomingPayload === "object" &&
    !Array.isArray(incomingPayload)
      ? incomingPayload
      : null;

  if (!stored && !incoming) {
    return incomingPayload == null ? {} : { pelecard: incomingPayload };
  }
  if (!stored) return { ...incoming };
  if (!incoming) return { ...stored };

  const merged = { ...stored, ...incoming };
  // Never let a fresh Pelecard callback wipe a stored invoice summary.
  if (hasSuccessfulInvoice4u(stored.invoice4u)) {
    merged.invoice4u = stored.invoice4u;
  } else if (
    isInvoice4uIssuing(stored.invoice4u) &&
    !hasSuccessfulInvoice4u(incoming.invoice4u)
  ) {
    merged.invoice4u = stored.invoice4u;
  } else if (stored.invoice4u && !incoming.invoice4u) {
    merged.invoice4u = stored.invoice4u;
  }
  return merged;
}

function newInvoiceClaimToken() {
  return `inv-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
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
    const detail =
      json?.ExceptionDetail?.InnerException?.InnerException?.Message ||
      json?.ExceptionDetail?.InnerException?.Message ||
      json?.Message ||
      text?.slice(0, 300) ||
      response.statusText;
    const err = new Error(`Invoice4U HTTP ${response.status}: ${detail}`);
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
        Date: paymentDateJson(issueDate),
        NumberOfPayments: 1,
        PaymentNumber:
          String(approvalNo || pelecardTransactionId || "").slice(-4) ||
          undefined,
      },
    ],
    ExternalComments: externalBits.join(" | ").slice(0, 5000) || undefined,
  };

  if (fields.patientEmail) {
    // IsSendDoc=true forces delivery of the PDF email to this address.
    doc.AssociatedEmails = [
      { Mail: fields.patientEmail, IsUserMail: false, IsSendDoc: true },
    ];
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

  const emailTo = Array.isArray(doc?.AssociatedEmails)
    ? doc.AssociatedEmails.map((item) => item?.Mail).filter(Boolean).join(",")
    : "";
  const emailLabel = emailTo
    ? `email=${emailTo} IsSendDoc=true`
    : "email=(none)";

  try {
    // Strict ApiIdentifier idempotency — plain /CreateDocument can still mint
    // a second document on retries (ApiDuplicityTimeValidation is only a soft window).
    const raw = await postInvoice4u(
      "/CreateDocumentWithIdentifierValidation",
      { doc },
      { token: config.token, baseUrl: config.baseUrl }
    );
    const document = unwrapCreateDocumentResult(raw);
    const errors = Array.isArray(document?.Errors) ? document.Errors : [];
    if (errors.length && !isDocumentAlreadyCreatedSuccess(document, errors)) {
      const message = formatErrors(errors) || "Invoice4U returned Errors";
      console.error(
        "Invoice4U CreateDocument errors:",
        message,
        options.bookingRef || "",
        emailLabel,
        document
      );
      return {
        ok: false,
        skipped: false,
        error: message,
        document,
        summary: summarizeInvoiceDocument(document, { error: message }),
      };
    }

    if (errors.length && isDocumentAlreadyCreatedSuccess(document, errors)) {
      console.info(
        "Invoice4U CreateDocument already_exists (134):",
        document.DocumentNumber || document.ID,
        options.bookingRef || "",
        emailLabel
      );
    }

    const summary = summarizeInvoiceDocument(document);
    console.info(
      "Invoice4U CreateDocument ok:",
      summary.documentNumber || summary.id,
      options.bookingRef || "",
      emailLabel
    );
    return {
      ok: true,
      skipped: false,
      document,
      summary,
    };
  } catch (error) {
    console.error(
      "Invoice4U CreateDocument failed:",
      error?.message || error,
      options.bookingRef || "",
      emailLabel,
      error?.body ? JSON.stringify(error.body).slice(0, 500) : ""
    );
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
 *
 * Idempotency layers:
 * 1. Skip when stored result_payload.invoice4u is already ok (reload via loadSession).
 * 2. Optional claimIssuance (optimistic CAS) or in-payload "issuing" claim.
 * 3. Invoice4U CreateDocumentWithIdentifierValidation + stable ApiIdentifier booking-{ref}.
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
  loadSession,
  claimIssuance,
}) {
  const readLatestPayload = async () => {
    if (typeof loadSession === "function") {
      try {
        const latest = await loadSession();
        const stored = latest?.result_payload;
        return mergePaymentResultPayload(stored, resultPayload);
      } catch (error) {
        console.error(
          "Invoice4U loadSession failed; using provided payload:",
          error?.message || error
        );
      }
    }
    return mergePaymentResultPayload(null, resultPayload);
  };

  let workingPayload = await readLatestPayload();
  let existing = workingPayload?.invoice4u || null;

  if (hasSuccessfulInvoice4u(existing)) {
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

  if (isInvoice4uIssuing(existing)) {
    console.info("Invoice4U skipped: issuing_in_progress", bookingRef || "");
    return {
      ok: false,
      skipped: true,
      reason: "issuing_in_progress",
      summary: existing,
    };
  }

  const claimToken = newInvoiceClaimToken();
  const claimSummary = {
    ok: false,
    status: "issuing",
    claimToken,
    at: new Date().toISOString(),
  };

  if (typeof claimIssuance === "function") {
    try {
      const claim = await claimIssuance(claimSummary);
      if (!claim?.claimed) {
        const reason = claim?.reason || "issuing_in_progress";
        const summary =
          claim?.session?.result_payload?.invoice4u ||
          existing ||
          claimSummary;
        if (hasSuccessfulInvoice4u(summary) || reason === "already_issued") {
          return {
            ok: true,
            skipped: true,
            reason: "already_issued",
            summary,
          };
        }
        console.info("Invoice4U skipped:", reason, bookingRef || "");
        return {
          ok: false,
          skipped: true,
          reason:
            reason === "lost_race" ? "issuing_in_progress" : reason,
          summary,
        };
      }
      workingPayload = mergePaymentResultPayload(
        claim.session?.result_payload,
        resultPayload
      );
    } catch (error) {
      console.error(
        "Invoice4U claimIssuance failed:",
        error?.message || error
      );
    }
  } else if (typeof updateSession === "function") {
    try {
      await updateSession({
        result_payload: {
          ...workingPayload,
          invoice4u: claimSummary,
        },
      });
    } catch (error) {
      console.error(
        "Failed to claim Invoice4U issuance on payment session:",
        error?.message || error
      );
    }

    // Re-read after claim — another worker may have finished or claimed first.
    workingPayload = await readLatestPayload();
    existing = workingPayload?.invoice4u || null;
    if (hasSuccessfulInvoice4u(existing)) {
      console.info(
        "Invoice4U skipped: already_issued_after_claim",
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
    if (
      isInvoice4uIssuing(existing) &&
      existing.claimToken &&
      existing.claimToken !== claimToken
    ) {
      console.info(
        "Invoice4U skipped: lost_issuing_claim",
        bookingRef || ""
      );
      return {
        ok: false,
        skipped: true,
        reason: "issuing_in_progress",
        summary: existing,
      };
    }
  }

  const result = await createBookingInvoiceReceipt({
    bookingRef,
    booking,
    totalAgorot,
    resultPayload: workingPayload,
    pelecardTransactionId,
    approvalNo,
    paymentHint,
  });

  if (typeof updateSession === "function" && result.summary) {
    try {
      const latestPayload = await readLatestPayload();
      // If another path already stored a successful invoice, keep it.
      if (hasSuccessfulInvoice4u(latestPayload?.invoice4u)) {
        return {
          ok: true,
          skipped: true,
          reason: "already_issued",
          summary: latestPayload.invoice4u,
        };
      }
      await updateSession({
        result_payload: {
          ...latestPayload,
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
