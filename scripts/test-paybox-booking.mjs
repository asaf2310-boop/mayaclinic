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

const paymentStepSrc = readFileSync(
  join(root, "../src/components/booking/PaymentStep.jsx"),
  "utf8"
);
assert.match(
  paymentStepSrc,
  /createPayboxBooking/,
  "PaymentStep must create PayBox booking before opening the link"
);
assert.match(
  paymentStepSrc,
  /openPayboxLink\(payboxLink\)/,
  "PayBox link must open only after createPayboxBooking succeeds"
);
assert.match(
  paymentStepSrc,
  /payboxSuccess/,
  "PayBox success UI must require persisted appointments"
);
assert.doesNotMatch(
  paymentStepSrc,
  /const handleStartPayboxPayment = \(\) => \{\s*const result = openPayboxLink/,
  "must not open PayBox without creating an appointment"
);

const clientSrc = readFileSync(join(root, "../src/lib/payboxBooking.js"), "utf8");
assert.match(
  clientSrc,
  /action:\s*"createPayboxBooking"/,
  "client must POST createPayboxBooking"
);
assert.match(
  clientSrc,
  /countPersistedAppointments/,
  "client createPayboxBooking must reject empty persistence"
);

const serverSrc = readFileSync(join(root, "../server/pelecardPayments.js"), "utf8");
assert.match(
  serverSrc,
  /export async function createPayboxBooking/,
  "server must export createPayboxBooking"
);
assert.match(
  serverSrc,
  /paymentNote:\s*"תשלום ב-PayBox/,
  "PayBox booking must record external PayBox payment note"
);
assert.match(
  serverSrc,
  /paid:\s*false/,
  "PayBox must not mark paid without server verification"
);
assert.match(
  serverSrc,
  /sourceLabel:\s*"PayBox"/,
  "clinic notify must label PayBox source"
);
assert.match(
  serverSrc,
  /requireCalendarSync:\s*true/,
  "PayBox booking must require clinic calendar sync before confirmations"
);
assert.match(
  serverSrc,
  /await maybeSendConfirmationEmail\(persisted\.createdRows\);[\s\S]*await maybeSendClinicBookingNotify\(persisted\.createdRows,\s*\{\s*sourceLabel:\s*"PayBox"/,
  "PayBox must send patient + clinic emails after persistence"
);

const apiSrc = readFileSync(join(root, "../api/public-data.js"), "utf8");
assert.match(
  apiSrc,
  /action === "createPayboxBooking"/,
  "public-data API must expose createPayboxBooking"
);

const paymentLinksSrc = readFileSync(join(root, "../src/lib/paymentLinks.js"), "utf8");
assert.match(
  paymentLinksSrc,
  /openPayboxLink/,
  "PayBox still opens external links.payboxapp.com (no webhook)"
);

console.log("paybox booking confirm email path: ok");
