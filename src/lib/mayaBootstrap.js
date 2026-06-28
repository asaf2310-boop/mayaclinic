import { filterByClinicTenant, getClinicSite } from "./clinicSite";
import { getClinicTenantId } from "./tenant";
import { createEmptyWeeklyTemplate } from "./weeklySchedule";

export const AVAILABILITY_CLEARED_KEY = "clinic-availability-cleared";
export const DEFAULT_AVAILABILITY_DAYS = 30;

export function markAvailabilityCleared() {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem(AVAILABILITY_CLEARED_KEY, "1");
  }
}

export function clearAvailabilityClearedMark() {
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem(AVAILABILITY_CLEARED_KEY);
  }
}

export function isAvailabilityCleared() {
  return typeof sessionStorage !== "undefined" && sessionStorage.getItem(AVAILABILITY_CLEARED_KEY) === "1";
}

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

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function buildDefaultAvailabilityDates(daysAhead = DEFAULT_AVAILABILITY_DAYS, fromDate = new Date()) {
  const dates = [];
  for (let offset = 1; offset <= daysAhead; offset += 1) {
    dates.push(formatDate(addDays(fromDate, offset)));
  }
  return dates;
}

function availabilityPayload(site, date) {
  const payload = {
    date,
    slots: [...site.defaultSlots],
    is_active: true,
  };
  const tenantId = getClinicTenantId();
  if (tenantId) payload.tenant_id = tenantId;
  return payload;
}

async function listAllAvailability(base44) {
  if (typeof base44.entities.Availability.listAll === "function") {
    return base44.entities.Availability.listAll("date");
  }
  return base44.entities.Availability.list("date", 1000);
}

/**
 * Remove duplicate weekly template rows and reset to an inactive empty template.
 */
export async function restoreDefaultWeeklySchedule(base44, site = getClinicSite()) {
  if (!site || !base44.entities.WeeklySchedule) {
    return { reset: 0, removed: 0 };
  }

  const weeklyRecords = await base44.entities.WeeklySchedule.list("day_of_week");
  const clinicRows = filterByClinicTenant(Array.isArray(weeklyRecords) ? weeklyRecords : [], site);

  let removed = 0;
  for (const row of clinicRows) {
    if (!row?.id) continue;
    await base44.entities.WeeklySchedule.delete(row.id);
    removed += 1;
  }

  const tenantId = getClinicTenantId();
  for (const day of createEmptyWeeklyTemplate()) {
    const payload = {
      day_of_week: day.day_of_week,
      slots: [],
      is_active: false,
    };
    if (tenantId) payload.tenant_id = tenantId;
    await base44.entities.WeeklySchedule.create(payload);
  }

  return { reset: 7, removed };
}

/**
 * Reset Maya clinic availability to defaultSlots for the next 30 days.
 * Clears duplicate weekly templates and future availability outside the window.
 */
export async function restoreDefaultAvailability(base44, site = getClinicSite(), { daysAhead = DEFAULT_AVAILABILITY_DAYS } = {}) {
  if (!site) return { restored: 0, removed: 0, weeklyRemoved: 0 };

  const availability = await listAllAvailability(base44);
  const clinicRows = filterByClinicTenant(Array.isArray(availability) ? availability : [], site);
  const existingByDate = Object.fromEntries(clinicRows.map((row) => [row.date, row]));
  const targetDates = new Set(buildDefaultAvailabilityDates(daysAhead));
  const today = startOfDay(new Date());

  let restored = 0;
  for (const date of targetDates) {
    const payload = availabilityPayload(site, date);
    const existing = existingByDate[date];
    if (existing?.id) {
      await base44.entities.Availability.update(existing.id, payload);
    } else {
      await base44.entities.Availability.create(payload);
    }
    restored += 1;
  }

  let removed = 0;
  for (const row of clinicRows) {
    if (!row?.id || !row.date || targetDates.has(row.date)) continue;
    const rowDate = new Date(`${row.date}T00:00:00`);
    if (rowDate >= today) {
      await base44.entities.Availability.delete(row.id);
      removed += 1;
    }
  }

  const { removed: weeklyRemoved } = await restoreDefaultWeeklySchedule(base44, site);

  clearAvailabilityClearedMark();
  return { restored, removed, weeklyRemoved };
}

export async function ensureClinicSeedData(base44) {
  const site = getClinicSite();
  if (!site) return { restoredTreatments: 0, restoredAvailability: 0 };

  let restoredTreatments = 0;
  let restoredAvailability = 0;

  const treatments = await base44.entities.Treatment.list();
  const treatmentList = filterByClinicTenant(Array.isArray(treatments) ? treatments : [], site);

  for (const seedTreatment of site.seedTreatments) {
    const exists = treatmentList.some(
      (treatment) => String(treatment?.name || "").trim() === seedTreatment.name
    );
    if (exists) continue;

    await base44.entities.Treatment.create(seedTreatment);
    restoredTreatments += 1;
  }

  if (!isAvailabilityCleared()) {
    const availability = await listAllAvailability(base44);
    const availabilityList = filterByClinicTenant(Array.isArray(availability) ? availability : [], site);
    const existingDates = new Set(availabilityList.map((row) => row.date));

    for (let offset = 1; offset <= DEFAULT_AVAILABILITY_DAYS; offset += 1) {
      const date = formatDate(addDays(new Date(), offset));
      if (existingDates.has(date)) continue;

      await base44.entities.Availability.create(availabilityPayload(site, date));
      restoredAvailability += 1;
    }
  }

  return { restoredTreatments, restoredAvailability };
}
