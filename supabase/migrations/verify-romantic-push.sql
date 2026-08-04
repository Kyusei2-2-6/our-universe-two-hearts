select to_regclass('public.push_subscriptions') as push_subscriptions_table,
       to_regclass('public.notification_preferences') as notification_preferences_table,
       to_regclass('public.push_delivery_events') as push_delivery_events_table;

select policyname
from pg_policies
where schemaname='public'
  and tablename in ('push_subscriptions','notification_preferences')
order by tablename,policyname;

select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='push_subscriptions'
order by ordinal_position;
