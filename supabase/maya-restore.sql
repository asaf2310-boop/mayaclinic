-- Run in Supabase SQL Editor for Maya production project.
-- Keeps only Maya's treatment and restores availability (tenant: maya).

delete from treatments
where tenant_id = 'maya' and name <> 'מגע שיקומי';

insert into treatments (tenant_id, name, description, duration_minutes, price, icon)
select 'maya', 'מגע שיקומי', 'טיפול מגע שיקומי לפי שיטת מאיה', 60, 320, '🌿'
where not exists (
  select 1 from treatments where tenant_id = 'maya' and name = 'מגע שיקומי'
);

insert into availability (tenant_id, date, slots, is_active)
select 'maya', d::date, array['09:00', '10:30', '12:00', '14:00', '16:00', '17:30']::text[], true
from generate_series(current_date + 1, current_date + 30, interval '1 day') as d
on conflict (tenant_id, date) do update
  set slots = excluded.slots,
      is_active = true;
