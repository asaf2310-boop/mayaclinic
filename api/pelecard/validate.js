import { getPelecardConfig, validatePelecardPayment } from "../../server/pelecard.js";
import { verifyPaymentSessionToken } from "../../server/paymentSessionToken.js";

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
    res.status(503).json({ error: "Pelecard is not configured", valid: false });
    return;
  }

  try {
    const body = readBody(req);
    const bookingRef = String(body.bookingRef || body.uniqueKey || body.userKey || "").trim();
    const sessionToken = String(body.token || body.sessionToken || "").trim();

    // Prevent unauthenticated probing of ValidateByUniqueKey.
    if (!bookingRef || !verifyPaymentSessionToken(bookingRef, sessionToken)) {
      res.status(403).json({ valid: false, error: "invalid session token" });
      return;
    }

    const confirmationKey = String(body.confirmationKey || "").trim();
    const uniqueKey = String(
      body.uniqueKey || body.userKey || body.pelecardTransactionId || body.bookingRef || ""
    ).trim();
    const totalAgorot = Math.round(Number(body.totalAgorot) || 0);
    const statusCode = String(body.pelecardStatusCode || body.PelecardStatusCode || "").trim();

    if (statusCode && statusCode !== "000") {
      res.status(200).json({
        valid: false,
        reason: "payment_not_approved",
        pelecardStatusCode: statusCode,
      });
      return;
    }

    const valid = await validatePelecardPayment({
      confirmationKey,
      uniqueKey,
      totalAgorot,
    });

    res.status(200).json({
      valid,
      bookingRef,
      totalAgorot,
      pelecardTransactionId: String(
        body.pelecardTransactionId || body.PelecardTransactionId || ""
      ),
    });
  } catch (error) {
    const status = error?.status && Number.isInteger(error.status) ? error.status : 500;
    res.status(status).json({
      valid: false,
      error: error?.message || "Failed to validate Pelecard payment",
    });
  }
}
