/**
 * Normalize Gmail SMTP/IMAP credentials from env.
 * Google App Passwords are often copied with spaces ("xxxx xxxx xxxx xxxx").
 */
export function getGmailCredentials() {
  const user = String(process.env.GMAIL_USER || "").trim();
  // Keep only the 16-char secret; spaces/newlines from Vercel paste break IMAP LOGIN.
  const pass = String(process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
  return { user, pass };
}

export function isGmailCredentialsConfigured() {
  const { user, pass } = getGmailCredentials();
  return Boolean(user && pass);
}
