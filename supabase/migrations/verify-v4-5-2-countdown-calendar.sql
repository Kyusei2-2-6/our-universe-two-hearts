-- Verifikasi OUR UNIVERSE v4.5.2
select
  to_regclass('public.couple_calendar_events') as calendar_table,
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='couple_calendar_events' and column_name='start_at'
  ) as has_start_at,
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='couple_calendar_events' and column_name='event_type'
  ) as has_event_type,
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='couple_calendar_events' and column_name='countdown_enabled'
  ) as has_countdown,
  coalesce((
    select rowsecurity from pg_tables
    where schemaname='public' and tablename='couple_calendar_events'
  ),false) as rls_enabled,
  exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='couple_calendar_events'
  ) as realtime_enabled;
