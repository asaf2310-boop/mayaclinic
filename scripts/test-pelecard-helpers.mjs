import assert from "node:assert/strict";
import {
  shekelsToAgorot,
  getPelecardConfig,
  absolutePublicUrl,
  resolvePelecardCssUrl,
} from "../server/pelecard.js";

assert.equal(shekelsToAgorot(320), 32000);
assert.equal(shekelsToAgorot("250.5"), 25050);
assert.equal(shekelsToAgorot(0), 0);
assert.equal(shekelsToAgorot(-5), 0);

process.env.PELECARD_TERMINAL = "";
process.env.PELECARD_USER = "";
process.env.PELECARD_PASSWORD = "";
delete process.env.PELECARD_CSS_URL;
delete process.env.PELECARD_CSS_PATH;
assert.equal(getPelecardConfig().configured, false);

process.env.PELECARD_TERMINAL = "t1";
process.env.PELECARD_USER = "u1";
process.env.PELECARD_PASSWORD = "p1";
const cfg = getPelecardConfig();
assert.equal(cfg.configured, true);
assert.equal(cfg.gatewayBase, "https://gateway20.pelecard.biz");
assert.equal(cfg.cssPath, "/payment/clinic-v4.css");

assert.equal(
  absolutePublicUrl("https://ofirbaby.com", "/payment/clinic-v4.css"),
  "https://ofirbaby.com/payment/clinic-v4.css"
);
assert.equal(
  absolutePublicUrl("https://ofirbaby.com", "https://cdn.example/a.css"),
  "https://cdn.example/a.css"
);

assert.equal(
  resolvePelecardCssUrl("https://ofirbaby.vercel.app"),
  "https://ofirbaby.vercel.app/payment/clinic-v4.css"
);

process.env.PELECARD_CSS_URL = "https://cdn.example/x.css?v=1";
assert.equal(resolvePelecardCssUrl("https://ofirbaby.vercel.app"), "https://cdn.example/x.css");
delete process.env.PELECARD_CSS_URL;

console.log("pelecard helpers ok");
