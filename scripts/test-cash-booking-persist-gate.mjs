import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assertPersistedAppointmentResult } from "../server/pelecardPayments.js";

const root = dirname(fileURLToPath(import.meta.url));

assert.throws(
  () =>
    assertPersistedAppointmentResult({
      expectedCount: 1,
      createdIds: [],
      createdRows: [],
    }),
  (error) => error?.code === "appointments_not_persisted"
);

assert.throws(
  () =>
    assertPersistedAppointmentResult({
      expectedCount: 2,
      createdIds: ["a1"],
      createdRows: [{ id: "a1" }],
    }),
  (error) => error?.code === "appointments_not_persisted"
);

const ok = assertPersistedAppointmentResult({
  expectedCount: 1,
  createdIds: ["a1"],
  createdRows: [{ id: "a1", patient_name: "Test" }],
});
assert.deepEqual(ok.createdIds, ["a1"]);
assert.equal(ok.createdRows[0].id, "a1");

const paymentStepSrc = readFileSync(
  join(root, "../src/components/booking/PaymentStep.jsx"),
  "utf8"
);
assert.match(
  paymentStepSrc,
  /patient_email:\s*emailCheck\.normalized/,
  "cash success must use emailCheck.normalized (not undeclared email)"
);
assert.match(
  paymentStepSrc,
  /persistedAppointments/,
  "cash success UI must require persisted appointment rows"
);
assert.doesNotMatch(
  paymentStepSrc,
  /patient_email:\s*email,/,
  "must not reference undeclared email in cash success payload"
);

const cashClientSrc = readFileSync(join(root, "../src/lib/cashBooking.js"), "utf8");
assert.match(
  cashClientSrc,
  /countPersistedAppointments/,
  "client createCashBooking must reject empty persistence"
);

const serverSrc = readFileSync(join(root, "../server/pelecardPayments.js"), "utf8");
assert.match(
  serverSrc,
  /requireCalendarSync:\s*true/,
  "cash booking must require clinic calendar sync before confirmations"
);
assert.match(
  serverSrc,
  /assertPersistedAppointmentResult/,
  "cash booking must gate notifications on persisted ids"
);
assert.match(
  serverSrc,
  /await maybeSendConfirmationEmail\(persisted\.createdRows\);[\s\S]*await maybeSendBookingConfirmSms\(persisted\.createdRows\);/,
  "cash confirm email/SMS must run only after persistence assert"
);

console.log("cash booking persist gate ok");
