-- Run in Supabase SQL Editor for Maya production project.
-- Restores the main treatment and basic availability.

insert into treatments (name, description, duration_minutes, price, icon)
select 'מגע שיקומי', 'טיפול מגע שיקומי לפי שיטת מאיה', 60, 320, '🌿'
where not exists (
  select 1 from treatments where name = 'מגע שיקומי'
);

insert into availability (date, slots, is_active)
select d::date, array['09:00', '10:30', '12:00', '14:00', '16:00', '17:30']::text[], true
from generate_series(current_date + 1, current_date + 30, interval '1 day') as d
where not exists (
  select 1 from availability a where a.date = d::date
);
