const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCES = new Set([
  "direct", "google_organic", "bing_organic", "facebook", "instagram",
  "whatsapp", "other_social", "referral", "paid_campaign", "unknown",
]);
const BASES = new Set(["measured_utm", "measured_referrer", "inferred", "unattributed"]);

function uuid(value) {
  const text = String(value || "").trim();
  return UUID.test(text) ? text : null;
}

function oneOf(value, allowed, fallback) {
  const text = String(value || "").trim();
  return allowed.has(text) ? text : fallback;
}

function text(value, max = 200) {
  const raw = String(value || "").trim();
  return raw ? raw.slice(0, max) : null;
}

export function pickAnalyticsContext(raw = {}) {
  const source = raw.analytics && typeof raw.analytics === "object" ? raw.analytics : raw;
  return {
    visitorId: uuid(source.visitorId || source.visitor_id),
    sessionId: uuid(source.sessionId || source.session_id),
    bookingJourneyId: uuid(source.bookingJourneyId || source.booking_journey_id),
    source: oneOf(source.source, SOURCES, "direct"),
    basis: oneOf(source.basis || source.attribution_basis, BASES, "unattributed"),
    firstTouchSource: oneOf(source.firstTouchSource || source.first_touch_source, SOURCES, "direct"),
    firstTouchBasis: oneOf(source.firstTouchBasis || source.first_touch_basis, BASES, "unattributed"),
    landingPage: text(source.landingPage || source.landing_page, 500) || "/",
    initialReferrer: text(source.initialReferrer || source.initial_referrer, 500),
    utm_source: text(source.utm_source),
    utm_medium: text(source.utm_medium),
    utm_campaign: text(source.utm_campaign),
    utm_content: text(source.utm_content),
    utm_term: text(source.utm_term),
    host: text(source.host, 255) || "www.ofirbaby.com",
  };
}

export async function recordBookingCompleted(rawAnalytics, appointmentIds = []) {
  const secret = process.env.ANALYTICS_INGEST_SECRET;
  const ingestUrl = process.env.OFIRBABY_ANALYTICS_INGEST_URL || "https://www.ofirbaby.com/api/analytics/ingest";
  if (!secret || secret.length < 32) {
    console.warn("booking analytics ingest skipped: ANALYTICS_INGEST_SECRET missing");
    return { skipped: "unconfigured" };
  }

  const analytics = pickAnalyticsContext(rawAnalytics);
  if (!analytics.bookingJourneyId || !analytics.visitorId || !analytics.sessionId) {
    console.warn("booking analytics ingest skipped: missing journey/visitor/session");
    return { skipped: "missing_identity" };
  }

  const ids = (Array.isArray(appointmentIds) ? appointmentIds : [])
    .map((id) => String(id || "").trim())
    .filter(Boolean);
  const response = await fetch(ingestUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${secret}`,
    },
    body: JSON.stringify({
      eventName: "booking_completed",
      visitorId: analytics.visitorId,
      sessionId: analytics.sessionId,
      bookingJourneyId: analytics.bookingJourneyId,
      source: analytics.source,
      basis: analytics.basis,
      firstTouchSource: analytics.firstTouchSource,
      firstTouchBasis: analytics.firstTouchBasis,
      pathname: "/booking/book",
      landingPage: analytics.landingPage,
      initialReferrer: analytics.initialReferrer,
      host: analytics.host,
      contentKey: ids[0] ? `appointment:${ids[0]}` : analytics.bookingJourneyId,
      utm_source: analytics.utm_source,
      utm_medium: analytics.utm_medium,
      utm_campaign: analytics.utm_campaign,
      utm_content: analytics.utm_content,
      utm_term: analytics.utm_term,
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error("booking analytics ingest failed", response.status, body.slice(0, 300));
    return { ok: false, status: response.status };
  }
  return response.json().catch(() => ({ ok: true }));
}
