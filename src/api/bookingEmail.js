import { backendMode } from "@/api/base44Client";

export async function sendBookingConfirmationEmail(appointmentIds = []) {
  if (backendMode === "demo") return;
  if (!appointmentIds.length) return;

  try {
    await fetch("/api/send-booking-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentIds }),
    });
  } catch {
    // Don't block booking UX if email fails.
  }
}
