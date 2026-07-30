-- Retag Holistic appointments/treatments that were incorrectly left as tenant=maya.
-- Run in Supabase SQL Editor after confirming with:
--   select tenant_id, treatment_name, count(*) from appointments group by 1,2 order by 3 desc;

update appointments
set tenant_id = 'holistic'
where tenant_id = 'maya'
  and (
    treatment_name like 'עיסוי תאילנדי%'
    or treatment_name like 'טיפול במגע עם איגנט%'
    or treatment_name like 'טיפול במגע עם עומר%'
    or treatment_name like 'עיסוי 4 ידיים%'
    or treatment_name like 'עיסוי זוגי%'
    or treatment_name ilike '%הוליסט%'
    or treatment_name ilike '%איגנט%'
    or treatment_name ilike '%עומר שלגי%'
  );

update treatments
set tenant_id = 'holistic'
where tenant_id = 'maya'
  and (
    name like 'עיסוי תאילנדי%'
    or name like 'טיפול במגע עם איגנט%'
    or name like 'טיפול במגע עם עומר%'
    or name like 'עיסוי 4 ידיים%'
    or name like 'עיסוי זוגי%'
    or name ilike '%הוליסט%'
    or name ilike '%איגנט%'
    or name ilike '%עומר שלגי%'
  );

-- Quick check (should show maya / holistic separately):
-- select tenant_id, count(*) from appointments group by tenant_id;
-- select tenant_id, count(*) from treatments group by tenant_id;
