-- Run AFTER multi-tenant.sql if holistic rows were inserted without tenant_id.
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
update patient_profiles set tenant_id = 'maya' where tenant_id is null;
update weekly_schedule set tenant_id = 'maya' where tenant_id is null;
