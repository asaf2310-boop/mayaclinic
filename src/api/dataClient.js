import { bookingFetch, isPublicBookingMount } from "@/lib/bookingMount";
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
  const response = await bookingFetch(url, {
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

  const response = await bookingFetch(`/api/public-data?${params.toString()}`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Failed to load public clinic data");
  }
  return Array.isArray(data) ? data : [];
}

// After the first anonymous 401/403, skip further admin round-trips for public reads.
let skipAdminReadsForPublicTables = false;

function markAdminReadsUnavailable(status) {
  if (status === 401 || status === 403) {
    skipAdminReadsForPublicTables = true;
  }
}

async function requestAdminEntity(action, entity, { id = "", row, filters = {}, order = "", limit = 100, offset = 0 } = {}) {
  const isPublicRead =
    PUBLIC_SERVER_TABLES.has(entity) && (action === "list" || action === "filter");

  if (isPublicRead && skipAdminReadsForPublicTables) {
    const error = new Error("Admin session required");
    error.status = 401;
    throw error;
  }

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

  const response = await bookingFetch(`/api/admin?${params.toString()}`, {
    method:
      action === "create" ? "POST" : action === "update" ? "PATCH" : action === "delete" ? "DELETE" : "GET",
    headers: row ? { "Content-Type": "application/json" } : undefined,
    body: row ? JSON.stringify({ row }) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    markAdminReadsUnavailable(response.status);
    const error = new Error(data?.error || "Admin request failed");
    error.status = response.status;
    throw error;
  }
  return data;
}

function createSupabasePublicEntity(tableName) {
  const preferPublicReads = PUBLIC_SERVER_TABLES.has(tableName);

  return {
    async filter(filters = {}) {
      // Mounted public booking uses public-data. Anonymous clinic booking
      // also skips admin after we know it is locked.
      if (
        (isPublicBookingMount() && preferPublicReads) ||
        (preferPublicReads && skipAdminReadsForPublicTables)
      ) {
        return fetchPublicEntity(tableName, filters);
      }
      try {
        const rows = await requestAdminEntity("filter", tableName, { filters });
        if (Array.isArray(rows)) return rows;
        // Malformed admin payload — try public API for booking tables.
        if (!preferPublicReads) return [];
      } catch (error) {
        // Anonymous booking always falls back to the public API.
        if (!preferPublicReads) throw error;
      }
      return fetchPublicEntity(tableName, filters);
    },

    async list(order = "-created_at", limit = 100, offset = 0) {
      if (
        (isPublicBookingMount() && preferPublicReads) ||
        (preferPublicReads && skipAdminReadsForPublicTables)
      ) {
        return fetchPublicEntity(tableName, {}, order, limit, offset);
      }
      try {
        const rows = await requestAdminEntity("list", tableName, { order, limit, offset });
        if (Array.isArray(rows)) return rows;
        if (!preferPublicReads) return [];
      } catch (error) {
        if (!preferPublicReads) throw error;
      }
      return fetchPublicEntity(tableName, {}, order, limit, offset);
    },

    async listAll(order = "date", pageSize = 200) {
      // /api/public-data returns the tenant window in one shot (no real offset paging).
      if (preferPublicReads) {
        const rows = await this.list(order, Math.max(pageSize, 2000), 0);
        return Array.isArray(rows) ? rows : [];
      }

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
