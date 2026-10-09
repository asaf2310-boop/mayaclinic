/**
 * Shared booking email validation (client + server).
 * Normalizes lightly for checks; never auto-rewrites the user's address.
 */

export const EMAIL_DOMAIN_SUGGESTIONS = {
  "gmail.con": "gmail.com",
  "gmail.cim": "gmail.com",
  "gmal.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmail.co.il": "gmail.com",
  "walla.con": "walla.co.il",
  "outlook.con": "outlook.com",
  "hotmail.con": "hotmail.com",
};

const LOCAL_MAX = 64;
const DOMAIN_MAX = 255;
const TOTAL_MAX = 254;

/** Split into local + domain; domain is lowercased, local kept as typed (trimmed). */
export function normalizeBookingEmail(raw) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    return { normalized: "", local: "", domain: "" };
  }
  const at = trimmed.lastIndexOf("@");
  if (at <= 0 || at === trimmed.length - 1) {
    return { normalized: trimmed, local: trimmed, domain: "" };
  }
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1).toLowerCase();
  return {
    normalized: `${local}@${domain}`,
    local,
    domain,
  };
}

function isValidDomainLabel(label) {
  if (!label || label.length > 63) return false;
  if (label.startsWith("-") || label.endsWith("-")) return false;
  return /^[a-z0-9-]+$/i.test(label);
}

function isValidDomain(domain) {
  if (!domain || domain.length > DOMAIN_MAX) return false;
  if (domain.includes("..") || domain.startsWith(".") || domain.endsWith(".")) {
    return false;
  }
  const labels = domain.split(".");
  if (labels.length < 2) return false;
  const tld = labels[labels.length - 1];
  if (!/^[a-z]{2,}$/i.test(tld)) return false;
  return labels.every(isValidDomainLabel);
}

function isValidLocalPart(local) {
  if (!local || local.length > LOCAL_MAX) return false;
  if (local.includes(" ") || local.includes("@@")) return false;
  // Practical subset: printable ASCII without spaces / quotes / commas.
  if (!/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+$/.test(local)) return false;
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) {
    return false;
  }
  return true;
}

/**
 * @param {string} raw
 * @param {{ required?: boolean }} [options]
 * @returns {{
 *   ok: boolean,
 *   normalized: string,
 *   error?: string,
 *   suggestion?: { fromDomain: string, toDomain: string, suggestedEmail: string } | null
 * }}
 */
export function validateBookingEmail(raw, { required = false } = {}) {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) {
    if (required) {
      return { ok: false, normalized: "", error: "email_required", suggestion: null };
    }
    return { ok: true, normalized: "", suggestion: null };
  }

  if (/\s/.test(trimmed)) {
    return { ok: false, normalized: trimmed, error: "email_whitespace", suggestion: null };
  }
  if ((trimmed.match(/@/g) || []).length !== 1) {
    return { ok: false, normalized: trimmed, error: "email_malformed", suggestion: null };
  }
  if (trimmed.length > TOTAL_MAX) {
    return { ok: false, normalized: trimmed, error: "email_too_long", suggestion: null };
  }

  const { normalized, local, domain } = normalizeBookingEmail(trimmed);

  if (!isValidLocalPart(local) || !isValidDomain(domain)) {
    return {
      ok: false,
      normalized,
      error: "email_invalid",
      suggestion: buildDomainSuggestion(local, domain),
    };
  }

  // Typo dictionary is advisory only — never auto-reject uncommon/valid domains.
  return {
    ok: true,
    normalized,
    suggestion: buildDomainSuggestion(local, domain),
  };
}

function buildDomainSuggestion(local, domain) {
  if (!domain || !local) return null;
  const suggestedDomain = EMAIL_DOMAIN_SUGGESTIONS[domain];
  if (!suggestedDomain || suggestedDomain === domain) return null;
  return {
    fromDomain: domain,
    toDomain: suggestedDomain,
    suggestedEmail: `${local}@${suggestedDomain}`,
  };
}

export function bookingEmailErrorMessage(code) {
  switch (code) {
    case "email_required":
      return "נא להזין כתובת אימייל";
    case "email_whitespace":
      return "כתובת האימייל לא יכולה להכיל רווחים";
    case "email_malformed":
      return "כתובת האימייל אינה תקינה";
    case "email_too_long":
      return "כתובת האימייל ארוכה מדי";
    case "email_domain_typo":
      return "ייתכן שיש טעות בכתובת המייל";
    case "email_invalid":
      return "כתובת האימייל אינה תקינה";
    case "email_suppressed":
      return "לא ניתן לשלוח לכתובת זו — נרשמה כשגיאת מסירה קבועה";
    default:
      return "כתובת האימייל אינה תקינה";
  }
}
