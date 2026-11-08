/**
 * Regression: after a completed booking, "קביעת תור נוסף" must open a fresh
 * treatment-selection flow without same-route navigate stuck on success UI.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  BOOK_AGAIN_CONTACT_STATE_KEY,
  buildBookAgainNavigationState,
  createFreshBookingSessionState,
  extractReusableBookingContact,
  extractReusableContactFromAppointment,
  readBookAgainContactFromLocationState,
} from "../src/lib/bookAgain.js";

const completedForm = {
  patient_name: "נועה כהן",
  patient_phone: "0501234567",
  patient_email: "noa@example.com",
  notes: "הערה לשימור",
  marketing_consent: true,
  treatment_id: "t1",
  treatment_name: "עיסוי",
  treatment_price: 250,
  appointments: [{ date: "2026-11-10", time: "10:00" }],
  hide_price: false,
  booking_channel: "standard",
  meridianTreatmentId: "M-1",
  meridianVerificationToken: "tok",
};

const contact = extractReusableBookingContact(completedForm);
assert.deepEqual(contact, {
  patient_name: "נועה כהן",
  patient_phone: "0501234567",
  patient_email: "noa@example.com",
  notes: "הערה לשימור",
  marketing_consent: true,
});
assert.equal("appointments" in contact, false);
assert.equal("treatment_id" in contact, false);

const fresh = createFreshBookingSessionState(completedForm);
assert.equal(fresh.selectedTreatment, null);
assert.equal(fresh.pendingFormData, null);
assert.equal(fresh.meridianVerified, null);
assert.equal(fresh.stage, "treatment");
assert.deepEqual(fresh.savedFormData, contact);

// First booking stays "saved" — reset only clears client flow state.
assert.deepEqual(completedForm.appointments, [{ date: "2026-11-10", time: "10:00" }]);

// Second booking gets a distinct slot payload when customer picks again.
const secondForm = {
  ...fresh.savedFormData,
  treatment_id: "t2",
  treatment_name: "התפתחות",
  appointments: [{ date: "2026-11-12", time: "16:00" }],
};
assert.notDeepEqual(secondForm.appointments, completedForm.appointments);
assert.notEqual(secondForm.treatment_id, completedForm.treatment_id);
assert.equal(secondForm.patient_phone, completedForm.patient_phone);

// Payment-success → /book navigation state preserves contact once.
const navState = buildBookAgainNavigationState({
  patient_email: "noa@example.com",
  appointments: [{ patient_name: "נועה כהן", patient_phone: "0501234567" }],
});
assert.ok(navState?.[BOOK_AGAIN_CONTACT_STATE_KEY]);
assert.deepEqual(
  readBookAgainContactFromLocationState(navState),
  extractReusableContactFromAppointment({
    patient_email: "noa@example.com",
    appointments: [{ patient_name: "נועה כהן", patient_phone: "0501234567" }],
  })
);

assert.equal(extractReusableBookingContact(null), null);
assert.equal(createFreshBookingSessionState(null).savedFormData, null);

// Source wiring: success CTA must reset parent state, not same-route Link.
const successSrc = await readFile(
  new URL("../src/components/booking/BookingSuccess.jsx", import.meta.url),
  "utf8"
);
assert.match(successSrc, /קביעת תור נוסף/);
assert.match(successSrc, /onClick=\{\(\) => onReset\?\.\(\)\}/);
assert.doesNotMatch(
  successSrc,
  /to=\{bookingBasePath \? "\/book" : "\/"\}[\s\S]*קביעת תור נוסף/
);

const bookSrc = await readFile(new URL("../src/pages/Book.jsx", import.meta.url), "utf8");
assert.match(bookSrc, /handleBookAgain/);
assert.match(bookSrc, /createFreshBookingSessionState/);
assert.match(bookSrc, /onBookAgain=\{handleBookAgain\}/);
assert.match(bookSrc, /invalidateQueries\(\{ queryKey: \["appointments-for-booking"\] \}\)/);

const paymentSrc = await readFile(
  new URL("../src/components/booking/PaymentStep.jsx", import.meta.url),
  "utf8"
);
assert.match(paymentSrc, /onBookAgain/);
assert.match(paymentSrc, /typeof onBookAgain === "function"/);
// Must not keep the old same-route-only success reset for cash/paybox.
assert.doesNotMatch(
  paymentSrc,
  /cashSuccess[\s\S]{0,200}navigate\("\/book", \{ replace: true \}\)/
);

// Pelecard bookingRef is created per checkout open — fresh after PaymentStep remount.
assert.match(paymentSrc, /createBookingRef\(\)/);
assert.match(bookSrc, /key=\{`payment-\$\{bookingEpoch\}`\}/);
assert.match(bookSrc, /setBookingEpoch/);

console.log("book-again regression: ok");
