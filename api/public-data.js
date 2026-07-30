import { supabaseRequest } from "../server/supabaseServer.js";
import { resolveClinicTenantFromHost } from "../server/clinicTenant.js";

const SAFE_SELECT = {
  treatments: "id,name,description,duration_minutes,price,icon,paybox_link,tenant_id,created_at",
  availability: "id,date,slots,is_active,tenant_id,therapist_ids,created_at",
  appointments: "id,date,time,status,tenant_id,paid,created_at",
};

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const entity = String(req.query?.entity || "").trim();
    const tenantId = resolveClinicTenantFromHost(req);
    if (!tenantId) {
      res.status(400).json({ error: "Unknown clinic tenant" });
      return;
    }

    if (!Object.prototype.hasOwnProperty.call(SAFE_SELECT, entity)) {
      res.status(400).json({ error: "Unsupported entity" });
      return;
    }

    if (entity === "treatments") {
      const rows =
        (await supabaseRequest(
          `treatments?tenant_id=eq.${encodeURIComponent(tenantId)}&select=${SAFE_SELECT.treatments}&order=created_at.desc&limit=200`
        )) || [];
      res.status(200).json(rows);
      return;
    }

    if (entity === "availability") {
      const rows =
        (await supabaseRequest(
          `availability?tenant_id=eq.${encodeURIComponent(tenantId)}&select=${SAFE_SELECT.availability}&order=date.asc&limit=1000`
        )) || [];
      res.status(200).json(rows);
      return;
    }

    const date = String(req.query?.date || "").trim();
    if (date) {
      const rows =
        (await supabaseRequest(
          `appointments?tenant_id=eq.${encodeURIComponent(tenantId)}&date=eq.${encodeURIComponent(
            date
          )}&select=${SAFE_SELECT.appointments}&order=time.asc&limit=300`
        )) || [];
      res.status(200).json(rows);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const rows =
      (await supabaseRequest(
        `appointments?tenant_id=eq.${encodeURIComponent(tenantId)}&date=gte.${today}&select=${SAFE_SELECT.appointments}&order=date.asc,time.asc&limit=1000`
      )) || [];
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ error: error?.message || "Failed to load public clinic data" });
  }
}
