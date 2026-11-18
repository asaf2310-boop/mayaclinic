/** Shared helpers for appointment list + edit dialog. */

export const STATUS_MAP = {
  pending: { label: "ממתין" },
  confirmed: { label: "מאושר" },
  cancelled: { label: "בוטל" },
  completed: { label: "הושלם" },
};

export const EMPTY_EDIT_FORM = {
  patient_name: "",
  patient_phone: "",
  patient_email: "",
  treatment_name: "",
  treatment_price: "",
  date: "",
  time: "",
  notes: "",
  status: "pending",
  paid: false,
  marketing_consent: false,
};

/** HTML time inputs need HH:MM; DB text may be HH:MM:SS. */
export function normalizeTimeInput(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = /^(\d{1,2}):(\d{2})/.exec(raw);
  if (!match) return raw.slice(0, 5);
  return `${String(Number(match[1])).padStart(2, "0")}:${match[2]}`;
}

export function extractVerifiedMeridianId(notes) {
  const match = String(notes || "").match(/מזהה טיפול מרידיאן שאומת:\s*(\d+)/);
  return match?.[1] || "";
}

/** Prefer verified state when notes still contain a leftover "pending" line. */
export function getMeridianBadge(appointment) {
  const notes = String(appointment?.notes || "");
  const verifiedId = extractVerifiedMeridianId(notes);
  if (verifiedId) {
    return {
      kind: "verified",
      label: `מרידיאן — אומת (${verifiedId})`,
      className: "text-green-700",
    };
  }
  if (/מרידיאן/.test(notes) && /ממתין לאימות/.test(notes)) {
    return {
      kind: "pending",
      label: "מרידיאן — ממתין לאימות מזהה",
      className: "text-amber-700",
    };
  }
  if (/מרידיאן/.test(notes)) {
    return {
      kind: "info",
      label: "מרידיאן",
      className: "text-muted-foreground",
    };
  }
  return null;
}

/** Hide contradictory pending Meridian lines once a verified ID exists. */
export function formatNotesForDisplay(notes) {
  const text = String(notes || "");
  const verifiedId = extractVerifiedMeridianId(text);
  if (!verifiedId) return text || "-";
  return (
    text
      .split(/\r?\n+/)
      .map((line) =>
        String(line || "")
          .replace(/תשלום דרך מרידיאן\s*[—–\-:]?\s*ממתין לאימות מזהה טיפול/g, "")
          .replace(/מרידיאן\s*[—–\-:]?\s*ממתין לאימות[^\n]*/g, "")
          .replace(/ממתין לאימות מזהה טיפול/g, "")
          .trim()
      )
      .filter(Boolean)
      .join("\n") || `מזהה טיפול מרידיאן שאומת: ${verifiedId}`
  );
}

export function getEmailDeliveryWarning(appointment) {
  const statuses = [
    appointment?.confirmation_email_status,
    appointment?.reminder_email_status,
  ]
    .map((value) => String(value || ""))
    .filter(Boolean);

  if (statuses.includes("permanent_failure") || statuses.includes("suppressed")) {
    return "שליחת אימייל נכשלה באופן קבוע — בדקי/תקני את כתובת המייל. לא יישלחו ניסיונות נוספים עד לתיקון.";
  }
  if (statuses.includes("temporary_failure")) {
    return "שליחת אימייל נכשלה זמנית — ייתכן ניסיון חוזר מוגבל.";
  }
  return "";
}

export function getSmsDeliveryWarning(appointment) {
  const status = String(appointment?.reminder_sms_status || "");
  if (status === "permanent_failure") {
    return "שליחת SMS נכשלה — לא יבוצע ניסיון חוזר אוטומטי.";
  }
  if (status === "invalid_phone") {
    return "מספר נייד לא תקין לתזכורת SMS — תקני את הטלפון.";
  }
  if (status === "temporary_failure") {
    return "שליחת SMS הופסקה / לא ודאית — ללא ניסיון חוזר אוטומטי.";
  }
  return "";
}

export function emailDeliveryStatusLabel(status) {
  switch (String(status || "")) {
    case "accepted":
      return "התקבל לשליחה";
    case "delivered":
      return "נמסר";
    case "sending":
      return "בשליחה";
    case "temporary_failure":
      return "כשל זמני";
    case "permanent_failure":
      return "כשל קבוע";
    case "suppressed":
      return "חסום לשליחה";
    case "cancelled":
      return "בוטל";
    case "pending":
      return "ממתין";
    case "invalid_phone":
      return "מספר לא תקין";
    default:
      return "";
  }
}

/** Label for Invoice4U summary attached by /api/admin appointment list. */
export function invoice4uDisplayLabel(invoice) {
  if (!invoice) return "";
  if (invoice.ok) {
    if (invoice.documentNumber != null && invoice.documentNumber !== "") {
      return `מס׳ ${invoice.documentNumber}`;
    }
    if (invoice.id) return `מסמך ${invoice.id}`;
    return "הופקה";
  }
  if (invoice.status === "issuing") return "בהפקה…";
  if (invoice.reason === "not_configured") return "לא הוגדר Invoice4U";
  if (invoice.reason === "zero_amount") return "סכום אפס — לא הופקה";
  if (invoice.skipped && invoice.reason) return `דולג: ${invoice.reason}`;
  if (invoice.error) return `שגיאה: ${String(invoice.error).slice(0, 120)}`;
  if (invoice.reason) return String(invoice.reason);
  return "לא הופקה";
}
