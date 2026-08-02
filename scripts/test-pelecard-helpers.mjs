import assert from "node:assert/strict";
import {
  shekelsToAgorot,
  getPelecardConfig,
  absolutePublicUrl,
  resolvePelecardCssUrl,
  DEFAULT_PELECARD_CSS_CDN,
  CLINIC_PELECARD_CSS_CDN,
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
assert.equal(cfg.cssPath, "");

assert.equal(
  absolutePublicUrl("https://ofirbaby.com", "/payment/clinic-v4.css"),
  "https://ofirbaby.com/payment/clinic-v4.css"
);

assert.equal(resolvePelecardCssUrl("https://ofirbaby.vercel.app"), DEFAULT_PELECARD_CSS_CDN);
assert.equal(
  DEFAULT_PELECARD_CSS_CDN,
  "https://gateway20.pelecard.biz/Content/Css/variant-he-4.css"
);
assert.equal(
  CLINIC_PELECARD_CSS_CDN,
  "https://ofirbaby.vercel.app/payment/clinic-v4.css"
);

// Legacy clinic CssURL env must not win over built-in wallet theme.
process.env.PELECARD_CSS_CDN = CLINIC_PELECARD_CSS_CDN;
assert.equal(resolvePelecardCssUrl("https://ofirbaby.vercel.app"), DEFAULT_PELECARD_CSS_CDN);
delete process.env.PELECARD_CSS_CDN;

// Explicit PELECARD_CSS_URL still overrides.
process.env.PELECARD_CSS_URL = "https://ofirbaby.vercel.app/api/pelecard/theme?v=1";
assert.equal(
  resolvePelecardCssUrl("https://ofirbaby.vercel.app"),
  "https://ofirbaby.vercel.app/api/pelecard/theme"
);
delete process.env.PELECARD_CSS_URL;

// Non-clinic CDN override is honored.
process.env.PELECARD_CSS_CDN =
  "https://gateway20.pelecard.biz/Content/Css/variant-he-3.css";
assert.equal(
  resolvePelecardCssUrl("https://ofirbaby.vercel.app"),
  "https://gateway20.pelecard.biz/Content/Css/variant-he-3.css"
);
delete process.env.PELECARD_CSS_CDN;

console.log("pelecard helpers ok");
