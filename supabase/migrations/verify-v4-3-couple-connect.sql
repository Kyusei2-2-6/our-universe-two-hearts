-- OUR UNIVERSE v4.3 · Verifikasi Lightspeed + Couple Connect
select
  to_regclass('public.couple_messages') as couple_messages_table,
  to_regprocedure('public.list_planet_summaries_v43(uuid)') as planet_summary_function,
  exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='couple_messages'
  ) as realtime_enabled,
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='notification_preferences' and column_name='couple_message'
  ) as push_preference_ready;
