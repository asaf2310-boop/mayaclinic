import { getPaymentSessionByRef } from "../../server/pelecardPayments.js";
import { supabaseRequest } from "../../server/supabaseServer.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const bookingRef = String(req.query?.ref || "").trim();
    if (!bookingRef) {
      res.status(400).json({ error: "ref required" });
      return;
    }

    const session = await getPaymentSessionByRef(bookingRef);
    if (!session) {
      res.status(404).json({ error: "session not found" });
      return;
    }

    let appointments = [];
    const ids = Array.isArray(session.appointment_ids) ? session.appointment_ids.filter(Boolean) : [];
    if (ids.length) {
      const idList = ids.map((id) => encodeURIComponent(id)).join(",");
      appointments =
        (await supabaseRequest(
          `appointments?id=in.(${idList})&select=id,patient_name,patient_email,patient_phone,treatment_name,treatment_price,date,time,status,paid,created_at`
        )) || [];
    }

    const booking = session.booking_payload || {};

    res.status(200).json({
      ok: true,
      bookingRef: session.booking_ref,
      status: session.status,
      totalAgorot: session.total_agorot,
      pelecardTransactionId: session.pelecard_transaction_id || "",
      errorMessage: session.error_message || "",
      treatmentName: booking.treatment_name || appointments[0]?.treatment_name || "",
      treatmentPrice: booking.treatment_price ?? appointments[0]?.treatment_price ?? null,
      appointments:
        appointments.length > 0
          ? appointments
          : (booking.appointments || []).map((item) => ({
              date: item.date,
              time: item.time,
              treatment_name: booking.treatment_name,
              treatment_price: booking.treatment_price,
              status: session.status === "paid" ? "confirmed" : "pending",
              paid: session.status === "paid",
            })),
    });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Failed to load session" });
  }
}
