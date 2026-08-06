-- OUR UNIVERSE v4.7.0
-- Love Timeline, Relationship Stats, orbit UI data, dan calendar save repair.
-- Aman dijalankan berulang. Tidak menghapus data lama.

begin;

-- Hubungkan agenda kalender ke Love Timeline tanpa menyalin data.
alter table public.couple_calendar_events
  add column if not exists timeline_enabled boolean not null default false;

update public.couple_calendar_events
set timeline_enabled=true
where event_type='meetup' and countdown_enabled=true;

-- Pastikan instalasi kalender lama tidak menolak payload modern.
do $calendar_legacy_repair$
begin
  if exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='couple_calendar_events' and column_name='event_date'
  ) then
    execute 'alter table public.couple_calendar_events alter column event_date drop not null';
  end if;
  if exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='couple_calendar_events' and column_name='start_time'
  ) then
    execute 'alter table public.couple_calendar_events alter column start_time drop not null';
  end if;
  if exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='couple_calendar_events' and column_name='end_time'
  ) then
    execute 'alter table public.couple_calendar_events alter column end_time drop not null';
  end if;
end
$calendar_legacy_repair$;

alter table public.couple_calendar_events
  drop constraint if exists couple_calendar_events_timeline_v470;
alter table public.couple_calendar_events
  add constraint couple_calendar_events_timeline_v470
  check(timeline_enabled=false or start_at is not null);

create table if not exists public.love_timeline_moments (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  story text,
  moment_at timestamptz not null,
  kind text not null default 'memory',
  emoji text not null default '♡',
  color text not null default 'rose',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint love_timeline_title_v470 check(char_length(trim(title)) between 1 and 140),
  constraint love_timeline_story_v470 check(story is null or char_length(story)<=2400),
  constraint love_timeline_kind_v470 check(kind in ('memory','first','date','promise','milestone','celebration')),
  constraint love_timeline_emoji_v470 check(char_length(emoji) between 1 and 12),
  constraint love_timeline_color_v470 check(color in ('rose','violet','blue','mint','amber'))
);

create index if not exists idx_love_timeline_universe_moment
  on public.love_timeline_moments(universe_id,moment_at desc);
create index if not exists idx_love_timeline_owner_moment
  on public.love_timeline_moments(owner_id,moment_at desc);

create or replace function public.touch_love_timeline_v470()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_touch_love_timeline_v470 on public.love_timeline_moments;
create trigger trg_touch_love_timeline_v470
before update on public.love_timeline_moments
for each row execute function public.touch_love_timeline_v470();

alter table public.love_timeline_moments enable row level security;
alter table public.love_timeline_moments replica identity full;

drop policy if exists "love_timeline_select_member" on public.love_timeline_moments;
create policy "love_timeline_select_member" on public.love_timeline_moments
for select to authenticated
using(public.is_universe_member(universe_id));

