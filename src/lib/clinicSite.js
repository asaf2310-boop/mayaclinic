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
      subtitle: "בהטבה דרך מרידיאן",
      url: "https://meridian-medicine.com/therapists/%d7%9e%d7%90%d7%99%d7%94-%d7%90%d7%a8%d7%99%d7%90%d7%9c%d7%99-%d7%91%d7%a8%d7%95%d7%9f/",
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

export function isHolisticTreatmentName(name) {
  const normalized = String(name || "").trim();
  if (!normalized) return false;

  return HOLISTIC_TREATMENT_NAME_MARKERS.some(
    (marker) => normalized === marker || normalized.startsWith(marker)
  );
}

export function getAllowedTreatmentNames(site = getClinicSite()) {
  if (!site) return null;
  return site.seedTreatments.map((treatment) => treatment.name);
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
 * @param {{ strictSeedNames?: boolean }} options
 *   strictSeedNames — booking page: only seedTreatments names (default false for admin).
 */
export function filterTreatmentsForClinic(treatments = [], site = getClinicSite(), options = {}) {
  if (!site) return treatments;

  const { strictSeedNames = false } = options;
  let filtered = filterByClinicTenant(treatments, site);

  if (isMayaTenant(site)) {
    filtered = filtered.filter((treatment) => !isHolisticTreatmentName(treatment?.name));

    if (strictSeedNames) {
      const allowedNames = new Set(getAllowedTreatmentNames(site));
      filtered = filtered.filter((treatment) =>
        allowedNames.has(String(treatment?.name || "").trim())
      );
    }
  }

  return filtered;
}

export function filterByClinicTenant(rows = [], site = getClinicSite()) {
  if (!site) return rows;

  const tenantId = site.id;
  const hasTenantColumn = rowsHaveTenantColumn(rows);
  const hasAnyTenant = hasTenantColumn && rowsHaveAnyTenant(rows);

  if (hasAnyTenant) {
    return rows.filter((row) => {
      const tenant = rowTenantId(row);
      if (tenant) return tenant === tenantId;
      if (isMayaTenant(site)) return rowBelongsToMaya(row, site);
      if (isHolisticTenant(site)) return rowBelongsToHolistic(row);
      return true;
    });
  }

  if (isMayaTenant(site)) {
    return rows.filter((row) => rowBelongsToMaya(row, site));
  }

  if (isHolisticTenant(site)) {
    return rows.filter((row) => rowBelongsToHolistic(row));
  }

  return rows;
}

export function filterAppointmentsForClinic(appointments = [], site = getClinicSite()) {
  if (!site) return appointments;

  const allowedNames = new Set(getAllowedTreatmentNames(site) || []);
  const tenantId = site.id;

  return appointments.filter((appointment) => {
    const tenant = rowTenantId(appointment);
    if (tenant) return tenant === tenantId;

    const treatmentName = String(appointment?.treatment_name || "").trim();
    if (isMayaTenant(site)) {
      if (isHolisticTreatmentName(treatmentName)) return false;
      if (allowedNames.size > 0) return allowedNames.has(treatmentName);
      return true;
    }

    if (isHolisticTenant(site)) {
      return isHolisticTreatmentName(treatmentName);
    }

    return true;
  });
}

export function filterPatientProfilesForClinic(profiles = [], site = getClinicSite()) {
  return filterByClinicTenant(profiles, site);
}

