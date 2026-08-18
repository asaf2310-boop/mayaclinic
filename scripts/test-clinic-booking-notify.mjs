import assert from "node:assert/strict";
import { getBookingNotifyEmails } from "../server/bookingNotify.js";
import { buildClinicBookingNotifyEmail } from "../server/emailTemplates.js";
import { applyMeridianVerifiedNotes } from "../server/meridianEmail.js";

delete process.env.BOOKING_NOTIFY_EMAILS;
delete process.env.ADMIN_EMAILS;
delete process.env.ADMIN_EMAIL;
delete process.env.GMAIL_USER;
delete process.env.GMAIL_APP_PASSWORD;

assert.deepEqual(getBookingNotifyEmails(), ["ofirbabyinfo@gmail.com"]);

process.env.ADMIN_EMAILS = "maya@gmail.com, OfirBabyInfo@gmail.com ";
assert.deepEqual(getBookingNotifyEmails(), [
  "maya@gmail.com",
  "ofirbabyinfo@gmail.com",
]);

process.env.BOOKING_NOTIFY_EMAILS = "owner@clinic.com";
assert.deepEqual(getBookingNotifyEmails(), ["owner@clinic.com"]);

const already = applyMeridianVerifiedNotes(
  "תשלום דרך מרידיאן — ממתין לאימות מזהה טיפול\nמזהה טיפול מרידיאן שאומת: 916779447",
  "916779447"
);
assert.equal(already, "מזהה טיפול מרידיאן שאומת: 916779447");
assert.equal(
  already.includes("ממתין לאימות"),
  false
);

const mail = buildClinicBookingNotifyEmail({
  patientName: "דניאל ברודו",
  patientPhone: "0556644577",
  patientEmail: "danielbrodo97@gmail.com",
  appointments: [
    {
      treatment_name: "מגע שיקומי",
      date: "2026-08-19",
      time: "09:00",
      treatment_price: 250,
    },
  ],
  clinicName: "הקליניקה של מאיה",
  sourceLabel: "מרידיאן",
  extraNote: "מזהה טיפול מרידיאן שאומת: 916779447",
});

assert.match(mail.subject, /דניאל ברודו/);
assert.match(mail.html, /מזהה טיפול מרידיאן שאומת: 916779447/);
assert.equal(mail.html.includes("ממתין לאימות"), false);

console.log("clinic booking notify: ok");
