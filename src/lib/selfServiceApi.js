import { bookingFetch } from "@/lib/bookingMount";

const SESSION_KEY = "ofirbaby_self_service_session";

export function loadSelfServiceSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveSelfServiceSession({ token, phone } = {}) {
  sessionStorage.setItem(
    SESSION_KEY,
    JSON.stringify({ token: String(token || ""), phone: String(phone || ""), at: Date.now() })
  );
}

export function clearSelfServiceSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
}

async function postSelfService(body) {
  // Call the public-data handler directly. On ofirbaby.com the /booking mount
  // only proxies real api/*.js paths; a dedicated self-service alias is not
  // forwarded there, so OTP would 404 as HTML and show a generic failure.
  const response = await bookingFetch("/api/public-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const contentType = String(response.headers?.get?.("content-type") || "");
  let data = null;
  if (contentType.includes("application/json")) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const error = new Error(
      data?.message ||
        (response.status === 404
          ? "שירות העדכון אינו זמין כרגע. נסו לרענן או צרו קשר עם הקליניקה."
          : "הבקשה נכשלה")
    );
    error.code = data?.error || `http_${response.status}`;
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  if (!data || data.ok === false) {
    const error = new Error(data?.message || "הבקשה נכשלה");
    error.code = data?.error || "invalid_response";
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

export function requestSelfServiceOtp(phone) {
  return postSelfService({ action: "requestOtp", phone });
}

export function verifySelfServiceOtp(phone, code) {
  return postSelfService({ action: "verifyOtp", phone, code });
}

export function listSelfServiceAppointments(sessionToken) {
  return postSelfService({ action: "listAppointments", sessionToken });
}

export function rescheduleSelfServiceAppointment({
  sessionToken,
  appointmentId,
  date,
  time,
  updated_at,
}) {
  return postSelfService({
    action: "reschedule",
    sessionToken,
    appointmentId,
    date,
    time,
    updated_at,
  });
}

export function cancelSelfServiceAppointment({
  sessionToken,
  appointmentId,
  updated_at,
}) {
  return postSelfService({
    action: "cancel",
    sessionToken,
    appointmentId,
    updated_at,
  });
}
