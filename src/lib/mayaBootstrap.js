import { getClinicSite } from "./clinicSite";

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export async function ensureClinicSeedData(base44) {
  const site = getClinicSite();
  if (!site) return { restoredTreatments: 0, restoredAvailability: 0 };

  let restoredTreatments = 0;
  let restoredAvailability = 0;

  const treatments = await base44.entities.Treatment.list();
  const treatmentList = Array.isArray(treatments) ? treatments : [];

  for (const seedTreatment of site.seedTreatments) {
    const exists = treatmentList.some(
      (treatment) => String(treatment?.name || "").trim() === seedTreatment.name
    );
    if (exists) continue;

    await base44.entities.Treatment.create(seedTreatment);
    restoredTreatments += 1;
  }

  const availability = await base44.entities.Availability.list();
  const availabilityList = Array.isArray(availability) ? availability : [];
  const existingDates = new Set(availabilityList.map((row) => row.date));

  for (let offset = 1; offset <= 30; offset += 1) {
    const date = formatDate(addDays(new Date(), offset));
    if (existingDates.has(date)) continue;

    await base44.entities.Availability.create({
      date,
      slots: site.defaultSlots,
      is_active: true,
    });
    restoredAvailability += 1;
  }

  return { restoredTreatments, restoredAvailability };
}
