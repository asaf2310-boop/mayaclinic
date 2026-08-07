import { getGmailCredentials } from "./gmailCredentials.js";

const DEFAULT_NOTIFY_EMAILS = ["ofirbabyinfo@gmail.com"];

/**
 * Clinic owner inbox(es) for new-booking alerts.
 * Prefer BOOKING_NOTIFY_EMAILS, else ADMIN_EMAILS, else GMAIL_USER, else defaults.
 */
export function getBookingNotifyEmails() {
  const fromBooking = String(process.env.BOOKING_NOTIFY_EMAILS || "").trim();
  const fromAdmin = String(process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "").trim();
  const { user } = getGmailCredentials();

  const raw = fromBooking || fromAdmin || user || DEFAULT_NOTIFY_EMAILS.join(",");
  const emails = raw
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter((email) => email.includes("@"));

  return [...new Set(emails)];
}
