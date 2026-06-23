-- Reset Maya tenant availability to default slots (next 30 days).
-- Run in Supabase SQL Editor: https://furrjspvtmyvjikynkfj.supabase.co
-- Does not affect holistic tenant rows.

delete from availability
where tenant_id = 'maya'
  and date > current_date + 30;

insert into availability (tenant_id, date, slots, is_active)
select
  'maya',
  d::date,
  array['09:00', '10:30', '12:00', '14:00', '16:00', '17:30']::text[],
  true
from generate_series(current_date + 1, current_date + 30, interval '1 day') as d
on conflict (tenant_id, date) do update
  set slots = excluded.slots,
      is_active = true;
