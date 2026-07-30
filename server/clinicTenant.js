const MAYA_HOSTS = new Set([
  "maya-clinic.vercel.app",
  "www.maya-clinic.vercel.app",
  "ofirbaby.vercel.app",
  "www.ofirbaby.vercel.app",
  "ofirbaby.com",
  "www.ofirbaby.com",
  "localhost",
  "127.0.0.1",
]);

export function resolveClinicTenantFromHost(req) {
  const host = String(req?.headers?.["x-forwarded-host"] || req?.headers?.host || "")
    .split(",")[0]
    .trim()
    .toLowerCase();

  if (MAYA_HOSTS.has(host)) return "maya";
  return "";
}
