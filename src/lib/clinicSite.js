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



/** Booking shows all treatments in the database; seedTreatments is bootstrap-only. */
export function filterTreatmentsForClinic(treatments = [], site = getClinicSite()) {
  if (!site) return treatments;
  return treatments;
}

