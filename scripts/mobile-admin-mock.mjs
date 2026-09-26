/**
 * Local mock of /booking/api/admin for Android emulator E2E tests.
 * Does NOT talk to production Supabase. Password: mock-admin-pass
 *
 * Usage: node scripts/mobile-admin-mock.mjs
 * Emulator URL: http://10.0.2.2:8787/api/admin
 */
import http from "node:http";
import crypto from "node:crypto";
import { randomUUID } from "node:crypto";

const PORT = Number(process.env.MOCK_ADMIN_PORT || 8787);
const PASSWORD = process.env.MOCK_ADMIN_PASSWORD || "mock-admin-pass";
const SECRET = process.env.MOCK_ADMIN_SECRET || "mock-admin-session-secret";

function sign(value) {
  return crypto.createHmac("sha256", SECRET).update(value).digest("base64url");
}

function createToken() {
  const payload = JSON.stringify({
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
    email: "mock-admin@ofirbaby.test",
    method: "password",
  });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

function parseToken(value) {
  if (!value || !value.includes(".")) return null;
  const [encoded, signature] = value.split(".", 2);
  const expected = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    if (Number(payload?.exp || 0) <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function getBearer(req) {
  const header = String(req.headers.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? String(match[1] || "").trim() : "";
}

const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, "0");
const dd = String(today.getDate()).padStart(2, "0");
const todayKey = `${yyyy}-${mm}-${dd}`;

const db = {
  appointments: [
    {
      id: randomUUID(),
      patient_name: "נועה בדיקה",
      patient_phone: "0501234567",
      patient_email: "noa@example.com",
      treatment_name: "עיסוי רפואי",
      treatment_price: 350,
      date: todayKey,
      time: "10:00",
      status: "pending",
      paid: false,
      marketing_consent: false,
      notes: "תור לבדיקת אפליקציה",
      created_at: new Date().toISOString(),
    },
    {
      id: randomUUID(),
      patient_name: "דניאל בדיקה",
      patient_phone: "0527654321",
      patient_email: "daniel@example.com",
      treatment_name: "עיסוי הריון",
      treatment_price: 400,
      date: todayKey,
      time: "14:30",
      status: "confirmed",
      paid: true,
      marketing_consent: true,
      notes: "",
      created_at: new Date().toISOString(),
    },
  ],
  treatments: [
    {
      id: randomUUID(),
      name: "עיסוי רפואי",
      description: "טיפול לבדיקה",
      duration_minutes: 60,
      price: 350,
      paybox_link: null,
    },
    {
      id: randomUUID(),
      name: "עיסוי הריון",
      description: "טיפול הריון",
      duration_minutes: 60,
      price: 400,
      paybox_link: null,
    },
  ],
  availability: [
    {
      id: randomUUID(),
      date: todayKey,
      slots: ["09:00", "10:00", "11:00", "14:30", "16:00"],
      is_active: true,
    },
  ],
  gift_vouchers: [
    {
      id: randomUUID(),
      code: "MOCK-GIFT-001",
      purchaser_name: "מיכל",
      purchaser_phone: "0501111111",
      purchaser_email: "michal@example.com",
      recipient_name: "יעל",
      treatments_total: 3,
      treatments_remaining: 2,
      status: "active",
      created_at: new Date().toISOString(),
    },
  ],
  weekly_schedule: [],
  patient_profiles: [],
};

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
  });
}

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  if (req.method === "OPTIONS") {
    send(res, 204, {});
    return;
  }

  if (!url.pathname.endsWith("/api/admin") && url.pathname !== "/api/admin") {
    send(res, 404, { error: "Not found" });
    return;
  }

  const action = String(url.searchParams.get("action") || "").toLowerCase();
  const entity = String(url.searchParams.get("entity") || "").trim();
  const id = String(url.searchParams.get("id") || "").trim();

  if (req.method === "GET" && action === "session") {
    const session = parseToken(getBearer(req));
    send(res, 200, {
      ok: Boolean(session),
      email: session?.email || null,
      method: session?.method || null,
      tenantId: "maya",
      googleConfigured: false,
      passwordConfigured: true,
    });
    return;
  }

  if (req.method === "POST" && action === "login") {
    const body = await readBody(req);
    if (String(body.password || "") !== PASSWORD) {
      send(res, 401, { error: "סיסמת אדמין שגויה" });
      return;
    }
    if (String(body.client || "").toLowerCase() === "mobile") {
      send(res, 200, {
        ok: true,
        token: createToken(),
        method: "password",
        expiresInSec: 60 * 60 * 12,
      });
      return;
    }
    send(res, 200, { ok: true });
    return;
  }

  if (req.method === "DELETE" && action === "session") {
    send(res, 200, { ok: true });
    return;
  }

  if (!parseToken(getBearer(req))) {
    send(res, 401, { error: "Admin session required" });
    return;
  }

  if (!entity || !db[entity]) {
    send(res, 400, { error: "entity required" });
    return;
  }

  if (req.method === "GET" && (action === "list" || action === "filter")) {
    let rows = [...db[entity]];
    const date = url.searchParams.get("date");
    if (date && entity === "appointments") {
      rows = rows.filter((r) => r.date === date);
    }
    send(res, 200, rows);
    return;
  }

  if (req.method === "POST" && action === "create") {
    if (entity === "gift_vouchers") {
      send(res, 405, { error: "Gift vouchers cannot be created manually" });
      return;
    }
    const body = await readBody(req);
    const row = { id: randomUUID(), ...(body.row || {}) };
    db[entity].push(row);
    send(res, 200, row);
    return;
  }

  if (req.method === "PATCH" && action === "update") {
    const body = await readBody(req);
    const idx = db[entity].findIndex((r) => r.id === id);
    if (idx < 0) {
      send(res, 404, { error: "Record not found for this clinic tenant" });
      return;
    }
    db[entity][idx] = { ...db[entity][idx], ...(body.row || {}), id };
    send(res, 200, db[entity][idx]);
    return;
  }

  if (req.method === "DELETE" && action === "delete") {
    const before = db[entity].length;
    db[entity] = db[entity].filter((r) => r.id !== id);
    if (db[entity].length === before) {
      send(res, 404, { error: "not found" });
      return;
    }
    send(res, 200, { ok: true });
    return;
  }

  send(res, 405, { error: "Method not allowed" });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`mobile-admin-mock listening on http://0.0.0.0:${PORT}/api/admin`);
  console.log(`password: ${PASSWORD}`);
  console.log(`emulator base: http://10.0.2.2:${PORT}/api/admin`);
});
