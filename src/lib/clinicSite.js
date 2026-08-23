export const CLINIC_SITES = {

  "maya-clinic.vercel.app": {

    id: "maya",

    clinicTitle: "אופיר - מרכז טיפול הוליסטי",

    clinicPhone: "0549000301",

    heroBadge: "רפואה אסתטית, בריאות ורעננות טבעית",

    heroHeading: "מאיה קליניק –",

    heroHeadingMid: "המקום בו",

    heroHeadingHighlight: "רעננות פוגשת בריאות",

    heroSubtext:

      "בקליניקה לרפואה אסתטית וטיפולית, אנו מעניקים לך את הזוהר הטבעי, בגישה עדינה ומודרנית. מגוון טיפולים מתקדמים בפנים, בגוף, ובאווירה תומכת.",

    heroCtaPrimary: "לקביעת תור",

    heroExternalLinks: [
      { label: "מידע על טיפולים", url: "https://www.ofirbaby.com", icon: "lotus" },
      { label: "מידע על מוצרים", url: "https://www.klamra-designs.com", icon: "home-leaf" },
    ],

    heroMeridianLink: {
      title: "תור למילואימניקים ונפגעי פעולות איבה",
      subtitle: "אימות מזהה טיפול במרידיאן",
      url: "/book?payment=meridian",
    },

    heroFloatingTitle: "רעננות טבעית,",

    heroFloatingSubtitle: "בתוצאות מיידיות",

    heroLiveStatusLabel: "Live Status",

    heroLiveStatusText: "תורים קרובים פנויים השבוע!",

    heroImage: "/maya-hero.png",

    defaultTreatmentName: "מגע שיקומי",

    seedTreatments: [

      {

        name: "מגע שיקומי",

        description: "טיפול מגע שיקומי לפי שיטת מאיה",

        duration_minutes: 60,

        price: 320,

        icon: "🌿",

        paybox_link: "https://links.payboxapp.com/m8x1lhYoD3b",

      },

    ],

    defaultSlots: ["09:00", "10:30", "12:00", "14:00", "16:00", "17:30"],

    bitQrImage: "/maya-bit-qr.png",

    payboxLink: "https://links.payboxapp.com/m8x1lhYoD3b",

    payboxOverrides: [
      {
        name: "מפגש הדרכה התפתחותית לתינוקות וילדים (פתח תקווה והסביבה)",
        price: 350,
        url: "https://links.payboxapp.com/D5nYQd0Lm4b",
      },
    ],

    /** Movement (מובמנט) booking channel — /book?channel=movement */
    momentBooking: {
      channel: "movement",
      durationMinutes: 45,
      ctaLabel: "קביעת תור — לקוחות Movement",
      pageTitle: "קביעת תור — לקוחות מובמנט",
      pageSubtitle: "טיפולים ללקוחות מובמנט · כל תור 45 דקות · ללא תשלום באשראי",
      /** Base names hidden on the Movement booking channel. */
      excludeTreatmentBaseNames: ["התנהגות לילד"],
    },

  },

};


const MAYA_CLINIC_HOSTS = new Set([
  "maya-clinic.vercel.app",
  "www.maya-clinic.vercel.app",
  "ofirbaby.vercel.app",
  "www.ofirbaby.vercel.app",
  "ofirbaby.com",
  "www.ofirbaby.com",
  "localhost",
  "127.0.0.1",
]);

export function getClinicSite(hostname = typeof window !== "undefined" ? window.location.hostname : "") {

  const host = String(hostname).toLowerCase().split(":")[0];

  if (MAYA_CLINIC_HOSTS.has(host)) {
    return CLINIC_SITES["maya-clinic.vercel.app"];
  }
  return CLINIC_SITES[host] || null;

}



export function isProductionClinicHost(hostname = typeof window !== "undefined" ? window.location.hostname : "") {

  return Boolean(getClinicSite(hostname));

}



/** Holistic-center treatment names seeded in supabase/multi-tenant.sql */
const HOLISTIC_TREATMENT_NAME_MARKERS = [
  "עיסוי תאילנדי",
  "טיפול במגע עם איגנט",
  "טיפול במגע עם עומר",
  "עיסוי 4 ידיים",
  "עיסוי זוגי",
];

const HOLISTIC_NAME_HINT =
  /הוליסט|איגנט|עומר שלגי|עיסוי תאילנד|4 ידיים|ארבע ידיים|עיסוי זוגי|four hands|thai massage/i;

export function isHolisticTreatmentName(name) {
  const normalized = String(name || "").trim();
  if (!normalized) return false;

  if (HOLISTIC_NAME_HINT.test(normalized)) return true;

  return HOLISTIC_TREATMENT_NAME_MARKERS.some(
    (marker) => normalized === marker || normalized.startsWith(marker)
  );
}

export function getAllowedTreatmentNames(site = getClinicSite()) {
  if (!site) return null;
  return site.seedTreatments.map((treatment) => treatment.name);
}

export function isMomentBookingChannel(channel) {
  const value = String(channel || "").trim().toLowerCase();
  const configured = String(getClinicSite()?.momentBooking?.channel || "movement")
    .trim()
    .toLowerCase();
  return value === configured || value === "moment" || value === "movement";
}

