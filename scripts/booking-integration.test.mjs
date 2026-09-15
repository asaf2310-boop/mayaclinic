import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { getBookingBasePath, bookingUrl, isBookingAdminPath, isPublicBookingMount } from "../src/lib/bookingMount.js";
import { getRequestBookingBasePath, resolveAdminAppOrigin, resolveAdminFrontPath, resolveBookingPublicBase } from "../server/bookingMount.js";
import paymentReturn from "../api/pelecard/return.js";

test("booking mount preserves legacy paths and external URLs", () => {
  assert.equal(getBookingBasePath("/booking"), "/booking");
  assert.equal(getBookingBasePath("/booking/book"), "/booking");
  assert.equal(getBookingBasePath("/booking/payment/success"), "/booking");
  assert.equal(bookingUrl("/maya-hero.png", "/booking"), "/booking/maya-hero.png");
  assert.equal(bookingUrl("/book", "/booking"), "/booking/book");
  assert.equal(getBookingBasePath("/book"), "");
  assert.equal(getBookingBasePath("/booking-other"), "");
  assert.equal(bookingUrl("/api/public-data?q=1", "/booking"), "/booking/api/public-data?q=1");
  assert.equal(bookingUrl("/booking/assets/app.js", "/booking"), "/booking/assets/app.js");
  assert.equal(bookingUrl("/api/public-data", ""), "/api/public-data");
  assert.equal(bookingUrl("https://db.example/rest/v1/items", "/booking"), "https://db.example/rest/v1/items");
  assert.equal(bookingUrl("//example.com/path", "/booking"), "//example.com/path");
});

test("public booking mount does not include admin routes", () => {
  assert.equal(isPublicBookingMount("/booking"), true);
  assert.equal(isPublicBookingMount("/booking/book"), true);
  assert.equal(isBookingAdminPath("/booking/admin"), true);
  assert.equal(isBookingAdminPath("/booking/admin/patient/abc"), true);
  assert.equal(isPublicBookingMount("/booking/admin"), false);
  assert.equal(isPublicBookingMount("/booking/admin/patient/abc"), false);
  assert.equal(isBookingAdminPath("/admin"), true);
  assert.equal(isBookingAdminPath("/admin/patient/abc"), true);
  assert.equal(isPublicBookingMount("/admin"), false);
  assert.equal(bookingUrl("/admin", "/booking"), "/booking/admin");
  assert.equal(bookingUrl("/admin/patient/x", "/booking"), "/booking/admin/patient/x");
  assert.equal(bookingUrl("/api/admin?action=session", "/booking"), "/booking/api/admin?action=session");
});

test("mounted admin origin and OAuth front path stay on the main domain", () => {
  const previous = process.env.OFIRBABY_BOOKING_ORIGIN;
  const legacy = process.env.PELECARD_PUBLIC_ORIGIN;
  try {
    process.env.OFIRBABY_BOOKING_ORIGIN = "https://www.ofirbaby.com";
    process.env.PELECARD_PUBLIC_ORIGIN = "https://ofirbaby.vercel.app";
    const req = {
      headers: { host: "ofirbaby.vercel.app", "x-forwarded-uri": "/booking/api/admin?action=google-start" },
      query: { bookingBasePath: "/booking" },
    };
    assert.equal(getRequestBookingBasePath(req), "/booking");
    assert.equal(resolveAdminAppOrigin(req, "/booking"), "https://www.ofirbaby.com");
    assert.equal(resolveAdminFrontPath("/booking", "/admin"), "/booking/admin");
    assert.equal(resolveAdminFrontPath("", "/admin"), "/admin");
    assert.equal(getRequestBookingBasePath({ headers: { host: "ofirbaby.vercel.app" }, query: {} }), "");
  } finally {
    if (previous === undefined) delete process.env.OFIRBABY_BOOKING_ORIGIN; else process.env.OFIRBABY_BOOKING_ORIGIN = previous;
    if (legacy === undefined) delete process.env.PELECARD_PUBLIC_ORIGIN; else process.env.PELECARD_PUBLIC_ORIGIN = legacy;
  }
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
