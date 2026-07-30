import { supabaseRequest } from "../server/supabaseServer.js";
import { resolveClinicTenantFromHost } from "../server/clinicTenant.js";
import {
  clearAdminSessionCookie,
  getAdminAuthOptions,
  getAdminSession,
  hasAdminSession,
  isAdminPasswordValid,
  setAdminSessionCookie,
} from "../server/adminSession.js";
import {
  buildGoogleAuthUrl,
  exchangeGoogleCode,
  getPublicOrigin,
  isAllowedAdminEmail,
  isGoogleAdminAuthConfigured,
  verifyOAuthState,
} from "../server/googleAdminAuth.js";

const TENANT_ENTITIES = new Set([
  "appointments",
  "treatments",
  "availability",
  "patient_profiles",
  "weekly_schedule",
]);

function readBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function redirect(res, location) {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

function requireTenant(req, res) {
  const tenantId = resolveClinicTenantFromHost(req);
  if (!tenantId) {
    res.status(400).json({ error: "Unknown clinic tenant for this host" });
    return null;
  }
  return tenantId;
}

function withTenantFilter(basePath, entity, tenantId, extra = "") {
  const parts = [];
  if (TENANT_ENTITIES.has(entity)) {
    parts.push(`tenant_id=eq.${encodeURIComponent(tenantId)}`);
  }
  if (extra) parts.push(extra);
  const query = parts.join("&");
  return query ? `${basePath}?${query}` : basePath;
}

async function handleGoogleCallback(req, res) {
  const origin = getPublicOrigin(req);
  const errorParam = String(req.query?.error || "").trim();
  if (errorParam) {
    clearAdminSessionCookie(res);
    redirect(res, `${origin}/admin?admin_error=${encodeURIComponent("ההתחברות עם Google בוטלה")}`);
    return;
  }

  const code = String(req.query?.code || "").trim();
  const state = String(req.query?.state || "").trim();
  if (!code || !verifyOAuthState(state)) {
    clearAdminSessionCookie(res);
    redirect(res, `${origin}/admin?admin_error=${encodeURIComponent("בקשת התחברות לא תקינה")}`);
    return;
  }

  try {
    const profile = await exchangeGoogleCode(req, code);
    if (!profile.emailVerified) {
      clearAdminSessionCookie(res);
      redirect(
        res,
        `${origin}/admin?admin_error=${encodeURIComponent("יש לאמת את כתובת ה-Gmail לפני כניסה")}`
      );
      return;
    }

    if (!isAllowedAdminEmail(profile.email)) {
      clearAdminSessionCookie(res);
      redirect(
        res,
        `${origin}/admin?admin_error=${encodeURIComponent("החשבון לא מורשה לניהול הקליניקה")}`
      );
      return;
    }

    setAdminSessionCookie(res, { email: profile.email, method: "google" });
    redirect(res, `${origin}/admin`);
  } catch (error) {
    clearAdminSessionCookie(res);
    redirect(
      res,
      `${origin}/admin?admin_error=${encodeURIComponent(error?.message || "התחברות Google נכשלה")}`
    );
  }
}

async function listEntity(entity, query = {}, tenantId) {
  const order = String(query.order || "-created_at");
  const limit = Math.max(1, Number(query.limit) || 500);
  const offset = Math.max(0, Number(query.offset) || 0);
  const desc = order.startsWith("-");
  const column = desc ? order.slice(1) : order;
  const tenantClause = TENANT_ENTITIES.has(entity)
    ? `tenant_id=eq.${encodeURIComponent(tenantId)}&`
    : "";

  if (entity === "appointments" && query.date) {
    return (
      (await supabaseRequest(
        `appointments?${tenantClause}date=eq.${encodeURIComponent(query.date)}&select=*&order=time.asc&limit=${limit}&offset=${offset}`
      )) || []
    );
  }

  if (entity === "patient_profiles" && query.customer_key) {
    return (
      (await supabaseRequest(
        `patient_profiles?${tenantClause}customer_key=eq.${encodeURIComponent(query.customer_key)}&select=*&limit=5`
      )) || []
    );
  }

  return (
    (await supabaseRequest(
      `${entity}?${tenantClause}select=*&order=${column}.${desc ? "desc" : "asc"}&limit=${limit}&offset=${offset}`
    )) || []
  );
}

async function findTenantRow(entity, tenantId, filters = {}) {
  const parts = [`tenant_id=eq.${encodeURIComponent(tenantId)}`];
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    parts.push(`${key}=eq.${encodeURIComponent(value)}`);
  }
  const rows =
    (await supabaseRequest(`${entity}?${parts.join("&")}&select=*&limit=1`)) || [];
  return Array.isArray(rows) ? rows[0] || null : null;
}

