import { supabaseRequest } from "../server/supabaseServer.js";
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
  getPublicOrigin,
  isGoogleAdminAuthConfigured,
} from "../server/googleAdminAuth.js";

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

async function listEntity(entity, query = {}) {
  const order = String(query.order || "-created_at");
  const limit = Math.max(1, Number(query.limit) || 100);
  const offset = Math.max(0, Number(query.offset) || 0);
  const desc = order.startsWith("-");
  const column = desc ? order.slice(1) : order;

  if (entity === "appointments" && query.date) {
    return (
      (await supabaseRequest(
        `appointments?date=eq.${encodeURIComponent(query.date)}&select=*&order=time.asc&limit=${limit}&offset=${offset}`
      )) || []
    );
  }

  if (entity === "patient_profiles" && query.customer_key) {
    return (
      (await supabaseRequest(
        `patient_profiles?customer_key=eq.${encodeURIComponent(query.customer_key)}&select=*&limit=5`
      )) || []
    );
  }

  return (
    (await supabaseRequest(
      `${entity}?select=*&order=${column}.${desc ? "desc" : "asc"}&limit=${limit}&offset=${offset}`
    )) || []
  );
}

async function createEntity(entity, row) {
  const created = await supabaseRequest(entity, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row || {}),
  });
  return Array.isArray(created) ? created[0] : created;
}

async function updateEntity(entity, id, row) {
  const updated = await supabaseRequest(`${entity}?id=eq.${encodeURIComponent(id)}&select=*`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row || {}),
  });
  return Array.isArray(updated) ? updated[0] : updated;
}

async function deleteEntity(entity, id) {
  await supabaseRequest(`${entity}?id=eq.${encodeURIComponent(id)}`, {
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

  try {
    const entity = String(req.query?.entity || "").trim();
    if (!entity) {
      res.status(400).json({ error: "entity required" });
      return;
    }

    if (req.method === "GET" && (action === "list" || action === "filter")) {
      res.status(200).json(await listEntity(entity, req.query || {}));
      return;
    }

    if (req.method === "POST" && action === "create") {
      res.status(200).json(await createEntity(entity, readBody(req).row));
      return;
    }

    if (req.method === "PATCH" && action === "update") {
      const id = String(req.query?.id || "").trim();
      if (!id) {
        res.status(400).json({ error: "id required" });
        return;
      }
      res.status(200).json(await updateEntity(entity, id, readBody(req).row));
      return;
    }

    if (req.method === "DELETE" && action === "delete") {
      const id = String(req.query?.id || "").trim();
      if (!id) {
        res.status(400).json({ error: "id required" });
        return;
      }
      res.status(200).json(await deleteEntity(entity, id));
      return;
    }

    res.status(405).json({ error: "Method not allowed" });
  } catch (error) {
    res.status(500).json({ error: error?.message || "Admin request failed" });
  }
}
