import { pickAnalyticsContext } from "../server/websiteAnalytics.js";

const leaked = pickAnalyticsContext({
  patient_name: "secret-name",
  patient_phone: "0500000000",
  patient_email: "a@b.c",
  notes: "medical",
  analytics: {
    visitorId: "11111111-1111-4111-8111-111111111111",
    sessionId: "22222222-2222-4222-8222-222222222222",
    bookingJourneyId: "33333333-3333-4333-8333-333333333333",
    source: "google_organic",
    basis: "measured_referrer",
    firstTouchSource: "google_organic",
    firstTouchBasis: "measured_referrer",
    landingPage: "/",
  },
});

if (leaked.patient_name || leaked.patient_phone || leaked.patient_email || leaked.notes) {
  throw new Error("PII keys present");
}
if (JSON.stringify(leaked).includes("secret-name")) throw new Error("PII leaked");
if (JSON.stringify(leaked).includes("0500000000")) throw new Error("phone leaked");
if (JSON.stringify(leaked).includes("a@b.c")) throw new Error("email leaked");
if (leaked.bookingJourneyId !== "33333333-3333-4333-8333-333333333333") throw new Error("journey missing");
console.log("analytics-context-ok");
