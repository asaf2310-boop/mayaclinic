import assert from "node:assert/strict";
import {
  createMeridianVerificationToken,
  createPaymentSessionToken,
  verifyMeridianVerificationToken,
  verifyPaymentSessionToken,
} from "../server/paymentSessionToken.js";

process.env.PELECARD_SESSION_SECRET = "test-meridian-session-secret";

const tid = "750445114";
const token = createMeridianVerificationToken(tid, 60);
assert.equal(verifyMeridianVerificationToken(tid, token), true);
assert.equal(verifyMeridianVerificationToken("999999999", token), false);
assert.equal(verifyMeridianVerificationToken(tid, "not.a.token"), false);

const expired = createMeridianVerificationToken(tid, -10);
assert.equal(verifyMeridianVerificationToken(tid, expired), false);

const paymentToken = createPaymentSessionToken("booking-ref-1", 60);
assert.equal(verifyPaymentSessionToken("booking-ref-1", paymentToken), true);
assert.equal(verifyMeridianVerificationToken(tid, paymentToken), false);

console.log("meridian verification token: ok");