drop policy if exists "love_timeline_insert_owner" on public.love_timeline_moments;
create policy "love_timeline_insert_owner" on public.love_timeline_moments
for insert to authenticated
with check(owner_id=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "love_timeline_update_owner" on public.love_timeline_moments;
create policy "love_timeline_update_owner" on public.love_timeline_moments
for update to authenticated
using(owner_id=auth.uid() and public.is_universe_member(universe_id))
with check(owner_id=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "love_timeline_delete_owner" on public.love_timeline_moments;
create policy "love_timeline_delete_owner" on public.love_timeline_moments
for delete to authenticated
using(owner_id=auth.uid() and public.is_universe_member(universe_id));

revoke all on public.love_timeline_moments from anon,authenticated;
grant select,insert,update,delete on public.love_timeline_moments to authenticated;
revoke all on function public.touch_love_timeline_v470() from public,anon;
grant execute on function public.touch_love_timeline_v470() to authenticated;

-- Tanggal hubungan disimpan terpisah agar statistik tidak menebak dari tanggal akun.
create table if not exists public.couple_relationship_profiles (
  universe_id uuid primary key references public.universes(id) on delete cascade,
  started_on date,
  first_met_on date,
  anniversary_title text not null default 'Hari Kita',
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint couple_relationship_title_v470 check(char_length(trim(anniversary_title)) between 1 and 80),
  constraint couple_relationship_date_order_v470 check(first_met_on is null or started_on is null or first_met_on<=started_on)
);

create or replace function public.touch_couple_relationship_profile_v470()
returns trigger
language plpgsql
security invoker
set search_path=public
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

drop trigger if exists trg_touch_couple_relationship_profile_v470 on public.couple_relationship_profiles;
create trigger trg_touch_couple_relationship_profile_v470
before update on public.couple_relationship_profiles
for each row execute function public.touch_couple_relationship_profile_v470();

alter table public.couple_relationship_profiles enable row level security;
alter table public.couple_relationship_profiles replica identity full;

drop policy if exists "couple_relationship_select_member" on public.couple_relationship_profiles;
create policy "couple_relationship_select_member" on public.couple_relationship_profiles
for select to authenticated
using(public.is_universe_member(universe_id));

drop policy if exists "couple_relationship_insert_member" on public.couple_relationship_profiles;
create policy "couple_relationship_insert_member" on public.couple_relationship_profiles
for insert to authenticated
with check(updated_by=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "couple_relationship_update_member" on public.couple_relationship_profiles;
create policy "couple_relationship_update_member" on public.couple_relationship_profiles
for update to authenticated
using(public.is_universe_member(universe_id))
with check(updated_by=auth.uid() and public.is_universe_member(universe_id));

revoke all on public.couple_relationship_profiles from anon,authenticated;
grant select,insert,update on public.couple_relationship_profiles to authenticated;
revoke all on function public.touch_couple_relationship_profile_v470() from public,anon;
grant execute on function public.touch_couple_relationship_profile_v470() to authenticated;

-- Jalur simpan tunggal untuk kalender. Ini menghindari tombol Simpan berhenti
-- pada instalasi lintas versi dan tetap memakai RLS serta auth.uid().
create or replace function public.save_couple_calendar_event_v470(
  p_event_id uuid,
  p_universe_id uuid,
  p_title text,
  p_notes text,
  p_location text,
  p_start_at timestamptz,
  p_end_at timestamptz,
  p_all_day boolean,
  p_color text,
  p_event_type text,
  p_countdown_enabled boolean,
  p_timeline_enabled boolean
)
returns public.couple_calendar_events
language plpgsql
security invoker
set search_path=public
as $$
declare
  saved public.couple_calendar_events;
begin
  if auth.uid() is null then raise exception 'Sesi login tidak ditemukan'; end if;
  if not public.is_universe_member(p_universe_id) then raise exception 'Bukan anggota semesta'; end if;
  if p_title is null or char_length(trim(p_title)) not between 1 and 120 then raise exception 'Judul kegiatan tidak valid'; end if;
  if p_start_at is null then raise exception 'Waktu mulai wajib diisi'; end if;
  if p_end_at is not null and p_end_at<p_start_at then raise exception 'Waktu selesai tidak valid'; end if;
  if p_color not in ('rose','violet','blue','mint','amber') then raise exception 'Warna kegiatan tidak valid'; end if;
  if p_event_type not in ('personal','meetup') then raise exception 'Jenis kegiatan tidak valid'; end if;
  if coalesce(p_countdown_enabled,false) and p_event_type<>'meetup' then raise exception 'Countdown hanya untuk jadwal ketemuan'; end if;

  if p_event_id is null then
    insert into public.couple_calendar_events(
      universe_id,owner_id,title,notes,location,start_at,end_at,all_day,color,event_type,countdown_enabled,timeline_enabled
    ) values(
      p_universe_id,auth.uid(),trim(p_title),nullif(trim(coalesce(p_notes,'')),''),nullif(trim(coalesce(p_location,'')),''),
      p_start_at,p_end_at,coalesce(p_all_day,false),p_color,p_event_type,coalesce(p_countdown_enabled,false),coalesce(p_timeline_enabled,false)
    ) returning * into saved;
  else
    update public.couple_calendar_events
    set title=trim(p_title),
        notes=nullif(trim(coalesce(p_notes,'')),''),
        location=nullif(trim(coalesce(p_location,'')),''),
        start_at=p_start_at,
        end_at=p_end_at,
        all_day=coalesce(p_all_day,false),
        color=p_color,
        event_type=p_event_type,
        countdown_enabled=coalesce(p_countdown_enabled,false),
        timeline_enabled=coalesce(p_timeline_enabled,false)
    where id=p_event_id and universe_id=p_universe_id and owner_id=auth.uid()
    returning * into saved;
  end if;

  if saved.id is null then raise exception 'Kegiatan tidak ditemukan atau bukan milik kamu'; end if;
  return saved;
end;
$$;

revoke all on function public.save_couple_calendar_event_v470(uuid,uuid,text,text,text,timestamptz,timestamptz,boolean,text,text,boolean,boolean) from public,anon;
grant execute on function public.save_couple_calendar_event_v470(uuid,uuid,text,text,text,timestamptz,timestamptz,boolean,text,text,boolean,boolean) to authenticated;

do $$
declare table_name text;
begin
  foreach table_name in array array['love_timeline_moments','couple_relationship_profiles']
  loop
    if not exists(
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I',table_name);
    end if;
  end loop;
end $$;

notify pgrst,'reload schema';

commit;
