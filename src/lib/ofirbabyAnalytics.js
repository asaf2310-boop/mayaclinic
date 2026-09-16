const VISITOR_KEY = "ofirbaby:visitor:v1";
const SESSION_KEY = "ofirbaby:session:v1";
const FIRST_TOUCH_KEY = "ofirbaby:first-touch:v1";
const JOURNEY_KEY = "ofirbaby:booking-journey:v1";
const JOURNEY_DONE_KEY = "ofirbaby:booking-journey-done:v1";
const STARTED_PREFIX = "ofirbaby:booking-funnel:";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return Boolean(value && UUID.test(value));
}

function readSessionJson() {
  try {
    return JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function readFirstTouchJson() {
  try {
    return JSON.parse(localStorage.getItem(FIRST_TOUCH_KEY) || "null");
  } catch {
    return null;
  }
}

export function getOrCreateVisitorId() {
  if (typeof localStorage === "undefined") return crypto.randomUUID();
  const existing = localStorage.getItem(VISITOR_KEY);
  if (isUuid(existing)) return existing;
  const visitorId = crypto.randomUUID();
  localStorage.setItem(VISITOR_KEY, visitorId);
  return visitorId;
}

export function ensureBookingJourney() {
  if (typeof sessionStorage === "undefined") return crypto.randomUUID();
  const done = sessionStorage.getItem(JOURNEY_DONE_KEY);
  const current = sessionStorage.getItem(JOURNEY_KEY);
  if (isUuid(current) && current !== done) return current;
  const journeyId = crypto.randomUUID();
  sessionStorage.setItem(JOURNEY_KEY, journeyId);
  return journeyId;
}

export function markBookingJourneyComplete() {
  if (typeof sessionStorage === "undefined") return;
  const current = sessionStorage.getItem(JOURNEY_KEY);
  if (isUuid(current)) sessionStorage.setItem(JOURNEY_DONE_KEY, current);
}

function sessionAttribution() {
  const session = readSessionJson() || {};
  const firstTouch = readFirstTouchJson() || session;
  return {
    sessionId: isUuid(session.sessionId) ? session.sessionId : crypto.randomUUID(),
    source: session.source || "direct",
    basis: session.basis || "unattributed",
    firstTouchSource: firstTouch.source || session.source || "direct",
    firstTouchBasis: firstTouch.basis || session.basis || "unattributed",
    landingPage: session.landingPage || "/",
    initialReferrer: session.initialReferrer || null,
    utm_source: session.utm_source || null,
    utm_medium: session.utm_medium || null,
    utm_campaign: session.utm_campaign || null,
    utm_content: session.utm_content || null,
    utm_term: session.utm_term || null,
  };
}

export function getBookingAnalyticsContext() {
  const attribution = sessionAttribution();
  if (typeof sessionStorage !== "undefined" && !readSessionJson()?.sessionId) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({
      ...attribution,
      sessionId: attribution.sessionId,
    }));
  }
  return {
    visitorId: getOrCreateVisitorId(),
    bookingJourneyId: ensureBookingJourney(),
    ...attribution,
  };
}

export function emitBookingFunnelEvent(eventName, extra = {}) {
  if (typeof window === "undefined") return;
  if (!["booking_started", "treatment_selected", "timeslot_selected"].includes(eventName)) return;
  const context = getBookingAnalyticsContext();
  if (eventName === "booking_started" || eventName === "treatment_selected" || eventName === "timeslot_selected") {
    const flag = `${STARTED_PREFIX}${eventName}:${context.bookingJourneyId}`;
    if (sessionStorage.getItem(flag) === "1") return;
    sessionStorage.setItem(flag, "1");
  }
  void fetch("/api/analytics/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      eventName,
      host: window.location.hostname,
      pathname: window.location.pathname || "/booking/book",
      contentType: "page",
      contentKey: extra.contentKey || window.location.pathname || "/booking/book",
      ...context,
    }),
  });
}
