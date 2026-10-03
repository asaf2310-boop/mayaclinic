import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra || {}) as {
  appointmentsAdminUrl?: string;
  websiteAdminUrl?: string;
};

export const APPOINTMENTS_ADMIN_URL =
  extra.appointmentsAdminUrl || "https://www.ofirbaby.com/booking/admin";

export const WEBSITE_ADMIN_URL =
  extra.websiteAdminUrl || "https://www.ofirbaby.com/admin";

/** Hosts that stay inside the in-app WebView. */
export const TRUSTED_WEBVIEW_HOSTS = new Set([
  "www.ofirbaby.com",
  "ofirbaby.com",
  "ofirbaby.vercel.app",
  "www.ofirbaby.vercel.app",
  "accounts.google.com",
  "oauth2.googleapis.com",
]);

export function isTrustedWebViewUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    if (TRUSTED_WEBVIEW_HOSTS.has(host)) return true;
    // Google OAuth / account picker subdomains
    if (host.endsWith(".google.com")) return true;
    if (host.endsWith(".googleapis.com")) return true;
    return false;
  } catch {
    return false;
  }
}
