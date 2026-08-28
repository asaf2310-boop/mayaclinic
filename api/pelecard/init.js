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
import { createPendingGiftVoucher, GIFT_VOUCHER_UNIT_ILS } from "../../server/giftVouchers.js";

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
    const isGiftVoucher = body.kind === "gift_voucher";
    const quantity = Number(body.quantity);
    const amountShekels = isGiftVoucher ? quantity * GIFT_VOUCHER_UNIT_ILS : Number(body.amount);
    const totalAgorot = shekelsToAgorot(amountShekels);
    if (!totalAgorot) {
      res.status(400).json({ error: "amount must be a positive number (ILS)" });
      return;
    }

    const giftEmail = String(body.purchaser_email || "").trim();
    const recipientEmail = String(body.recipient_email || "").trim();
    const sendToRecipient = Boolean(body.send_to_recipient);
    const sendToWhatsapp = Boolean(body.send_to_whatsapp);
    const recipientPhone = String(body.recipient_phone || "").replace(/[^\d+]/g, "");
    const giftValid = Number.isInteger(quantity) && quantity >= 1 && quantity <= 10 &&
      String(body.purchaser_name || "").trim() && String(body.purchaser_phone || "").trim() && String(body.recipient_name || "").trim() &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(giftEmail) && (!sendToRecipient || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) && (!sendToWhatsapp || recipientPhone.replace(/\D/g, "").length >= 9);
    const booking = isGiftVoucher ? {
      kind: "gift_voucher", quantity, unit_price: GIFT_VOUCHER_UNIT_ILS,
      purchaser_name: String(body.purchaser_name).trim(), purchaser_phone: String(body.purchaser_phone).trim(),
      purchaser_email: giftEmail, tenant_id: String(body.tenant_id || process.env.VITE_CLINIC_TENANT_ID || "maya").trim(),
      recipient_name: String(body.recipient_name || "").trim(), recipient_email: recipientEmail,
      send_to_recipient: sendToRecipient, greeting: String(body.greeting || "").trim(),
      recipient_phone: recipientPhone, send_to_whatsapp: sendToWhatsapp,
      treatment_name: "שובר מתנה לטיפול",
    } : normalizeBookingPayload(body.booking || {});
    if ((isGiftVoucher && !giftValid) || (!isGiftVoucher && !isBookingPayloadValid(booking))) {
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
    // Keep Good/Error URLs short: Pelecard may drop long query strings (session token).
    // Token is recovered from sessionStorage on the return page / SPA.
    const goodUrl = `${origin}/api/pelecard/return?outcome=good&ref=${encodeURIComponent(bookingRef)}`;
    const errorUrl = `${origin}/api/pelecard/return?outcome=error&ref=${encodeURIComponent(bookingRef)}`;
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
    if (isGiftVoucher) {
      await createPendingGiftVoucher({ bookingRef, quantity, purchaserName: booking.purchaser_name, purchaserPhone: booking.purchaser_phone, purchaserEmail: booking.purchaser_email, recipientName: booking.recipient_name, recipientEmail: booking.recipient_email, recipientPhone: booking.recipient_phone, sendToRecipient: booking.send_to_recipient, sendToWhatsapp: booking.send_to_whatsapp, greeting: booking.greeting, tenantId: booking.tenant_id });
    }

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
    const missingGiftVouchers = String(message).includes("gift_vouchers");
    const missingTable =
      String(message).includes("pelecard_payments") ||
      String(message).includes("Could not find the table");

    res.status(status).json({
      error: missingGiftVouchers
        ? "חסרה טבלת gift_vouchers — הריצו supabase/gift-vouchers.sql ב-Supabase"
        : missingTable
        ? "חסרה טבלת pelecard_payments — הריצו supabase/pelecard-payments.sql"
        : message,
      configured: true,
    });
  }
}
