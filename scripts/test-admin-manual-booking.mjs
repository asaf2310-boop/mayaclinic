import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(join(root, rel), "utf8");

const payments = read("server/pelecardPayments.js");
const admin = read("api/admin.js");
const dialog = read("src/components/admin/AppointmentCreateDialog.jsx");
const page = read("src/pages/Admin.jsx");
const client = read("src/lib/adminBooking.js");

assert.match(payments, /export async function createAdminBooking/);
assert.match(
  payments,
  /await maybeSendConfirmationEmail\(persisted\.createdRows\);[\s\S]*await maybeSendBookingConfirmSms\(persisted\.createdRows\);/
);
assert.match(payments, /sourceLabel:\s*"ניהול \/ תור ידני"/);
assert.match(payments, /actor:\s*"admin"/);
assert.match(payments, /requireCalendarSync:\s*true/);

assert.match(admin, /action === "create-appointment"/);
assert.match(admin, /createAdminBooking/);
// Edit/email paths must still not call confirmation helper directly in admin.js.
assert.doesNotMatch(admin, /maybeSendConfirmationEmail/);

assert.match(client, /action=create-appointment/);
assert.match(dialog, /createAdminAppointment/);
assert.match(page, /AppointmentCreateDialog/);
assert.match(page, /תור חדש/);

console.log("admin manual booking wiring tests passed");
