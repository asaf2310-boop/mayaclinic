import {
  collectPelecardParams,
  finalizePaymentFromPelecard,
} from "../../server/pelecardPayments.js";

/**
 * Server-side feedback from Pelecard (ServerSideGoodFeedbackURL / Error).
 * Must respond quickly with 200 so Pelecard treats the notification as delivered.
 */
export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const params = collectPelecardParams(req);
    const outcome = String(params.outcome || "").toLowerCase() === "good" ? "good" : "error";
    const bookingRef = String(
      params.ref || params.ParamX || params.UserKey || params.paramX || params.userKey || ""
    ).trim();

    if (!bookingRef) {
      res.status(400).json({ ok: false, error: "missing booking ref" });
      return;
    }

    const result = await finalizePaymentFromPelecard({
      bookingRef,
      outcome,
      confirmationKey: params.ConfirmationKey || params.confirmationKey || "",
      pelecardTransactionId:
        params.PelecardTransactionId || params.pelecardTransactionId || "",
      pelecardStatusCode: params.PelecardStatusCode || params.pelecardStatusCode || "",
      approvalNo: params.ApprovalNo || params.approvalNo || "",
      resultPayload: params,
    });

    res.status(200).json({
      ok: true,
      status: result.session?.status || null,
      valid: Boolean(result.valid),
      alreadyProcessed: Boolean(result.alreadyProcessed),
    });
  } catch (error) {
    console.error("Pelecard feedback error:", error?.message || error);
    // Still 200 when possible so Pelecard does not retry endlessly on business errors.
    const status = error?.status === 404 ? 404 : 200;
    res.status(status).json({
      ok: false,
      error: error?.message || "feedback failed",
    });
  }
}
