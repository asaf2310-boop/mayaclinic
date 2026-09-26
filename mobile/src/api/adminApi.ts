import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra || {}) as {
  bookingApiBase?: string;
  websiteAdminUrl?: string;
};

export const BOOKING_API_BASE =
  extra.bookingApiBase || "https://www.ofirbaby.com/booking/api/admin";

export const WEBSITE_ADMIN_URL =
  extra.websiteAdminUrl || "https://www.ofirbaby.com/admin";

export type Appointment = {
  id: string;
  patient_name: string;
  patient_phone: string;
  patient_email?: string | null;
  treatment_id?: string | null;
  treatment_name: string;
  treatment_price?: number | null;
  date: string;
  time: string;
  status: string;
  paid: boolean;
  marketing_consent?: boolean;
  notes?: string | null;
  created_at?: string;
};

export type Treatment = {
  id: string;
  name: string;
  description?: string | null;
  duration_minutes: number;
  price: number;
  paybox_link?: string | null;
  icon?: string | null;
};

export type Availability = {
  id: string;
  date: string;
  slots: string[];
  is_active: boolean;
};

export type WeeklySchedule = {
  id: string;
  day_of_week: number;
  slots: string[];
  is_active: boolean;
};

export type PatientProfile = {
  id: string;
  customer_key: string;
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
};

export type GiftVoucher = {
  id: string;
  code: string;
  purchaser_name?: string;
  purchaser_phone?: string;
  purchaser_email?: string;
  recipient_name?: string;
  recipient_email?: string;
  treatments_total?: number;
  treatments_remaining?: number;
  status?: string;
  amount?: number;
  created_at?: string;
};

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
  query?: Record<string, string | number | undefined | null>;
};

function buildUrl(query: RequestOptions["query"] = {}) {
  const url = new URL(BOOKING_API_BASE);
  for (const [key, value] of Object.entries(query || {})) {
    if (value === undefined || value === null || value === "") continue;
    url.searchParams.set(key, String(value));
  }
  return url.toString();
}

export async function adminRequest<T = unknown>(
  action: string,
  { method = "GET", token, body, query = {} }: RequestOptions = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(buildUrl({ ...query, action }), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text || "Invalid response" };
  }

  if (!response.ok) {
    throw new ApiError(data?.error || `Request failed (${response.status})`, response.status);
  }
  return data as T;
}

export async function loginWithPassword(password: string) {
  return adminRequest<{
    ok: boolean;
    token: string;
    method?: string;
    expiresInSec?: number;
  }>("login", {
    method: "POST",
    body: { password, client: "mobile" },
  });
}

export async function fetchSession(token: string) {
  return adminRequest<{
    ok: boolean;
    email?: string | null;
    method?: string | null;
    tenantId?: string | null;
    googleConfigured?: boolean;
    passwordConfigured?: boolean;
  }>("session", { token });
}

export async function listEntity<T>(
  token: string,
  entity: string,
  opts: { order?: string; limit?: number; date?: string; customer_key?: string } = {}
) {
  return adminRequest<T[]>("list", {
    token,
    query: {
      entity,
      order: opts.order || "-created_at",
      limit: opts.limit ?? 500,
      date: opts.date,
      customer_key: opts.customer_key,
    },
  });
}

export async function createEntity<T>(token: string, entity: string, row: Record<string, unknown>) {
  return adminRequest<T>("create", {
    method: "POST",
    token,
    query: { entity },
    body: { row },
  });
}

export async function updateEntity<T>(
  token: string,
  entity: string,
  id: string,
  row: Record<string, unknown>
) {
  return adminRequest<T>("update", {
    method: "PATCH",
    token,
    query: { entity, id },
    body: { row },
  });
}

export async function deleteEntity(token: string, entity: string, id: string) {
  return adminRequest<{ ok: boolean }>("delete", {
    method: "DELETE",
    token,
    query: { entity, id },
  });
}
