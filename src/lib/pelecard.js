export const PELECARD_MESSAGE_SOURCE = "pelecard-return";

export function createBookingRef() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `book_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function fetchPelecardStatus() {
  try {
    const response = await fetch("/api/pelecard/status");
    if (!response.ok) return { configured: false };
    return await response.json();
  } catch {
    return { configured: false };
  }
}

export async function initPelecardSession({ amount, bookingRef, treatmentName, booking }) {
  const response = await fetch("/api/pelecard/init", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, bookingRef, treatmentName, booking }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Failed to init Pelecard");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function validatePelecardSession(payload) {
  const response = await fetch("/api/pelecard/validate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Failed to validate Pelecard");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function fetchPelecardSession(bookingRef) {
  const response = await fetch(`/api/pelecard/session?ref=${encodeURIComponent(bookingRef)}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "Failed to load payment session");
    error.status = response.status;
    throw error;
  }
  return data;
}

export function isPelecardReturnMessage(event) {
  const data = event?.data;
  return Boolean(data && typeof data === "object" && data.source === PELECARD_MESSAGE_SOURCE);
}
