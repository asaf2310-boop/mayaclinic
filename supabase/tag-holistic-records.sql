-- Run AFTER multi-tenant.sql if holistic rows were inserted without tenant_id.
--
-- Run order (Supabase SQL Editor):
--   1. schema.sql
--   2. multi-tenant.sql          (required — adds tenant_id columns)
--   3. tag-holistic-records.sql  (this file — optional re-tagging pass)
--
-- Tags known holistic treatments/appointments; remaining null rows stay maya.

update treatments
set tenant_id = 'holistic'
where tenant_id is null
  and (
    name like 'עיסוי תאילנדי%'
    or name like 'טיפול במגע עם איגנט%'
    or name like 'טיפול במגע עם עומר%'
    or name like 'עיסוי 4 ידיים%'
    or name like 'עיסוי זוגי%'
  );

update appointments
set tenant_id = 'holistic'
where tenant_id is null
  and (
    treatment_name like 'עיסוי תאילנדי%'
    or treatment_name like 'טיפול במגע עם איגנט%'
    or treatment_name like 'טיפול במגע עם עומר%'
    or treatment_name like 'עיסוי 4 ידיים%'
    or treatment_name like 'עיסוי זוגי%'
  );

update treatments set tenant_id = 'maya' where tenant_id is null;
update appointments set tenant_id = 'maya' where tenant_id is null;
update availability set tenant_id = 'maya' where tenant_id is null;
update weekly_schedule set tenant_id = 'maya' where tenant_id is null;

-- patient_profiles is optional; skip if table or tenant_id column is missing
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'patient_profiles'
      and column_name = 'tenant_id'
  ) then
    update patient_profiles set tenant_id = 'maya' where tenant_id is null;
  end if;
end $$;
