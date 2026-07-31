/**
 * Production QA for availability delete/save persistence.
 * Usage: node scripts/qa-availability-persist.mjs
 */
const BASE = process.env.QA_BASE_URL || "https://ofirbaby.vercel.app";
const PASSWORD = process.env.ADMIN_ACCESS_PASSWORD || "06031976";

function assert( cond, message) {
  if (!cond) throw new Error(message);
}

async function api(pathname, { method = "GET", body, cookie } = {}) {
  const response = await fetch(`${BASE}${pathname}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const setCookie = response.headers.getSetCookie?.() || [];
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }
  return { response, data, setCookie };
}

function mergeCookie(existing, setCookieHeaders) {
  const jar = new Map();
  for (const part of String(existing || "")
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean)) {
    const i = part.indexOf("=");
    if (i > 0) jar.set(part.slice(0, i), part.slice(i + 1));
  }
  for (const header of setCookieHeaders || []) {
    const first = header.split(";")[0];
    const i = first.indexOf("=");
    if (i > 0) jar.set(first.slice(0, i), first.slice(i + 1));
  }
  return [...jar.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

function addDaysIso(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  console.log("QA base:", BASE);
  let cookie = "";

  const login = await api("/api/admin?action=login", {
    method: "POST",
    body: { password: PASSWORD },
  });
  assert(login.response.ok, `login failed: ${JSON.stringify(login.data)}`);
  cookie = mergeCookie(cookie, login.setCookie);
  assert(cookie.includes("admin_session"), "missing admin_session cookie");

  const session = await api("/api/admin?action=session", { cookie });
  assert(session.data?.ok === true, "session not ok");
  assert(session.data?.tenantId === "maya", `unexpected tenant ${session.data?.tenantId}`);

  const list1 = await api("/api/admin?action=list&entity=availability&order=date&limit=500", { cookie });
  assert(Array.isArray(list1.data), `list failed: ${JSON.stringify(list1.data)}`);
  assert(list1.data.length > 0, "expected existing availability rows");

  const targetDate = addDaysIso(10);
  let row = list1.data.find((r) => r.date === targetDate);
  const originalSlots = row?.slots?.length
    ? [...row.slots]
    : ["09:00", "10:30", "12:00"];

  // Ensure the day exists with slots
  const upsert = await api("/api/admin?action=create&entity=availability", {
    method: "POST",
    cookie,
    body: { row: { date: targetDate, slots: originalSlots, is_active: true } },
  });
  assert(upsert.response.ok, `upsert failed: ${JSON.stringify(upsert.data)}`);
  row = upsert.data;
  assert(row?.id, "upsert missing id");
  assert(row.slots?.length > 0, "upsert did not keep slots");

  // Soft-clear like the admin delete button
  const clear = await api(
    `/api/admin?action=update&entity=availability&id=${encodeURIComponent(row.id)}`,
    {
      method: "PATCH",
      cookie,
      body: { row: { date: targetDate, slots: [], is_active: false } },
    }
  );
  assert(clear.response.ok, `clear failed: ${JSON.stringify(clear.data)}`);
  assert((clear.data.slots || []).length === 0, "slots not cleared");
  assert(clear.data.is_active === false, "is_active not false");

  // Simulate leaving and returning: new list + public booking feed
  const list2 = await api("/api/admin?action=list&entity=availability&order=date&limit=500", { cookie });
  const after = list2.data.find((r) => r.date === targetDate);
  assert(after, "cleared day row disappeared unexpectedly");
  assert((after.slots || []).length === 0, "cleared day slots came back in admin list");
  assert(after.is_active === false, "cleared day became active again in admin list");

  const pub = await api("/api/public-data?entity=availability");
  assert(Array.isArray(pub.data), `public availability failed: ${JSON.stringify(pub.data)}`);
  const pubRow = pub.data.find((r) => r.date === targetDate);
  const bookable = Boolean(pubRow?.is_active && pubRow?.slots?.length);
  assert(!bookable, "cleared day is still bookable on public feed");

  // Ensure create-on-missing does not revive via upsert of empty? create with defaults should update existing empty row if called — admin bootstrap must NOT call it.
  // Re-check after another list (persistence).
  const list3 = await api("/api/admin?action=list&entity=availability&order=date&limit=500", { cookie });
  const persisted = list3.data.find((r) => r.date === targetDate);
  assert((persisted?.slots || []).length === 0, "slots returned after second reload simulation");

  // Restore the day for the clinic
  const restore = await api(
    `/api/admin?action=update&entity=availability&id=${encodeURIComponent(row.id)}`,
    {
      method: "PATCH",
      cookie,
      body: { row: { date: targetDate, slots: originalSlots, is_active: true } },
    }
  );
  assert(restore.response.ok, `restore failed: ${JSON.stringify(restore.data)}`);
  assert(restore.data.slots?.length > 0, "restore did not write slots");

  console.log("QA PASSED");
  console.log(
    JSON.stringify(
      {
        targetDate,
        adminCount: list3.data.length,
        publicCount: pub.data.length,
        tenant: session.data.tenantId,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error("QA FAILED:", error.message);
  process.exit(1);
});
