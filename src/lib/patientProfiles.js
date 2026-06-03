import { base44 } from "@/api/base44Client";

export const GENDER_OPTIONS = [
  { value: "female", label: "נקבה" },
  { value: "male", label: "זכר" },
  { value: "other", label: "אחר" },
  { value: "prefer_not", label: "מעדיף/ה לא לציין" },
];

export const MARITAL_STATUS_OPTIONS = [
  { value: "single", label: "רווק/ה" },
  { value: "married", label: "נשוי/אה" },
  { value: "divorced", label: "גרוש/ה" },
  { value: "widowed", label: "אלמן/ה" },
  { value: "other", label: "אחר" },
];

export const PATIENT_TYPE_OPTIONS = [
  { value: "individual", label: "מטופל/ת יחיד" },
  { value: "family", label: "טיפול משפחתי" },
];

export const HMO_OPTIONS = [
  { value: "clalit", label: "כללית" },
  { value: "maccabi", label: "מכבי" },
  { value: "meuhedet", label: "מאוחדת" },
  { value: "leumit", label: "לאומית" },
  { value: "private", label: "פרטי / ללא קופה" },
  { value: "other", label: "אחר" },
];

export const PREFERRED_CONTACT_OPTIONS = [
  { value: "phone", label: "טלפון" },
  { value: "whatsapp", label: "וואטסאפ" },
  { value: "email", label: "אימייל" },
  { value: "sms", label: "SMS" },
];

export const SESSION_LOCATION_OPTIONS = [
  { value: "clinic", label: "בקליניקה" },
  { value: "home", label: "בבית המטופל/ת" },
  { value: "online", label: "אונליין" },
];

export const FUNDING_SOURCE_OPTIONS = [
  { value: "private", label: "פרטי" },
  { value: "insurance", label: "ביטוח / קופה" },
  { value: "employer", label: "מימון מעסיק" },
  { value: "subsidy", label: "סבסוד / מל" },
  { value: "other", label: "אחר" },
];

export const emptyPatientProfileFields = () => ({
  gender: "",
  maritalStatus: "",
  birthDate: "",
  occupation: "",
  patientType: "individual",
  city: "",
  address: "",
  zip: "",
  hmo: "",
  insurance: "",
  preferredContact: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  intakeNotes: "",
  treatmentGoals: "",
  continuousNotes: "",
  sessionLocation: "clinic",
  preferredTimes: "",
  medicalBackground: "",
  fundingSource: "",
  sessionPrice: "",
});

export function normalizeProfileFields(raw = {}) {
  const defaults = emptyPatientProfileFields();
  return { ...defaults, ...raw };
}

export function optionLabel(options, value) {
  if (!value) return "";
  return options.find((option) => option.value === value)?.label || value;
}

export function buildProfileMap(profiles = []) {
  return Object.fromEntries(
    profiles.map((row) => [row.customer_key, normalizeProfileFields(row.profile)])
  );
}

export async function listPatientProfiles() {
  if (!base44.entities.PatientProfile) return [];
  return base44.entities.PatientProfile.list("-updated_at");
}

export async function fetchPatientProfile(customerKey) {
  if (!base44.entities.PatientProfile) return null;
  const rows = await base44.entities.PatientProfile.filter({ customer_key: customerKey });
  return rows[0] || null;
}

export async function savePatientProfile(customerKey, customer, profileFields) {
  if (!base44.entities.PatientProfile) {
    throw new Error("PatientProfile entity is not available in this backend mode.");
  }

  const existing = await fetchPatientProfile(customerKey);
  const payload = {
    customer_key: customerKey,
    patient_name: customer.name || "",
    patient_phone: customer.phone || "",
    patient_email: customer.email || "",
    profile: normalizeProfileFields(profileFields),
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    return base44.entities.PatientProfile.update(existing.id, payload);
  }

  return base44.entities.PatientProfile.create(payload);
}

export function profileSummaryChips(profile = {}) {
  const chips = [];
  const gender = optionLabel(GENDER_OPTIONS, profile.gender);
  if (gender) chips.push(gender);
  if (profile.occupation) chips.push(profile.occupation);
  const hmo = optionLabel(HMO_OPTIONS, profile.hmo);
  if (hmo) chips.push(hmo);
  const patientType = optionLabel(PATIENT_TYPE_OPTIONS, profile.patientType);
  if (patientType && profile.patientType !== "individual") chips.push(patientType);
  return chips;
}
