select to_regclass('public.planets') as planets_table,
       to_regclass('public.planet_entries') as planet_entries_table,
       to_regclass('public.stories') as stories_table;
select policyname from pg_policies where schemaname='public' and tablename in ('planets','planet_entries','stories') order by policyname;
select routine_name from information_schema.routines where routine_schema='public' and routine_name='reset_universe_v4';
