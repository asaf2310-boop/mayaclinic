import { google } from "googleapis";

export function getCalendarClient() {
  const rawKey = String(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON || "").trim();
  const calendarId = String(process.env.GOOGLE_CALENDAR_ID || "").trim();
  const timezone = String(process.env.GOOGLE_CALENDAR_TIMEZONE || "Asia/Jerusalem").trim();

  if (!rawKey || !calendarId) {
    const error = new Error("calendar_not_configured");
    error.statusCode = 503;
    throw error;
  }

  let credentials;
  try {
    credentials = JSON.parse(rawKey);
  } catch {
    const error = new Error("invalid_service_account_json");
    error.statusCode = 500;
    throw error;
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  return {
    calendar: google.calendar({ version: "v3", auth }),
    calendarId,
    timezone,
  };
}

export function isGoogleCalendarConfigured() {
  return Boolean(
    String(process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON || "").trim() &&
      String(process.env.GOOGLE_CALENDAR_ID || "").trim()
  );
}