/** Display name without trailing duration (e.g. " — 60 דק׳"). */
export function treatmentBaseName(name = "") {
  return String(name)
    .replace(/\s*[—–-]\s*\d+\s*דק[׳']?\s*$/u, "")
    .trim();
}

/**
 * Treatments for the public booking page by channel.
 * Movement (מובמנט): no prices, every session forced to 45 minutes, excluded bases hidden.
 */
export function getTreatmentsForBookingChannel(treatments = [], channel, site = getClinicSite()) {
  const catalog = filterTreatmentsForClinic(treatments, site);
  if (!isMomentBookingChannel(channel)) return catalog;

  const duration = site?.momentBooking?.durationMinutes ?? 45;
  const excluded = new Set(
    (site?.momentBooking?.excludeTreatmentBaseNames || []).map((name) =>
      String(name || "").trim()
    )
  );
  const seen = new Set();
  const momentTreatments = [];

  for (const treatment of catalog) {
    const baseName = treatmentBaseName(treatment.name) || treatment.name;
    if (excluded.has(baseName)) continue;
    if (/התנהגות\s*לילד/u.test(baseName)) continue;
    if (seen.has(baseName)) continue;
    seen.add(baseName);
    momentTreatments.push({
      ...treatment,
      name: baseName,
      duration_minutes: duration,
      price: null,
      hide_price: true,
      booking_channel: site?.momentBooking?.channel || "movement",
    });
  }

  return momentTreatments;
}

function rowTenantId(row) {
  return String(row?.tenant_id || "").trim();
}

function rowsHaveTenantColumn(rows = []) {
  return rows.some((row) => Object.prototype.hasOwnProperty.call(row, "tenant_id"));
}

function rowsHaveAnyTenant(rows = []) {
  return rows.some((row) => rowTenantId(row));
}

function isMayaTenant(site = getClinicSite()) {
  return site?.id === "maya";
}

function isHolisticTenant(site = getClinicSite()) {
  return site?.id === "holistic";
}

function rowBelongsToMaya(row, site = getClinicSite()) {
  const tenant = rowTenantId(row);
  if (tenant === "holistic") return false;
  if (tenant === "maya") return true;

  const treatmentName = String(row?.treatment_name || row?.name || "").trim();
  if (treatmentName && isHolisticTreatmentName(treatmentName)) return false;

  return true;
}

function rowBelongsToHolistic(row) {
  const tenant = rowTenantId(row);
  if (tenant === "maya") return false;
  if (tenant === "holistic") return true;

  const treatmentName = String(row?.treatment_name || row?.name || "").trim();
  if (treatmentName) return isHolisticTreatmentName(treatmentName);

  return false;
}

/**
 * Maya: tenant_id=maya rows, excluding holistic treatment names.
 * Holistic: tenant_id=holistic rows only.
 */
export function filterTreatmentsForClinic(treatments = [], site = getClinicSite()) {
  if (!site) return treatments;

  let filtered = filterByClinicTenant(treatments, site);

  if (isMayaTenant(site)) {
    filtered = filtered.filter((treatment) => !isHolisticTreatmentName(treatment?.name));
  }

  return filtered;
}

export function resolveClinicPayboxOverride(treatment, site = getClinicSite()) {
  const overrides = Array.isArray(site?.payboxOverrides) ? site.payboxOverrides : [];
  const treatmentName = String(treatment?.name || "").trim();
  const treatmentPrice = Number(treatment?.price);

  const match = overrides.find((item) => {
    const overrideName = String(item?.name || "").trim();
    const overridePrice = Number(item?.price);
    return (
      overrideName === treatmentName &&
      Number.isFinite(overridePrice) &&
      Number.isFinite(treatmentPrice) &&
      overridePrice === treatmentPrice
    );
  });

  return String(match?.url || "").trim();
}

export function filterByClinicTenant(rows = [], site = getClinicSite()) {
  if (!site) return rows;

  const tenantId = site.id;

  return rows.filter((row) => {
    const tenant = rowTenantId(row);
    if (tenant && tenant !== tenantId) return false;

    if (isMayaTenant(site)) {
      if (tenant === "holistic") return false;
      if (isHolisticTreatmentName(row?.treatment_name || row?.name)) return false;
      return true;
    }

    if (isHolisticTenant(site)) {
      if (tenant === "maya") return false;
      if (tenant === "holistic") return true;
      return isHolisticTreatmentName(row?.treatment_name || row?.name);
    }

    return tenant ? tenant === tenantId : true;
  });
}

export function filterAppointmentsForClinic(appointments = [], site = getClinicSite()) {
  if (!site) return appointments;

  const allowedNames = new Set(getAllowedTreatmentNames(site) || []);
  const tenantId = site.id;

  return appointments.filter((appointment) => {
    const tenant = rowTenantId(appointment);
    const treatmentName = String(appointment?.treatment_name || "").trim();

    // Hard separation: never show the other clinic's tagged rows.
    if (tenant && tenant !== tenantId) return false;

    if (isMayaTenant(site)) {
      // Defense in depth for mis-tagged holistic rows still marked tenant=maya.
      if (isHolisticTreatmentName(treatmentName)) return false;
      if (tenant === "maya") return true;
      if (allowedNames.size > 0) return allowedNames.has(treatmentName);
      return !isHolisticTreatmentName(treatmentName);
    }

    if (isHolisticTenant(site)) {
      if (tenant === "holistic") return true;
      return isHolisticTreatmentName(treatmentName);
    }

    return tenant ? tenant === tenantId : true;
  });
}

export function filterPatientProfilesForClinic(profiles = [], site = getClinicSite()) {
  return filterByClinicTenant(profiles, site);
}

