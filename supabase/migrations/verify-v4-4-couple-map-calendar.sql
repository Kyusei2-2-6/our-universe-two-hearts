select table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('couple_locations','couple_calendar_events')
order by table_name;

select schemaname,tablename
from pg_publication_tables
where pubname='supabase_realtime'
  and schemaname='public'
  and tablename in ('couple_locations','couple_calendar_events')
order by tablename;
