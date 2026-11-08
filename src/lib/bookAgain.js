/**
 * Helpers for "קביעת תור נוסף" after a successful booking.
 *
 * Root cause of the broken CTA: success UI is rendered inside PaymentStep while
 * Book is still on /book with pendingFormData set. Navigating to /book again is
 * a same-route no-op, so React state (payment success + pending form) never
 * cleared and the customer stayed stuck on the success screen.
 */

const CONTACT_KEYS = [
  "patient_name",
  "patient_phone",
  "patient_email",
  "notes",
  "marketing_consent",
];

/**
 * Keep reusable customer contact fields; drop treatment/slot/payment payload.
 * @param {Record<string, unknown> | null | undefined} formData
 * @returns {Record<string, unknown> | null}
 */
export function extractReusableBookingContact(formData) {
  if (!formData || typeof formData !== "object") return null;

  const contact = {
    patient_name: String(formData.patient_name || "").trim(),
    patient_phone: String(formData.patient_phone || "").trim(),
    patient_email: String(formData.patient_email || "").trim(),
    notes: String(formData.notes || "").trim(),
    marketing_consent: Boolean(formData.marketing_consent),
  };

  if (!contact.patient_name && !contact.patient_phone && !contact.patient_email) {
    return null;
  }

  return contact;
}

/**
 * Build contact reuse payload from a completed appointment / payment session.
 * @param {Record<string, unknown> | null | undefined} appointment
 */
export function extractReusableContactFromAppointment(appointment) {
  if (!appointment || typeof appointment !== "object") return null;
  const first = Array.isArray(appointment.appointments)
    ? appointment.appointments[0]
    : null;
  return extractReusableBookingContact({
    patient_name: appointment.patient_name || first?.patient_name,
    patient_phone: appointment.patient_phone || first?.patient_phone,
    patient_email: appointment.patient_email || first?.patient_email,
    notes: appointment.notes || first?.notes,
    marketing_consent: appointment.marketing_consent ?? first?.marketing_consent,
  });
}

/**
 * Fresh Book page session after success — treatment-selection step, no slot /
 * payment / success / submission state. Contact may be preserved.
 * @param {Record<string, unknown> | null | undefined} previousFormData
 */
export function createFreshBookingSessionState(previousFormData) {
  return {
    selectedTreatment: null,
    pendingFormData: null,
    meridianVerified: null,
    savedFormData: extractReusableBookingContact(previousFormData),
    stage: "treatment",
  };
}

/** Location state key used when leaving /payment/success for another booking. */
export const BOOK_AGAIN_CONTACT_STATE_KEY = "bookAgainContact";

export function buildBookAgainNavigationState(appointment) {
  const contact = extractReusableContactFromAppointment(appointment);
  if (!contact) return undefined;
  return { [BOOK_AGAIN_CONTACT_STATE_KEY]: contact };
}

export function readBookAgainContactFromLocationState(locationState) {
  const raw = locationState?.[BOOK_AGAIN_CONTACT_STATE_KEY];
  if (!raw || typeof raw !== "object") return null;
  return extractReusableBookingContact(raw);
}

/** @private exposed for tests */
export const _contactKeysForTests = CONTACT_KEYS;
