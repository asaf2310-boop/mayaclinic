import assert from "node:assert/strict";
import {
  shekelsToAgorot,
  getPelecardConfig,
  absolutePublicUrl,
} from "../server/pelecard.js";

assert.equal(shekelsToAgorot(320), 32000);
assert.equal(shekelsToAgorot("250.5"), 25050);
assert.equal(shekelsToAgorot(0), 0);
assert.equal(shekelsToAgorot(-5), 0);

process.env.PELECARD_TERMINAL = "";
process.env.PELECARD_USER = "";
process.env.PELECARD_PASSWORD = "";
assert.equal(getPelecardConfig().configured, false);

process.env.PELECARD_TERMINAL = "t1";
process.env.PELECARD_USER = "u1";
process.env.PELECARD_PASSWORD = "p1";
const cfg = getPelecardConfig();
assert.equal(cfg.configured, true);
assert.equal(cfg.gatewayBase, "https://gateway20.pelecard.biz");
assert.equal(cfg.cssPath, "/payment/pelecard-clinic.css");

assert.equal(
  absolutePublicUrl("https://ofirbaby.com", "/payment/pelecard-clinic.css"),
  "https://ofirbaby.com/payment/pelecard-clinic.css"
);
assert.equal(
  absolutePublicUrl("https://ofirbaby.com", "https://cdn.example/a.css"),
  "https://cdn.example/a.css"
);

console.log("pelecard helpers ok");
