/**
 * SMS patient-message templates (booking confirm + day-before reminder).
 * Server-side render only. Hebrew/Unicode → UCS-2 segment estimate (not GSM-7).
 */

export const SMS_TEMPLATE_VARS = Object.freeze([
  "{שם}",
  "{תאריך}",
  "{שעה}",
  "{כתובת}",
  "{קישור_ניווט}",
]);

export const DEFAULT_CLINIC_ADDRESS =
  "ישראל עידוד 8, פתח תקווה, קומה 7, דירה 26";

export const DEFAULT_CONFIRM_SMS_TEMPLATE =
  "שלום {שם}, התור שלך ב־OfirBaby נקבע בהצלחה ל־{תאריך} בשעה {שעה}.\n\n" +
  "📍 כתובת: {כתובת}\n\n" +
  "לשינוי או ביטול: 0549000301.\n\n" +
  "נתראה בקרוב!";

export const DEFAULT_REMINDER_SMS_TEMPLATE =
  "שלום {שם}, תזכורת לתור שלך ב־OfirBaby בתאריך {תאריך} בשעה {שעה}.\n\n" +
  "📍 כתובת: {כתובת}\n\n" +
  "לשינוי או ביטול התור: 0549000301.\n\n" +
  "נתראה בקרוב!";

const PLACEHOLDER_RE = /\{[^{}]+\}/g;

export function buildClinicMapsUrl(address = DEFAULT_CLINIC_ADDRESS) {
  const q = String(address || DEFAULT_CLINIC_ADDRESS).trim() || DEFAULT_CLINIC_ADDRESS;
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

/**
 * 019 bills Hebrew/emoji as Unicode (UCS-2): 70 chars single, 67 per concatenated part.
 * Count Unicode code points (spreads surrogate pairs / emoji correctly).
 */
export function estimateSmsSegments(text = "") {
  const chars = [...String(text || "")].length;
  if (chars <= 0) {
    return { chars: 0, segments: 0, encoding: "ucs2", singleLimit: 70, multiLimit: 67 };
  }
  if (chars <= 70) {
    return { chars, segments: 1, encoding: "ucs2", singleLimit: 70, multiLimit: 67 };
  }
  return {
    chars,
    segments: Math.ceil(chars / 67),
    encoding: "ucs2",
    singleLimit: 70,
    multiLimit: 67,
  };
}

export function findUnsupportedPlaceholders(template = "") {
  const found = String(template || "").match(PLACEHOLDER_RE) || [];
  const allowed = new Set(SMS_TEMPLATE_VARS);
  return [...new Set(found.filter((token) => !allowed.has(token)))];
}

export function validateSmsTemplate(template = "") {
  const text = String(template || "");
  if (!text.trim()) {
    return { ok: false, error: "empty_template" };
  }
  const unsupported = findUnsupportedPlaceholders(text);
  if (unsupported.length) {
    return { ok: false, error: "unsupported_placeholders", unsupported };
  }
  return { ok: true };
}

/**
 * Replace only known variables. Leaves unknown tokens for validateSmsTemplate to reject.
 */
export function renderSmsTemplate(
  template,
  {
    patientName = "",
    date = "",
    time = "",
    clinicAddress = DEFAULT_CLINIC_ADDRESS,
    mapsUrl = "",
  } = {},
  { formatDate, formatTime } = {}
) {
  const validation = validateSmsTemplate(template);
  if (!validation.ok) {
    return { ok: false, ...validation };
  }

  const name = String(patientName || "").trim() || "לקוח/ה";
  const address =
    String(clinicAddress || "").trim() || DEFAULT_CLINIC_ADDRESS;
  const dateLabel =
    typeof formatDate === "function"
      ? formatDate(date)
      : String(date || "").trim();
  const timeLabel =
    typeof formatTime === "function"
      ? formatTime(time)
      : String(time || "").trim();
  const nav =
    String(mapsUrl || "").trim() || buildClinicMapsUrl(address);

  const message = String(template)
    .replaceAll("{שם}", name)
    .replaceAll("{תאריך}", dateLabel)
    .replaceAll("{שעה}", timeLabel)
    .replaceAll("{כתובת}", address)
    .replaceAll("{קישור_ניווט}", nav);

  return {
    ok: true,
    message,
    estimate: estimateSmsSegments(message),
  };
}

export function maskIsraeliPhone(phone = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  let local = digits;
  if (local.startsWith("972") && local.length >= 12) local = `0${local.slice(3)}`;
  if (local.length === 9 && local.startsWith("5")) local = `0${local}`;
  if (local.length < 7) return "****";
  return `${local.slice(0, 3)}***${local.slice(-4)}`;
}
