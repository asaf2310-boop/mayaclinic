import { cleanEnvValue, supabaseAnonKey, supabaseConfigured, supabaseUrl } from "./supabase";
import { CLINIC_TENANT_HEADER, getClinicTenantId } from "@/lib/tenant";

function assertSupabaseConfigured() {
  if (!supabaseConfigured) {
    throw new Error("Supabase is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  }
}

function buildUrl(tableName, filters = {}, params = {}) {
  assertSupabaseConfigured();

  const url = new URL(`${supabaseUrl}/rest/v1/${tableName}`);

  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, `eq.${value}`);
    }
  }

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

function requestHeaders(extra = {}) {
  const key = cleanEnvValue(supabaseAnonKey);
  const tenantId = getClinicTenantId();
  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };

  if (tenantId) {
    headers[CLINIC_TENANT_HEADER] = tenantId;
  }

  return headers;
}

function withTenantId(row = {}) {
  const tenantId = getClinicTenantId();
  if (!tenantId || row.tenant_id) return row;
  return { ...row, tenant_id: tenantId };
}

/** PATCH must not send tenant_id — RLS uses the request header; sending it can break updates. */
function updatePayload(row = {}) {
  const { tenant_id: _ignored, ...fields } = row;
  return fields;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: requestHeaders(options.headers),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed (${response.status})`);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

function createEntity(tableName) {
  return {
    async filter(filters = {}) {
      return (await requestJson(buildUrl(tableName, filters, { select: "*" }))) ?? [];
    },

    async list(order = "-created_at", limit = 100, offset = 0) {
      const orderColumn = String(order || "-created_at");
      const desc = orderColumn.startsWith("-");
      const column = desc ? orderColumn.slice(1) : orderColumn;

      return (await requestJson(buildUrl(tableName, {}, {
        select: "*",
        order: `${column}.${desc ? "desc" : "asc"}`,
        limit,
        offset,
      }))) ?? [];
    },

    async listAll(order = "date", pageSize = 200) {
      const rows = [];
      let offset = 0;

      while (true) {
        const page = await this.list(order, pageSize, offset);
        if (!page.length) break;
        rows.push(...page);
        if (page.length < pageSize) break;
        offset += pageSize;
      }

      return rows;
    },

    async create(row) {
      const data = await requestJson(buildUrl(tableName, {}, { select: "*" }), {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(withTenantId(row)),
      });

      return data?.[0] ?? data;
    },

    async bulkCreate(rows) {
      if (!rows?.length) return [];

      return (await requestJson(buildUrl(tableName, {}, { select: "*" }), {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(rows.map((row) => withTenantId(row))),
      })) ?? [];
    },

    async update(id, row) {
      const data = await requestJson(buildUrl(tableName, { id }, { select: "*" }), {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(updatePayload(row)),
      });

      return data?.[0] ?? data;
    },

    async delete(id) {
      await requestJson(buildUrl(tableName, { id }), {
        method: "DELETE",
      });
    },
  };
}

const ENTITY_TABLES = {
  Treatment: "treatments",
  Appointment: "appointments",
  Availability: "availability",
  PatientProfile: "patient_profiles",
  WeeklySchedule: "weekly_schedule",
};

export function createSupabaseDataClient() {
  const entities = {};

  for (const [name, tableName] of Object.entries(ENTITY_TABLES)) {
    entities[name] = createEntity(tableName);
  }

  return {
    entities,
    auth: {
      me: async () => null,
      logout: () => {},
      redirectToLogin: () => {},
    },
  };
}

export function useSupabaseBackend() {
  return supabaseConfigured;
}
