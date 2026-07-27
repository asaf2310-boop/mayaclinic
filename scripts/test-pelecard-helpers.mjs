import assert from "node:assert/strict";
import {
  shekelsToAgorot,
  getPelecardConfig,
} from "../api/lib/pelecard.js";

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

console.log("pelecard helpers ok");
