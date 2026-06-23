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
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: options.prefer || "return=minimal",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed (${response.status})`);
  }

  if (response.status === 204) return null;
  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

async function main() {
  const today = new Date();
  const targetDates = [];
  for (let offset = 1; offset <= DAYS_AHEAD; offset += 1) {
    targetDates.push(formatDate(addDays(today, offset)));
  }

  const existing =
    (await supabaseRequest(
      `availability?tenant_id=eq.${TENANT_ID}&select=id,date&order=date.asc`,
      { prefer: "return=representation" }
    )) || [];

  const existingByDate = Object.fromEntries(existing.map((row) => [row.date, row]));
  let updated = 0;
  let created = 0;

  for (const date of targetDates) {
    const payload = {
      tenant_id: TENANT_ID,
      date,
      slots: DEFAULT_SLOTS,
      is_active: true,
    };
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
  for (const row of existing) {
    if (!row?.id || targetSet.has(row.date)) continue;
    if (row.date >= formatDate(addDays(today, 1))) {
      await supabaseRequest(`availability?id=eq.${row.id}`, { method: "DELETE" });
      removed += 1;
    }
  }

  console.log(`Maya availability reset: ${created} created, ${updated} updated, ${removed} removed.`);
  console.log(`Slots: ${DEFAULT_SLOTS.join(", ")}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
