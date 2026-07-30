import { supabaseRequest } from "../server/supabaseServer.js";
import { resolveClinicTenantFromHost } from "../server/clinicTenant.js";

const SAFE_SELECT = {
  treatments: "id,name,description,duration_minutes,price,icon,paybox_link,tenant_id,created_at",
  // therapist_ids exists on appointments only — never select it on availability
  availability: "id,date,slots,is_active,tenant_id,created_at",
  appointments: "id,date,time,status,tenant_id,paid,created_at",
};

const LEGACY_SELECT = {
  treatments: "id,name,description,duration_minutes,price,icon,paybox_link,created_at",
  availability: "id,date,slots,is_active,created_at",
  appointments: "id,date,time,status,paid,created_at",
};

function missingColumnFromError(message) {
  const text = String(message || "");
  const match =
    text.match(/column [a-z_]+\.([a-z_0-9]+) does not exist/i) ||
    text.match(/Could not find the '([a-z_0-9]+)' column/i);
  return match?.[1] || null;
}

function stripSelectColumn(path, column) {
  return String(path)
    .replace(new RegExp(`([?&]select=[^&]*?),${column}(?=,|&|$)`), "$1")
    .replace(new RegExp(`([?&]select=)${column},`), "$1")
    .replace(new RegExp(`([?&]select=)${column}(?=&|$)`), "$1id");
}

function stripTenantFilter(path) {
  return String(path)
    .replace(/([?&])tenant_id=eq\.[^&]*&?/, "$1")
    .replace(/[?&]$/, "");
}

async function safeQuery(primaryPath, legacyPath = "") {
  let path = primaryPath;
  const tried = new Set();

  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (tried.has(path)) break;
    tried.add(path);

    try {
      return (await supabaseRequest(path)) || [];
    } catch (error) {
      const message = String(error?.message || "");
      const missing = missingColumnFromError(message);

      if (missing === "tenant_id") {
        path = legacyPath || stripTenantFilter(path);
        continue;
      }

      if (missing) {
        path = stripSelectColumn(path, missing);
        continue;
      }

      throw error;
    }
  }

  return [];
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const entity = String(req.query?.entity || "").trim();
    const tenantId = resolveClinicTenantFromHost(req);
    if (!tenantId) {
      res.status(400).json({ error: "Unknown clinic tenant" });
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(SAFE_SELECT, entity)) {
      res.status(400).json({ error: "Unsupported entity" });
      return;
    }

    if (entity === "treatments") {
      const rows = await safeQuery(
        `treatments?tenant_id=eq.${encodeURIComponent(tenantId)}&select=${SAFE_SELECT.treatments}&order=created_at.desc&limit=200`,
        `treatments?select=${LEGACY_SELECT.treatments}&order=created_at.desc&limit=200`
      );
      res.status(200).json(rows);
      return;
    }

    if (entity === "availability") {
      const rows = await safeQuery(
        `availability?tenant_id=eq.${encodeURIComponent(tenantId)}&select=${SAFE_SELECT.availability}&order=date.asc&limit=1000`,
        `availability?select=${LEGACY_SELECT.availability}&order=date.asc&limit=1000`
      );
      res.status(200).json(rows);
      return;
    }

    const date = String(req.query?.date || "").trim();
    if (date) {
      const rows = await safeQuery(
        `appointments?tenant_id=eq.${encodeURIComponent(tenantId)}&date=eq.${encodeURIComponent(
          date
        )}&select=${SAFE_SELECT.appointments}&order=time.asc&limit=300`,
        `appointments?date=eq.${encodeURIComponent(date)}&select=${LEGACY_SELECT.appointments}&order=time.asc&limit=300`
      );
      res.status(200).json(rows);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const rows = await safeQuery(
      `appointments?tenant_id=eq.${encodeURIComponent(tenantId)}&date=gte.${today}&select=${SAFE_SELECT.appointments}&order=date.asc,time.asc&limit=1000`,
      `appointments?date=gte.${today}&select=${LEGACY_SELECT.appointments}&order=date.asc,time.asc&limit=1000`
    );
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: error?.message || "Failed to load public clinic data" });
  }
}
