import assert from "node:assert/strict";
import {
  shekelsToAgorot,
  getPelecardConfig,
  absolutePublicUrl,
  resolvePelecardCssUrl,
  DEFAULT_PELECARD_CSS_CDN,
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
delete process.env.PELECARD_CSS_CDN;
delete process.env.PELECARD_LOGO_PATH;
delete process.env.PELECARD_LOGO_URL;
assert.equal(getPelecardConfig().configured, false);

process.env.PELECARD_TERMINAL = "t1";
process.env.PELECARD_USER = "u1";
process.env.PELECARD_PASSWORD = "p1";
const cfg = getPelecardConfig();
assert.equal(cfg.configured, true);
assert.equal(cfg.gatewayBase, "https://gateway20.pelecard.biz");

assert.equal(
  absolutePublicUrl("https://ofirbaby.com", "/payment/clinic-v4.css"),
  "https://ofirbaby.com/payment/clinic-v4.css"
);

assert.equal(resolvePelecardCssUrl("https://ofirbaby.vercel.app"), DEFAULT_PELECARD_CSS_CDN);
assert.ok(DEFAULT_PELECARD_CSS_CDN.includes("gateway20.pelecard.biz"));
assert.ok(DEFAULT_PELECARD_CSS_CDN.includes("variant-he-3.css"));

process.env.PELECARD_CSS_URL = "https://gateway20.pelecard.biz/Content/Css/variant-he-4.css?v=1";
assert.equal(
  resolvePelecardCssUrl("https://ofirbaby.vercel.app"),
  "https://gateway20.pelecard.biz/Content/Css/variant-he-4.css"
);
delete process.env.PELECARD_CSS_URL;

console.log("pelecard helpers ok");
