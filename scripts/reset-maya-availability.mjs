/**
 * Reset Maya clinic availability in Supabase to default slots.
 * Usage: node scripts/reset-maya-availability.mjs
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or VITE_* / anon key) in .env.local
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const TENANT_ID = "maya";
const DEFAULT_SLOTS = ["09:00", "10:30", "12:00", "14:00", "16:00", "17:30"];
const DAYS_AHEAD = 30;

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

function cleanEnv(value) {
  return String(value || "")
    .split(/\s+/)
    .map((part) => part.trim())
    .find(Boolean) || "";
}

const supabaseUrl = cleanEnv(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
const supabaseKey = cleanEnv(
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY
);
const useTenantFilter = cleanEnv(process.env.VITE_CLINIC_TENANT_ID) === TENANT_ID;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

async function supabaseRequest(path, options = {}) {
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
    Prefer: options.prefer || "return=minimal",
    ...(options.headers || {}),
  };

  if (useTenantFilter) {
    headers["X-Clinic-Tenant-Id"] = TENANT_ID;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed (${response.status})`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function hasTenantColumn(table) {
  try {
    await supabaseRequest(`${table}?select=tenant_id&limit=1`, { prefer: "return=representation" });
    return true;
  } catch (error) {
    if (String(error.message || "").includes("tenant_id")) return false;
    throw error;
  }
}

async function listAll(table, select, order = "date.asc") {
  const rows = [];
  const pageSize = 200;
  let offset = 0;

  while (true) {
    const page =
      (await supabaseRequest(
        `${table}?select=${select}&order=${order}&limit=${pageSize}&offset=${offset}`,
        { prefer: "return=representation" }
      )) || [];
    if (!page.length) break;
    rows.push(...page);
    if (page.length < pageSize) break;
    offset += pageSize;
  }

  return rows;
}

async function resetWeeklySchedule(tenantColumn) {
  const existing = await listAll("weekly_schedule", "id,day_of_week", "day_of_week.asc");
  const clinicRows = tenantColumn
    ? existing.filter((row) => row.tenant_id === TENANT_ID)
    : existing;

  for (const row of clinicRows) {
    if (!row?.id) continue;
    await supabaseRequest(`weekly_schedule?id=eq.${row.id}`, { method: "DELETE" });
  }

  for (let day = 0; day <= 6; day += 1) {
    const payload = { day_of_week: day, slots: [], is_active: false };
    if (tenantColumn) payload.tenant_id = TENANT_ID;
    await supabaseRequest("weekly_schedule", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  }

  return clinicRows.length;
}

async function main() {
  const tenantColumn = await hasTenantColumn("availability");
  const today = new Date();
  const targetDates = [];
  for (let offset = 1; offset <= DAYS_AHEAD; offset += 1) {
    targetDates.push(formatDate(addDays(today, offset)));
  }

  const availabilitySelect = tenantColumn ? "id,date,tenant_id" : "id,date";
  const existing = await listAll("availability", availabilitySelect, "date.asc");
  const clinicRows = tenantColumn
    ? existing.filter((row) => row.tenant_id === TENANT_ID)
    : existing;

  const existingByDate = Object.fromEntries(clinicRows.map((row) => [row.date, row]));
  let updated = 0;
  let created = 0;

  for (const date of targetDates) {
    const payload = {
      date,
      slots: DEFAULT_SLOTS,
      is_active: true,
    };
    if (tenantColumn) payload.tenant_id = TENANT_ID;

    const row = existingByDate[date];
    if (row?.id) {
      await supabaseRequest(`availability?id=eq.${row.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      updated += 1;
    } else {
      await supabaseRequest("availability", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      created += 1;
    }
  }

  const targetSet = new Set(targetDates);
  let removed = 0;
  for (const row of clinicRows) {
    if (!row?.id || targetSet.has(row.date)) continue;
    if (row.date >= formatDate(addDays(today, 1))) {
      await supabaseRequest(`availability?id=eq.${row.id}`, { method: "DELETE" });
      removed += 1;
    }
  }

  const weeklyRemoved = await resetWeeklySchedule(tenantColumn);

  console.log(`Maya availability reset: ${created} created, ${updated} updated, ${removed} removed.`);
  console.log(`Weekly schedule: ${weeklyRemoved} duplicate rows removed, 7-day inactive template created.`);
  console.log(`Slots: ${DEFAULT_SLOTS.join(", ")}`);
  console.log(`Tenant column: ${tenantColumn ? "yes" : "no (legacy single-tenant DB)"}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
