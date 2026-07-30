-- Fix legacy availability unique index that ignored tenant_id.
-- The old index (date, location_id) makes Save fail / blocks true multi-tenant rows.
-- Keep the tenant-scoped unique index from multi-tenant.sql instead.

drop index if exists idx_availability_date_location;

create unique index if not exists idx_availability_tenant_date
  on availability(tenant_id, date);
