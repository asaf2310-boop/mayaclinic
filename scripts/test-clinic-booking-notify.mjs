import assert from "node:assert/strict";
import { getBookingNotifyEmails } from "../server/bookingNotify.js";
import { buildClinicBookingNotifyEmail } from "../server/emailTemplates.js";

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

const mail = buildClinicBookingNotifyEmail({
  patientName: "דניאל דוידוב",
  patientPhone: "0501234567",
  patientEmail: "daniel@example.com",
  appointments: [
    {
      treatment_name: "מגע שיקומי",
      date: "2026-08-20",
      time: "10:00",
      treatment_price: 250,
    },
  ],
  clinicName: "אופיר",
  sourceLabel: "מרידיאן",
  extraNote: "ממתין לאימות מזהה טיפול ממרידיאן",
});

assert.match(mail.subject, /דניאל דוידוב/);
assert.match(mail.subject, /20\/08\/2026/);
assert.match(mail.html, /מרידיאן/);
assert.match(mail.html, /0501234567/);
assert.match(mail.html, /מגע שיקומי/);

console.log("clinic booking notify: ok");
