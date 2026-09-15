import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getBookingBasePath, bookingUrl } from "../src/lib/bookingMount.js";
import { resolveBookingPublicBase } from "../server/bookingMount.js";
import paymentReturn from "../api/pelecard/return.js";

test("booking mount preserves legacy paths and external URLs", () => {
  assert.equal(getBookingBasePath("/booking"), "/booking");
  assert.equal(getBookingBasePath("/booking/payment/success"), "/booking");
  assert.equal(getBookingBasePath("/book"), "");
  assert.equal(getBookingBasePath("/booking-other"), "");
  assert.equal(bookingUrl("/api/public-data?q=1", "/booking"), "/booking/api/public-data?q=1");
  assert.equal(bookingUrl("/booking/assets/app.js", "/booking"), "/booking/assets/app.js");
  assert.equal(bookingUrl("/api/public-data", ""), "/api/public-data");
  assert.equal(bookingUrl("https://db.example/rest/v1/items", "/booking"), "https://db.example/rest/v1/items");
  assert.equal(bookingUrl("//example.com/path", "/booking"), "//example.com/path");
});

test("payment callbacks remain on a configured origin and preserve legacy checkout", async () => {
  const previous = process.env.OFIRBABY_BOOKING_ORIGIN;
  const legacy = process.env.PELECARD_PUBLIC_ORIGIN;
  try {
    process.env.OFIRBABY_BOOKING_ORIGIN = "https://www.ofirbaby.com";
    process.env.PELECARD_PUBLIC_ORIGIN = "https://ofirbaby.vercel.app";
    const req = { headers: { host: "untrusted.example" } };
    assert.equal(resolveBookingPublicBase(req, "/booking"), "https://www.ofirbaby.com/booking");
    assert.equal(resolveBookingPublicBase(req), "https://ofirbaby.vercel.app");
    assert.throws(() => resolveBookingPublicBase(req, "//evil.example"));
    let html = "";
    const res = { setHeader() {}, status() { return this; }, send(value) { html = value; }, end(value) { html = value; } };
    await paymentReturn({ ...req, query: { outcome: "good", ref: "test-reference", bookingBasePath: "/booking" } }, res);
    assert.match(html, /https:\/\/www\.ofirbaby\.com\/booking\/payment\/success\?ref=test-reference/);
    assert.match(html, /sessionStorage\.getItem/);
    await paymentReturn({ ...req, query: { outcome: "error", ref: "test-reference" } }, res);
    assert.match(html, /https:\/\/ofirbaby\.vercel\.app\/payment\/failure/);
    process.env.OFIRBABY_BOOKING_ORIGIN = "https://example.com/wrong-path";
    assert.throws(() => resolveBookingPublicBase(req, "/booking"));
    delete process.env.OFIRBABY_BOOKING_ORIGIN;
    assert.throws(() => resolveBookingPublicBase(req, "/booking"));
  } finally {
    if (previous === undefined) delete process.env.OFIRBABY_BOOKING_ORIGIN; else process.env.OFIRBABY_BOOKING_ORIGIN = previous;
    if (legacy === undefined) delete process.env.PELECARD_PUBLIC_ORIGIN; else process.env.PELECARD_PUBLIC_ORIGIN = legacy;
  }
});

test("built entry isolates assets under booking and prevents indexing", async () => {
  const entry = await readFile(new URL("../dist/booking-entry.html", import.meta.url), "utf8");
  assert.match(entry, /lang="he" dir="rtl"/);
  assert.match(entry, /name="robots" content="noindex, nofollow"/);
  assert.match(entry, /src="\/booking\/assets\//);
  assert.doesNotMatch(entry, /(?:src|href)="\/assets\//);
  assert.doesNotMatch(entry, /rel="manifest"/);
});
