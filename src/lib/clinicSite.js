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



export function getAllowedTreatmentNames(site = getClinicSite()) {
  if (!site) return null;
  return site.seedTreatments.map((treatment) => treatment.name);
}

export function filterTreatmentsForClinic(treatments = [], site = getClinicSite()) {
  if (!site) return treatments;

  const allowedNames = new Set(getAllowedTreatmentNames(site));
  return treatments.filter((treatment) => allowedNames.has(String(treatment?.name || "").trim()));
}

export function filterByClinicTenant(rows = [], site = getClinicSite()) {
  if (!site) return rows;

  const tenantId = site.id;
  const hasTenantColumn = rows.some((row) => Object.prototype.hasOwnProperty.call(row, "tenant_id"));
  if (!hasTenantColumn) return rows;

  const hasAnyTenant = rows.some((row) => String(row?.tenant_id || "").trim());
  if (!hasAnyTenant) return rows;

  return rows.filter((row) => String(row?.tenant_id || "").trim() === tenantId);
}

export function filterAppointmentsForClinic(appointments = [], site = getClinicSite()) {
  if (!site) return appointments;

  const allowedNames = new Set(getAllowedTreatmentNames(site));
  const tenantId = site.id;

  return appointments.filter((appointment) => {
    const rowTenant = String(appointment?.tenant_id || "").trim();
    if (rowTenant) return rowTenant === tenantId;

    const treatmentName = String(appointment?.treatment_name || "").trim();
    return allowedNames.has(treatmentName);
  });
}

