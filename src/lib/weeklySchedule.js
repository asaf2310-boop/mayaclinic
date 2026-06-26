import { addDays, format, startOfDay } from "date-fns";

export const ALL_SLOTS = [
  "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30",
  "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30",
];

/** Hebrew weekday letters — Sunday (א) through Saturday (ש), matches JS getDay() 0–6 */
export const DAY_NAMES = ["א", "ב", "ג", "ד", "ה", "ו", "ש"];

export const DAY_NAMES_FULL = [
  "יום ראשון",
  "יום שני",
  "יום שלישי",
  "יום רביעי",
  "יום חמישי",
  "יום שישי",
  "שבת",
];

export const APPLY_DAY_OPTIONS = [
  { value: 30, label: "30 יום" },
  { value: 60, label: "60 יום" },
];

export function createEmptyWeeklyTemplate() {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    day_of_week: dayOfWeek,
    slots: [],
    is_active: false,
  }));
}

function slotsMatchSiteDefaults(slots, site) {
  if (!site?.defaultSlots?.length || !Array.isArray(slots) || !slots.length) return false;
  return [...slots].sort().join(",") === [...site.defaultSlots].sort().join(",");
}

export function normalizeWeeklyRecords(records = [], site = null) {
  const tenantId = site?.id;
  const byDay = {};

  for (const row of records || []) {
    const day = Number(row.day_of_week);
    const existing = byDay[day];
    if (!existing) {
      byDay[day] = row;
      continue;
    }

    if (tenantId) {
      const rowTenant = String(row.tenant_id || "").trim();
      const existingTenant = String(existing.tenant_id || "").trim();
      if (rowTenant === tenantId && existingTenant !== tenantId) {
        byDay[day] = row;
        continue;
      }
      if (rowTenant !== tenantId && existingTenant === tenantId) {
        continue;
      }
    }

    if (site) {
      const rowMatches = slotsMatchSiteDefaults(row.slots, site);
      const existingMatches = slotsMatchSiteDefaults(existing.slots, site);
      if (rowMatches && !existingMatches) {
        byDay[day] = row;
        continue;
      }
      if (!rowMatches && existingMatches) {
        continue;
      }
    }

    if (!row.slots?.length && existing.slots?.length) {
      byDay[day] = row;
    }
  }

  return createEmptyWeeklyTemplate().map((template) => {
    const existing = byDay[template.day_of_week];
    if (!existing) return { ...template };
    return {
      ...template,
      ...existing,
      day_of_week: template.day_of_week,
      slots: Array.isArray(existing.slots) ? [...existing.slots].sort() : [],
      is_active: Boolean(existing.is_active && existing.slots?.length),
    };
  });
}

/**
 * Build availability upserts/deletes for the next `daysAhead` days from `fromDate`.
 * Active template days → upsert slots; inactive → mark for delete if a record exists.
 */
export function planWeeklyAvailabilityApply(weeklyRecords, existingRecords = [], { daysAhead = 30, fromDate = new Date() } = {}) {
  const weeklyByDay = Object.fromEntries(
    normalizeWeeklyRecords(weeklyRecords).map((row) => [row.day_of_week, row])
  );
  const existingByDate = Object.fromEntries(
    (existingRecords || []).filter((row) => row.date).map((row) => [row.date, row])
  );

  const start = startOfDay(fromDate);
  const toUpsert = [];
  const toDelete = [];

  for (let offset = 0; offset < daysAhead; offset += 1) {
    const date = addDays(start, offset);
    const dateStr = format(date, "yyyy-MM-dd");
    const template = weeklyByDay[date.getDay()];
    const existing = existingByDate[dateStr];

    if (template?.is_active && template.slots?.length > 0) {
      toUpsert.push({
        id: existing?.id,
        date: dateStr,
        slots: [...template.slots].sort(),
        is_active: true,
      });
    } else if (existing?.id) {
      toDelete.push(existing.id);
    }
  }

  return { toUpsert, toDelete };
}
