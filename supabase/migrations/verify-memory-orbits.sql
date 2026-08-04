select to_regclass('public.memory_periods') as memory_periods_table;
select column_name,data_type from information_schema.columns where table_schema='public' and table_name='entries' and column_name='period_id';
select policyname from pg_policies where schemaname='public' and tablename='memory_periods' order by policyname;
