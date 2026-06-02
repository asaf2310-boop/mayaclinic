const MAYA_HERO_IMAGE =
  "https://media.base44.com/images/public/69ff3dea5e105013fde56ce0/e149fd61a_IMG_8737.jpg";

export const CLINIC_SITES = {
  "maya-clinic.vercel.app": {
    id: "maya",
    clinicTitle: "הקליניקה של מאיה",
    heroBadge: "ברוכים הבאים לקליניקה של מאיה",
    heroHeading: "טיפול מקצועי, יחס אישי ותהליך הזמנה פשוט",
    heroImage: MAYA_HERO_IMAGE,
    defaultTreatmentName: "מגע שיקומי",
    seedTreatments: [
      {
        name: "מגע שיקומי",
        description: "טיפול מגע שיקומי לפי שיטת מאיה",
        duration_minutes: 60,
        price: 320,
        icon: "🌿",
      },
    ],
    defaultSlots: ["09:00", "10:30", "12:00", "14:00", "16:00", "17:30"],
  },
};

export function getClinicSite(hostname = typeof window !== "undefined" ? window.location.hostname : "") {
  const host = String(hostname).toLowerCase().split(":")[0];
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
