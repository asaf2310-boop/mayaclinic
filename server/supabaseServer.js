function cleanEnv(value) {
  return String(value || "")
    .split(/\s+/)
    .map((part) => part.trim())
    .find(Boolean) || "";
}

export function getSupabaseConfig() {
  const url = cleanEnv(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
  const key = cleanEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY
  );

  if (!url || !key) {
    throw new Error("Supabase is not configured on the server");
  }

  return { url, key };
}

export async function supabaseRequest(path, options = {}) {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
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

export async function fetchRecentAppointmentsByIds(ids = []) {
  if (!ids.length) return [];

  const idList = ids.map((id) => encodeURIComponent(id)).join(",");
  const rows =
    (await supabaseRequest(
      `appointments?id=in.(${idList})&select=id,patient_name,patient_email,patient_phone,treatment_name,treatment_price,date,time,status,created_at`
    )) || [];

  const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
  return rows.filter((row) => {
    const createdAt = row.created_at ? new Date(row.created_at).getTime() : 0;
    return createdAt >= tenMinutesAgo && row.status !== "cancelled";
  });
}

export function getTomorrowDateIso() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));

  return tomorrow.toISOString().slice(0, 10);
}

export async function fetchTomorrowAppointmentsNeedingReminder() {
  const tomorrow = getTomorrowDateIso();
  const rows =
    (await supabaseRequest(
      `appointments?date=eq.${tomorrow}&status=neq.cancelled&patient_email=not.is.null&reminder_sent_at=is.null&select=id,patient_name,patient_email,treatment_name,treatment_price,date,time`
    )) || [];

  return rows.filter((row) => String(row.patient_email || "").trim());
}

export async function markReminderSent(id) {
  await supabaseRequest(`appointments?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ reminder_sent_at: new Date().toISOString() }),
  });
}
