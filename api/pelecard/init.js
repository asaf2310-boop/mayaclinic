import {
  getPelecardConfig,
  initPelecardPayment,
  resolvePublicOrigin,
  shekelsToAgorot,
} from "../lib/pelecard.js";

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

    const goodUrl = `${origin}/api/pelecard/return?outcome=good`;
    const errorUrl = `${origin}/api/pelecard/return?outcome=error`;

    const treatmentName = String(body.treatmentName || "").trim();
    const topText = CLINIC_PAYMENT_TOP;
    const bottomText = treatmentName
      ? `תשלום מאובטח עבור: ${treatmentName}`
      : "תשלום מאובטח עבור התור";

    const session = await initPelecardPayment({
      totalAgorot,
      goodUrl,
      errorUrl,
      paramX: bookingRef,
      userKey: bookingRef,
      topText,
      bottomText,
      publicOrigin: origin,
      customerIdField: "optional",
      cvv2Field: "required",
      cardHolderName: "optional",
    });

    res.status(200).json({
      ok: true,
      configured: true,
      url: session.url,
      confirmationKey: session.confirmationKey,
      bookingRef,
      totalAgorot: session.totalAgorot,
      amount: amountShekels,
      cssUrl: `${origin}/payment/pelecard-clinic.css`,
    });
  } catch (error) {
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    res.status(status).json({
      error: error?.message || "Failed to init Pelecard payment",
      configured: true,
    });
  }
}
