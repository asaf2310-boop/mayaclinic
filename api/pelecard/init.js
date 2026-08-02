import {
  getPelecardConfig,
  initPelecardPayment,
  resolvePublicOrigin,
  shekelsToAgorot,
} from "../../server/pelecard.js";
import {
  createPaymentSession,
  isBookingPayloadValid,
  normalizeBookingPayload,
} from "../../server/pelecardPayments.js";
import { createPaymentSessionToken } from "../../server/paymentSessionToken.js";

const CLINIC_PAYMENT_TOP =
  process.env.PELECARD_TOP_TEXT || "אופיר - מרכז טיפול הוליסטי";

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const config = getPelecardConfig();
  if (!config.configured) {
    res.status(503).json({
      error: "Pelecard is not configured",
      configured: false,
    });
    return;
  }

  try {
    const body = readBody(req);
    const amountShekels = Number(body.amount);
    const totalAgorot = shekelsToAgorot(amountShekels);
    if (!totalAgorot) {
      res.status(400).json({ error: "amount must be a positive number (ILS)" });
      return;
    }

    const booking = normalizeBookingPayload(body.booking || {});
    if (!isBookingPayloadValid(booking)) {
      res.status(400).json({
        error: "booking payload is required (patient, treatment, appointments)",
      });
      return;
    }

    const bookingRef =
      String(body.bookingRef || "").trim() ||
      (typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `book_${Date.now()}`);
    const origin = resolvePublicOrigin(req);
    if (!origin) {
      res.status(500).json({ error: "Cannot resolve public origin" });
      return;
    }

    const sessionToken = createPaymentSessionToken(bookingRef);
    // Browser lands here (FeedbackOnTop) → redirects to SPA success/failure.
    const goodUrl = `${origin}/api/pelecard/return?outcome=good&ref=${encodeURIComponent(bookingRef)}&token=${encodeURIComponent(sessionToken)}`;
    const errorUrl = `${origin}/api/pelecard/return?outcome=error&ref=${encodeURIComponent(bookingRef)}&token=${encodeURIComponent(sessionToken)}`;
    // Pelecard server notifies our backend (authoritative).
    const serverSideGoodFeedbackUrl = `${origin}/api/pelecard/feedback?outcome=good&ref=${encodeURIComponent(bookingRef)}`;
    const serverSideErrorFeedbackUrl = `${origin}/api/pelecard/feedback?outcome=error&ref=${encodeURIComponent(bookingRef)}`;

    const session = await initPelecardPayment({
      totalAgorot,
      goodUrl,
      errorUrl,
      serverSideGoodFeedbackUrl,
      serverSideErrorFeedbackUrl,
      paramX: bookingRef,
      userKey: bookingRef,
      // Shorter chrome inside the iframe so fields + pay button fit on phones.
      topText: CLINIC_PAYMENT_TOP,
      bottomText: "",
      publicOrigin: origin,
      // Pelecard ManualIframe accepts: Must | Hide | optional (not "required")
      customerIdField: "Hide",
      cvv2Field: "Must",
      cardHolderName: "Hide",
    });

    await createPaymentSession({
      bookingRef,
      totalAgorot: session.totalAgorot,
      confirmationKey: session.confirmationKey,
      bookingPayload: booking,
      tenantId: booking.tenant_id,
    });

    res.status(200).json({
      ok: true,
      configured: true,
      url: session.url,
      confirmationKey: session.confirmationKey,
      bookingRef,
      sessionToken,
      totalAgorot: session.totalAgorot,
      amount: amountShekels,
      cssUrl: session.cssUrl || "",
      logoUrl: session.logoUrl || "",
      successPath: `/payment/success?ref=${encodeURIComponent(bookingRef)}&token=${encodeURIComponent(sessionToken)}`,
      failurePath: `/payment/failure?ref=${encodeURIComponent(bookingRef)}&token=${encodeURIComponent(sessionToken)}`,
    });
  } catch (error) {
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    const message = error?.message || "Failed to init Pelecard payment";
    const missingTable =
      String(message).includes("pelecard_payments") ||
      String(message).includes("Could not find the table");

    res.status(status).json({
      error: missingTable
        ? "חסרה טבלת pelecard_payments — הריצו supabase/pelecard-payments.sql"
        : message,
      configured: true,
    });
  }
}
