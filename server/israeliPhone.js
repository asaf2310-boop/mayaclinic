/**
 * Normalize / validate Israeli mobile numbers for 019 SMS API.
 * Accepted input forms: 05xxxxxxx, 5xxxxxxx, +9725xxxxxxx, 9725xxxxxxx.
 * Output for API: 05xxxxxxxx (10 digits) when valid.
 */

export function digitsOnly(value = "") {
  return String(value || "").replace(/\D/g, "");
}

/**
 * @returns {{ ok: true, normalized: string, apiPhone: string } | { ok: false, error: string }}
 */
export function normalizeIsraeliMobile(raw) {
  let digits = digitsOnly(raw);
  if (!digits) {
    return { ok: false, error: "missing_phone" };
  }

  // Strip international Israel prefix.
  if (digits.startsWith("972")) {
    digits = digits.slice(3);
  }

  // Allow leading 0 or bare 5...
  if (digits.length === 9 && digits.startsWith("5")) {
    digits = `0${digits}`;
  }

  // Israeli mobile: 05X-XXX-XXXX (10 digits), second digit after 0 is 0-9 but typically 0-8.
  if (!/^05\d{8}$/.test(digits)) {
    return { ok: false, error: "invalid_israeli_mobile" };
  }

  // 019 accepts 5xxxxxxx or 05xxxxxxx — prefer 05 form for clarity.
  return {
    ok: true,
    normalized: digits,
    apiPhone: digits,
  };
}

export function isValidIsraeliMobile(raw) {
  return normalizeIsraeliMobile(raw).ok;
}
