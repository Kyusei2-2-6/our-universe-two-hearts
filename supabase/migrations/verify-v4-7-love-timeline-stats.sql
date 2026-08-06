select
  to_regclass('public.love_timeline_moments') is not null as timeline_table_ready,
  to_regclass('public.couple_relationship_profiles') is not null as relationship_profile_ready,
  exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='couple_calendar_events' and column_name='timeline_enabled'
  ) as calendar_timeline_link_ready,
  to_regprocedure('public.save_couple_calendar_event_v470(uuid,uuid,text,text,text,timestamp with time zone,timestamp with time zone,boolean,text,text,boolean,boolean)') is not null as calendar_save_rpc_ready;
