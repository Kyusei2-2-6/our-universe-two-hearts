select table_name
from information_schema.tables
where table_schema='public'
  and table_name in ('app_config','profiles','universes','universe_members','entries','entry_secrets','attachments','comments','reactions','activity_logs','memory_periods')
order by table_name;

select
  owner_email <> '' as owner_email_ready,
  partner_email <> '' as partner_email_ready,
  lower(owner_email) <> lower(partner_email) as emails_are_distinct
from public.app_config
where singleton=true;

select id,name,public,file_size_limit from storage.buckets where id='universe-files';
select schemaname,tablename,policyname from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname;

select column_name,data_type from information_schema.columns where table_schema='public' and table_name='entries' and column_name='period_id';
