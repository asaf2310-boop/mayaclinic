import assert from "node:assert/strict";
import { buildConfirmationEmail } from "../server/emailTemplates.js";
import { resolveCustomerManageAppointmentUrl } from "../server/bookingMount.js";
import {
  buildChangeIdempotencyKey,
  shouldReuseChangeEvent,
} from "../server/appointmentChangeNotify.js";

const appointments = [
  {
    treatment_name: "מגע שיקומי",
    date: "2026-11-20",
    time: "10:00",
    treatment_price: 320,
  },
];

{
  const previousOrigin = process.env.OFIRBABY_BOOKING_ORIGIN;
  const previousPublic = process.env.PUBLIC_ORIGIN;
  const previousPelecard = process.env.PELECARD_PUBLIC_ORIGIN;
  try {
    process.env.OFIRBABY_BOOKING_ORIGIN = "https://www.ofirbaby.com";
    delete process.env.PUBLIC_ORIGIN;
    delete process.env.PELECARD_PUBLIC_ORIGIN;
    assert.equal(
      resolveCustomerManageAppointmentUrl(),
      "https://www.ofirbaby.com/booking/manage"
    );

    delete process.env.OFIRBABY_BOOKING_ORIGIN;
    process.env.PUBLIC_ORIGIN = "https://ofirbaby.vercel.app";
    assert.equal(
      resolveCustomerManageAppointmentUrl(),
      "https://ofirbaby.vercel.app/manage"
    );

    process.env.PUBLIC_ORIGIN = "https://www.ofirbaby.com";
    assert.equal(
      resolveCustomerManageAppointmentUrl(),
      "https://www.ofirbaby.com/booking/manage"
    );
  } finally {
    if (previousOrigin === undefined) delete process.env.OFIRBABY_BOOKING_ORIGIN;
    else process.env.OFIRBABY_BOOKING_ORIGIN = previousOrigin;
    if (previousPublic === undefined) delete process.env.PUBLIC_ORIGIN;
    else process.env.PUBLIC_ORIGIN = previousPublic;
    if (previousPelecard === undefined) delete process.env.PELECARD_PUBLIC_ORIGIN;
    else process.env.PELECARD_PUBLIC_ORIGIN = previousPelecard;
  }
}

{
  const mail = buildConfirmationEmail({
    patientName: "נועה",
    appointments,
    clinicName: "אופיר",
    manageUrl: "https://www.ofirbaby.com/booking/manage",
  });
  assert.match(mail.html, /לעדכון או ביטול התור/);
  assert.match(mail.html, /https:\/\/www\.ofirbaby\.com\/booking\/manage/);
  assert.doesNotMatch(mail.html, /[?&](phone|email|id)=/i);
  assert.match(mail.text, /לעדכון או ביטול התור/);
  assert.match(mail.text, /https:\/\/www\.ofirbaby\.com\/booking\/manage/);
  assert.match(mail.text, /נועה/);
  assert.match(mail.text, /20\/11\/2026/);
}

{
  const without = buildConfirmationEmail({
    patientName: "נועה",
    appointments,
    clinicName: "אופיר",
    manageUrl: "",
  });
  assert.doesNotMatch(without.html, /לעדכון או ביטול התור/);
  assert.match(without.html, /צרו קשר עם הקליניקה/);
}

{
  const keyA = buildChangeIdempotencyKey({
    appointmentId: "abc",
    eventType: "reschedule",
    actor: "admin",
    before: { date: "2026-03-01", time: "10:00", status: "confirmed" },
    after: {
      date: "2026-03-08",
      time: "12:00",
      status: "confirmed",
      updated_at: "2026-03-01T12:00:00.000Z",
    },
  });
  const keyB = buildChangeIdempotencyKey({
    appointmentId: "abc",
    eventType: "reschedule",
    actor: "admin",
    before: { date: "2026-03-01", time: "10:00", status: "confirmed" },
    after: {
      date: "2026-03-08",
      time: "12:00",
      status: "confirmed",
      updated_at: "2026-03-02T12:00:00.000Z",
    },
  });
  assert.notEqual(keyA, keyB, "updated_at distinguishes separate A→B writes");

  const openEvent = {
    created_at: "2020-01-01T00:00:00.000Z",
    calendar_sync_status: "temporary_failure",
    customer_email_status: "sent",
    clinic_email_status: "sent",
    customer_sms_status: "sent",
  };
  assert.equal(shouldReuseChangeEvent(openEvent), true);

  const terminalOld = {
    created_at: "2020-01-01T00:00:00.000Z",
    calendar_sync_status: "synced",
    customer_email_status: "sent",
    clinic_email_status: "sent",
    customer_sms_status: "sent",
  };
  assert.equal(
    shouldReuseChangeEvent(terminalOld),
    false,
    "do not reuse completed change for later identical transition"
  );

  const terminalFresh = {
    created_at: new Date().toISOString(),
    calendar_sync_status: "synced",
    customer_email_status: "sent",
    clinic_email_status: "sent",
    customer_sms_status: "sent",
  };
  assert.equal(
    shouldReuseChangeEvent(terminalFresh),
    true,
    "brief window still suppresses double-submit re-notify"
  );

  // Admin A→B→C→B narrative (slot A=10:00, B=12:00, C=14:00):
  // after each completed sync, the next identical or new transition must mint work.
  const completed = (iso) => ({
    created_at: iso,
    calendar_sync_status: "synced",
    customer_email_status: "sent",
    clinic_email_status: "sent",
    customer_sms_status: "sent",
  });
  assert.equal(
    shouldReuseChangeEvent(completed("2020-01-01T00:00:00.000Z")),
    false,
    "A→B completed: later A→B reapply must not reuse"
  );
  assert.equal(
    shouldReuseChangeEvent(completed("2020-01-01T00:00:00.000Z")),
    false,
    "B→C completed: prior job must not block C sync"
  );
  const sameWriteRetry = completed(new Date().toISOString());
  assert.equal(
    shouldReuseChangeEvent(sameWriteRetry),
    true,
    "retry same edit request within 2m reuses (no duplicate GCal work)"
  );
  const keyAB1 = buildChangeIdempotencyKey({
    appointmentId: "appt-1",
    eventType: "reschedule",
    actor: "admin",
    before: { date: "2026-03-01", time: "10:00", status: "confirmed" },
    after: {
      date: "2026-03-01",
      time: "12:00",
      status: "confirmed",
      updated_at: "2026-03-01T10:00:00.000Z",
    },
  });
  const keyBC = buildChangeIdempotencyKey({
    appointmentId: "appt-1",
    eventType: "reschedule",
    actor: "admin",
    before: { date: "2026-03-01", time: "12:00", status: "confirmed" },
    after: {
      date: "2026-03-01",
      time: "14:00",
      status: "confirmed",
      updated_at: "2026-03-01T11:00:00.000Z",
    },
  });
  const keyAB2 = buildChangeIdempotencyKey({
    appointmentId: "appt-1",
    eventType: "reschedule",
    actor: "admin",
    before: { date: "2026-03-01", time: "10:00", status: "confirmed" },
    after: {
      date: "2026-03-01",
      time: "12:00",
      status: "confirmed",
      updated_at: "2026-03-01T12:00:00.000Z",
    },
  });
  assert.notEqual(keyAB1, keyBC, "A→B and B→C are distinct jobs");
  assert.notEqual(keyAB1, keyAB2, "reapply A→B after C→A uses fresh updated_at");
}

console.log("confirmation manage CTA + change-event reuse: ok");