async function createEntity(entity, row, tenantId) {
  const payload = { ...(row || {}) };
  if (TENANT_ENTITIES.has(entity)) {
    payload.tenant_id = tenantId;
  }

  // Availability/weekly unique keys make "create" fail when UI missed an existing row
  // (e.g. truncated lists). Upsert by natural key so Save always persists.
  if (entity === "availability" && payload.date) {
    const existing = await findTenantRow("availability", tenantId, { date: payload.date });
    if (existing?.id) {
      return updateEntity(entity, existing.id, payload, tenantId);
    }
  }

  if (entity === "weekly_schedule" && payload.day_of_week !== undefined && payload.day_of_week !== null) {
    const existing = await findTenantRow("weekly_schedule", tenantId, {
      day_of_week: payload.day_of_week,
    });
    if (existing?.id) {
      return updateEntity(entity, existing.id, payload, tenantId);
    }
  }

  try {
    const created = await supabaseRequest(entity, {
      method: "POST",
      headers: { Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    return Array.isArray(created) ? created[0] : created;
  } catch (error) {
    const message = String(error?.message || "");
    if (!message.includes("23505")) throw error;

    if (entity === "availability" && payload.date) {
      const existing = await findTenantRow("availability", tenantId, { date: payload.date });
      if (existing?.id) return updateEntity(entity, existing.id, payload, tenantId);

      // Legacy unique index is (date, location_id) without tenant — recover same-location row.
      const locationId = payload.location_id || "pardes_hanna";
      const legacyRows =
        (await supabaseRequest(
          `availability?date=eq.${encodeURIComponent(payload.date)}&location_id=eq.${encodeURIComponent(
            locationId
          )}&select=*&limit=5`
        )) || [];
      const ownLegacy = (Array.isArray(legacyRows) ? legacyRows : []).find(
        (row) => String(row?.tenant_id || "") === tenantId || !row?.tenant_id
      );
      if (ownLegacy?.id) {
        return updateEntity(
          entity,
          ownLegacy.id,
          { ...payload, tenant_id: tenantId },
          tenantId
        );
      }
    }
    if (entity === "weekly_schedule" && payload.day_of_week !== undefined) {
      const existing = await findTenantRow("weekly_schedule", tenantId, {
        day_of_week: payload.day_of_week,
      });
      if (existing?.id) return updateEntity(entity, existing.id, payload, tenantId);
    }
    throw error;
  }
}

async function updateEntity(entity, id, row, tenantId) {
  const payload = { ...(row || {}) };
  delete payload.tenant_id;
  delete payload.id;

  const path = withTenantFilter(
    `${entity}`,
    entity,
    tenantId,
    `id=eq.${encodeURIComponent(id)}&select=*`
  );

  const updated = await supabaseRequest(path, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(payload),
  });
  const rowOut = Array.isArray(updated) ? updated[0] : updated;
  if (!rowOut) {
    throw new Error("Record not found for this clinic tenant");
  }
  return rowOut;
}

async function deleteEntity(entity, id, tenantId) {
  const path = withTenantFilter(entity, entity, tenantId, `id=eq.${encodeURIComponent(id)}`);
  await supabaseRequest(path, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" },
  });
  return { ok: true };
}

export default async function handler(req, res) {
  const action = String(req.query?.action || "").trim().toLowerCase();

  if (req.method === "GET" && action === "session") {
    const session = getAdminSession(req);
    res.status(200).json({
      ok: Boolean(session),
      email: session?.email || null,
      method: session?.method || null,
      tenantId: resolveClinicTenantFromHost(req) || null,
      ...getAdminAuthOptions(),
    });
    return;
  }

  if (req.method === "GET" && action === "google-start") {
    const origin = getPublicOrigin(req);
    if (!isGoogleAdminAuthConfigured()) {
      redirect(
        res,
        `${origin}/admin?admin_error=${encodeURIComponent("התחברות Google עדיין לא הוגדרה בשרת")}`
      );
      return;
    }
    try {
      redirect(res, buildGoogleAuthUrl(req));
    } catch (error) {
      redirect(
        res,
        `${origin}/admin?admin_error=${encodeURIComponent(error?.message || "לא ניתן להתחיל התחברות Google")}`
      );
    }
    return;
  }

  if (req.method === "GET" && action === "google-callback") {
    await handleGoogleCallback(req, res);
    return;
  }

  if (req.method === "POST" && action === "login") {
    const body = readBody(req);
    if (!isAdminPasswordValid(body.password)) {
      clearAdminSessionCookie(res);
      res.status(401).json({ error: "סיסמת אדמין שגויה" });
      return;
    }
    setAdminSessionCookie(res, { method: "password" });
    res.status(200).json({ ok: true });
    return;
  }

  if (req.method === "DELETE" && action === "session") {
    clearAdminSessionCookie(res);
    res.status(200).json({ ok: true });
    return;
  }

  if (!hasAdminSession(req)) {
    res.status(401).json({ error: "Admin session required" });
    return;
  }

  const tenantId = requireTenant(req, res);
  if (!tenantId) return;

  try {
    const entity = String(req.query?.entity || "").trim();
    if (!entity) {
      res.status(400).json({ error: "entity required" });
      return;
    }

    if (req.method === "GET" && (action === "list" || action === "filter")) {
      res.status(200).json(await listEntity(entity, req.query || {}, tenantId));
      return;
    }

    if (req.method === "POST" && action === "create") {
      res.status(200).json(await createEntity(entity, readBody(req).row, tenantId));
      return;
    }

    if (req.method === "PATCH" && action === "update") {
      const id = String(req.query?.id || "").trim();
      if (!id) {
        res.status(400).json({ error: "id required" });
        return;
      }
      res.status(200).json(await updateEntity(entity, id, readBody(req).row, tenantId));
      return;
    }

    if (req.method === "DELETE" && action === "delete") {
      const id = String(req.query?.id || "").trim();
      if (!id) {
        res.status(400).json({ error: "id required" });
        return;
      }
      res.status(200).json(await deleteEntity(entity, id, tenantId));
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Admin request failed" });
  }
}
