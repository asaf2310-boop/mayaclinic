import { getClinicSite } from "./clinicSite";

export const CLINIC_TENANT_HEADER = "X-Clinic-Tenant-Id";

/**
 * Tenant id for the current deployment / hostname.
 * Prefer VITE_CLINIC_TENANT_ID (set per Vercel project); fallback to clinicSite.id.
 */
export function getClinicTenantId() {
  const fromEnv = String(import.meta.env.VITE_CLINIC_TENANT_ID || "").trim();
  if (fromEnv) return fromEnv;

  const site = getClinicSite();
  if (site?.id) return site.id;

  return "";
}

export function assertClinicTenantId() {
  const tenantId = getClinicTenantId();
  if (!tenantId) {
    throw new Error("Clinic tenant is not configured. Set VITE_CLINIC_TENANT_ID or clinicSite.id.");
  }
  return tenantId;
}
