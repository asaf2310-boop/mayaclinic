export const PELECARD_MESSAGE_SOURCE = "pelecard-return";
const PELECARD_SESSION_TOKEN_KEY = "pelecard-session-token";

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
  if (typeof sessionStorage !== "undefined" && data?.bookingRef && data?.sessionToken) {
    sessionStorage.setItem(`${PELECARD_SESSION_TOKEN_KEY}:${data.bookingRef}`, data.sessionToken);
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

export function getStoredPelecardSessionToken(bookingRef) {
  if (typeof sessionStorage === "undefined") return "";
  return sessionStorage.getItem(`${PELECARD_SESSION_TOKEN_KEY}:${bookingRef}`) || "";
}

export async function fetchPelecardSession(bookingRef, sessionToken = "") {
  const token = String(sessionToken || getStoredPelecardSessionToken(bookingRef) || "").trim();
  const response = await fetch(
    `/api/pelecard/session?ref=${encodeURIComponent(bookingRef)}&token=${encodeURIComponent(token)}`
  );
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
