import { cleanEnvValue, supabaseAnonKey, supabaseConfigured, supabaseUrl } from "./supabase";
import { getClinicTenantId } from "@/lib/tenant";
import {
  firstRepresentationRow,
  missingColumnFromPostgrestError,
  omitRowKeys,
  stripTenantIdFromUpdate,
} from "@/lib/supabaseWriteHelpers";

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

async function postRow(tableName, row) {
  let payload = withTenantId(row);

  while (true) {
    try {
      const data = await requestJson(buildUrl(tableName, {}, { select: "*" }), {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });
      return firstRepresentationRow(data);
    } catch (error) {
      const missingColumn = missingColumnFromPostgrestError(error.message);
      if (missingColumn && Object.prototype.hasOwnProperty.call(payload, missingColumn)) {
        payload = omitRowKeys(payload, [missingColumn]);
        continue;
      }
      throw error;
    }
  }
}

async function patchRow(tableName, id, row) {
  let payload = stripTenantIdFromUpdate(row);

  while (true) {
    try {
      const data = await requestJson(buildUrl(tableName, { id }, { select: "*" }), {
        method: "PATCH",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify(payload),
      });

      const updated = firstRepresentationRow(data);
      if (!updated) {
        throw new Error(
          JSON.stringify({
            code: "treatment_update_blocked",
            message:
              "Update returned no rows — check tenant_id on the treatment and VITE_CLINIC_TENANT_ID / X-Clinic-Tenant-Id header.",
          })
        );
      }

      return updated;
    } catch (error) {
      const missingColumn = missingColumnFromPostgrestError(error.message);
      if (missingColumn === "tenant_id" && Object.prototype.hasOwnProperty.call(payload, "tenant_id")) {
        payload = omitRowKeys(payload, ["tenant_id"]);
        continue;
      }
      throw error;
    }
  }
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
      return postRow(tableName, row);
    },

    async bulkCreate(rows) {
      if (!rows?.length) return [];

      const created = [];
      for (const row of rows) {
        created.push(await postRow(tableName, row));
      }
      return created;
    },

    async update(id, row) {
      return patchRow(tableName, id, row);
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

const PUBLIC_SERVER_TABLES = new Set(["treatments", "appointments", "availability"]);

async function fetchPublicEntity(tableName, filters = {}, order = "", limit = 100, offset = 0) {
  const params = new URLSearchParams({
    entity: tableName,
    limit: String(limit),
    offset: String(offset),
  });
  if (filters?.date) {
    params.set("date", String(filters.date));
  }
  if (order) {
    params.set("order", String(order));
  }

  const response = await fetch(`/api/public-data?${params.toString()}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Failed to load public clinic data");
  }
  return Array.isArray(data) ? data : [];
}

async function requestAdminEntity(action, entity, { id = "", row, filters = {}, order = "", limit = 100, offset = 0 } = {}) {
  const params = new URLSearchParams({
    action,
    entity,
  });
  if (id) params.set("id", id);
  if (filters?.date) params.set("date", String(filters.date));
  if (filters?.customer_key) params.set("customer_key", String(filters.customer_key));
  if (order) params.set("order", String(order));
  params.set("limit", String(limit));
  params.set("offset", String(offset));

  const response = await fetch(`/api/admin?${params.toString()}`, {
    method:
      action === "create" ? "POST" : action === "update" ? "PATCH" : action === "delete" ? "DELETE" : "GET",
    headers: row ? { "Content-Type": "application/json" } : undefined,
    body: row ? JSON.stringify({ row }) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || "Admin request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

function createSupabasePublicEntity(tableName) {
  return {
    async filter(filters = {}) {
      try {
        return await requestAdminEntity("filter", tableName, { filters });
      } catch (error) {
        if (!PUBLIC_SERVER_TABLES.has(tableName) || ![401, 403].includes(error.status)) {
          throw error;
        }
      }
      return fetchPublicEntity(tableName, filters);
    },

    async list(order = "-created_at", limit = 100, offset = 0) {
      try {
        return await requestAdminEntity("list", tableName, { order, limit, offset });
      } catch (error) {
        if (!PUBLIC_SERVER_TABLES.has(tableName) || ![401, 403].includes(error.status)) {
          throw error;
        }
      }
      return fetchPublicEntity(tableName, {}, order, limit, offset);
    },

    async listAll(order = "date", pageSize = 200) {
      const rows = [];
      let offset = 0;

      while (true) {
        const page = await this.list(order, pageSize, offset);
        if (!Array.isArray(page) || page.length === 0) break;
        rows.push(...page);
        if (page.length < pageSize) break;
        offset += pageSize;
        if (offset > 5000) break;
      }

      return rows;
    },

    async create(row) {
      return requestAdminEntity("create", tableName, { row });
    },

    async bulkCreate(rows) {
      if (!rows?.length) return [];
      const created = [];
      for (const row of rows) {
        created.push(await requestAdminEntity("create", tableName, { row }));
      }
      return created;
    },

    async update(id, row) {
      return requestAdminEntity("update", tableName, { id, row });
    },

    async delete(id) {
      return requestAdminEntity("delete", tableName, { id });
    },
  };
}

export function createSupabaseDataClient() {
  const entities = {};

  for (const [name, tableName] of Object.entries(ENTITY_TABLES)) {
    entities[name] = createSupabasePublicEntity(tableName);
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
