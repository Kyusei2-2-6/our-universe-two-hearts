select routine_name
from information_schema.routines
where routine_schema='public'
  and routine_name in ('create_planet_v412','update_planet_v412','can_manage_planet_storage_object')
order by routine_name;

select policyname
from pg_policies
where schemaname='storage'
  and tablename='objects'
  and policyname in ('storage_select_shared_or_unlocked','storage_insert_member')
order by policyname;
