-- OUR UNIVERSE v4.9.3 ALL-IN-ONE DATABASE REPAIR
-- Jalankan seluruh file ini di Supabase SQL Editor.
-- Aman dijalankan ulang. Tidak menghapus akun, universe, kenangan, lampiran, planet, story, atau data lama.
-- Mencakup Our Bond, kalender repair, Love Timeline, Relationship Journey, dan Cosmic Identity.


-- ============================================================
-- SOURCE: supabase/migrations/2026-08-06-v4-5-our-bond.sql
-- ============================================================
-- OUR UNIVERSE v4.5.0 · OUR BOND
-- Heartbeat Presence, Memory Replay, Love Cinema, dan Secret Room.
-- Aman dijalankan berulang. Tidak menghapus data lama.

begin;

create table if not exists public.bond_pulses (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  pulse_type text not null default 'heartbeat'
    check (pulse_type in ('heartbeat','hug','kiss','support')),
  intensity smallint not null default 3 check (intensity between 1 and 5),
  note text check (note is null or char_length(note) <= 180),
  created_at timestamptz not null default now(),
  constraint bond_pulses_distinct_people check (sender_id <> recipient_id)
);

create index if not exists idx_bond_pulses_universe_created
  on public.bond_pulses(universe_id,created_at desc);
create index if not exists idx_bond_pulses_recipient_created
  on public.bond_pulses(recipient_id,created_at desc);

alter table public.bond_pulses enable row level security;
alter table public.bond_pulses replica identity full;

drop policy if exists "bond_pulses_select_member" on public.bond_pulses;
create policy "bond_pulses_select_member" on public.bond_pulses
for select to authenticated
using(public.is_universe_member(universe_id));

drop policy if exists "bond_pulses_insert_sender" on public.bond_pulses;
create policy "bond_pulses_insert_sender" on public.bond_pulses
for insert to authenticated
with check(
  sender_id=auth.uid()
  and sender_id<>recipient_id
  and public.is_universe_member(universe_id)
  and exists(
    select 1 from public.universe_members member
    where member.universe_id=bond_pulses.universe_id
      and member.user_id=bond_pulses.recipient_id
  )
);

drop policy if exists "bond_pulses_delete_sender" on public.bond_pulses;
create policy "bond_pulses_delete_sender" on public.bond_pulses
for delete to authenticated
using(sender_id=auth.uid() and public.is_universe_member(universe_id));

revoke all on public.bond_pulses from anon,authenticated;
grant select,insert,delete on public.bond_pulses to authenticated;

create table if not exists public.bond_emotions (
  universe_id uuid not null references public.universes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  mood text not null default 'loved'
    check (mood in ('loved','calm','missing','excited','tired','sad')),
  note text check (note is null or char_length(note) <= 180),
  intensity smallint not null default 3 check (intensity between 1 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(universe_id,user_id)
);

create index if not exists idx_bond_emotions_universe_updated
  on public.bond_emotions(universe_id,updated_at desc);

create or replace function public.touch_bond_emotion_v45()
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

drop trigger if exists trg_touch_bond_emotion_v45 on public.bond_emotions;
create trigger trg_touch_bond_emotion_v45
before update on public.bond_emotions
for each row execute function public.touch_bond_emotion_v45();

alter table public.bond_emotions enable row level security;
alter table public.bond_emotions replica identity full;

drop policy if exists "bond_emotions_select_member" on public.bond_emotions;
create policy "bond_emotions_select_member" on public.bond_emotions
for select to authenticated
using(public.is_universe_member(universe_id));

drop policy if exists "bond_emotions_insert_self" on public.bond_emotions;
create policy "bond_emotions_insert_self" on public.bond_emotions
for insert to authenticated
with check(user_id=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "bond_emotions_update_self" on public.bond_emotions;
create policy "bond_emotions_update_self" on public.bond_emotions
for update to authenticated
using(user_id=auth.uid() and public.is_universe_member(universe_id))
with check(user_id=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "bond_emotions_delete_self" on public.bond_emotions;
create policy "bond_emotions_delete_self" on public.bond_emotions
for delete to authenticated
using(user_id=auth.uid() and public.is_universe_member(universe_id));

revoke all on public.bond_emotions from anon,authenticated;
grant select,insert,update,delete on public.bond_emotions to authenticated;

create table if not exists public.bond_replays (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  entry_id uuid references public.entries(id) on delete set null,
  started_by uuid not null references public.profiles(id) on delete cascade,
  mode text not null default 'surprise' check (mode in ('surprise','cinema')),
  reaction text check (reaction is null or reaction in ('smile','miss','grateful')),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_bond_replays_universe_created
  on public.bond_replays(universe_id,created_at desc);
create index if not exists idx_bond_replays_entry
  on public.bond_replays(entry_id,created_at desc);

alter table public.bond_replays enable row level security;
alter table public.bond_replays replica identity full;

drop policy if exists "bond_replays_select_member" on public.bond_replays;
create policy "bond_replays_select_member" on public.bond_replays
for select to authenticated
using(public.is_universe_member(universe_id));

drop policy if exists "bond_replays_insert_self" on public.bond_replays;
create policy "bond_replays_insert_self" on public.bond_replays
for insert to authenticated
with check(
  started_by=auth.uid()
  and public.is_universe_member(universe_id)
  and (
    entry_id is null
    or exists(
      select 1 from public.entries entry
      where entry.id=bond_replays.entry_id
        and entry.universe_id=bond_replays.universe_id
    )
  )
);

drop policy if exists "bond_replays_update_self" on public.bond_replays;
create policy "bond_replays_update_self" on public.bond_replays
for update to authenticated
using(started_by=auth.uid() and public.is_universe_member(universe_id))
with check(started_by=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "bond_replays_delete_self" on public.bond_replays;
create policy "bond_replays_delete_self" on public.bond_replays
for delete to authenticated
using(started_by=auth.uid() and public.is_universe_member(universe_id));

revoke all on public.bond_replays from anon,authenticated;
grant select,insert,delete on public.bond_replays to authenticated;
grant update(reaction,completed_at) on public.bond_replays to authenticated;

create table if not exists public.bond_capsules (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  hint text check (hint is null or char_length(hint) <= 180),
  unlock_at timestamptz not null,
  password_protected boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_bond_capsules_universe_unlock
  on public.bond_capsules(universe_id,unlock_at,created_at desc);

alter table public.bond_capsules enable row level security;
alter table public.bond_capsules replica identity full;

drop policy if exists "bond_capsules_select_member" on public.bond_capsules;
create policy "bond_capsules_select_member" on public.bond_capsules
for select to authenticated
using(public.is_universe_member(universe_id));

drop policy if exists "bond_capsules_insert_creator" on public.bond_capsules;
create policy "bond_capsules_insert_creator" on public.bond_capsules
for insert to authenticated
with check(
  created_by=auth.uid()
  and public.is_universe_member(universe_id)
  and unlock_at>now()
);

drop policy if exists "bond_capsules_delete_creator" on public.bond_capsules;
create policy "bond_capsules_delete_creator" on public.bond_capsules
for delete to authenticated
using(created_by=auth.uid() and public.is_universe_member(universe_id));

revoke all on public.bond_capsules from anon,authenticated;
grant select,insert,delete on public.bond_capsules to authenticated;

create table if not exists public.bond_capsule_secrets (
  capsule_id uuid primary key references public.bond_capsules(id) on delete cascade,
  universe_id uuid not null references public.universes(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete cascade,
  payload jsonb,
  encrypted_payload jsonb,
  password_protected boolean not null default false,
  created_at timestamptz not null default now(),
  constraint bond_capsule_secret_payload_valid check (
    (password_protected=false and payload is not null and encrypted_payload is null)
    or
    (password_protected=true and payload is null and encrypted_payload is not null)
  )
);

alter table public.bond_capsule_secrets enable row level security;

drop policy if exists "bond_capsule_secrets_select_after_unlock" on public.bond_capsule_secrets;
create policy "bond_capsule_secrets_select_after_unlock" on public.bond_capsule_secrets
for select to authenticated
using(
  public.is_universe_member(universe_id)
  and exists(
    select 1 from public.bond_capsules capsule
    where capsule.id=bond_capsule_secrets.capsule_id
      and capsule.universe_id=bond_capsule_secrets.universe_id
      and capsule.unlock_at<=now()
  )
);

drop policy if exists "bond_capsule_secrets_insert_creator" on public.bond_capsule_secrets;
create policy "bond_capsule_secrets_insert_creator" on public.bond_capsule_secrets
for insert to authenticated
with check(
  created_by=auth.uid()
  and public.is_universe_member(universe_id)
  and exists(
    select 1 from public.bond_capsules capsule
    where capsule.id=bond_capsule_secrets.capsule_id
      and capsule.universe_id=bond_capsule_secrets.universe_id
      and capsule.created_by=auth.uid()
      and capsule.password_protected=bond_capsule_secrets.password_protected
  )
);

revoke all on public.bond_capsule_secrets from anon,authenticated;
grant select,insert on public.bond_capsule_secrets to authenticated;

-- Realtime hanya untuk metadata kolaboratif. Isi kapsul rahasia tidak dipublikasikan.
do $$
declare
  table_name text;
begin
  foreach table_name in array array['bond_pulses','bond_emotions','bond_replays','bond_capsules']
  loop
    if not exists(
      select 1 from pg_publication_tables
      where pubname='supabase_realtime'
        and schemaname='public'
        and tablename=table_name
    ) then
      execute format('alter publication supabase_realtime add table public.%I',table_name);
    end if;
  end loop;
end $$;

commit;

-- ============================================================
-- SOURCE: supabase/migrations/2026-08-06-v4-5-2-countdown-calendar-repair.sql
-- ============================================================
-- OUR UNIVERSE v4.5.2
-- Repair kalender lintas versi + Meeting Countdown
-- Aman dijalankan berulang dan tidak menghapus agenda lama.

begin;

create table if not exists public.couple_calendar_events (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  notes text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  color text not null default 'rose',
  event_type text not null default 'personal',
  countdown_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Kolom modern yang dibutuhkan UI. ADD COLUMN IF NOT EXISTS juga memperbaiki
-- instalasi lama yang masih memakai event_date/start_time/end_time.
alter table public.couple_calendar_events
  add column if not exists notes text,
  add column if not exists location text,
  add column if not exists start_at timestamptz,
  add column if not exists end_at timestamptz,
  add column if not exists all_day boolean not null default false,
  add column if not exists color text not null default 'rose',
  add column if not exists event_type text not null default 'personal',
  add column if not exists countdown_enabled boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Migrasikan data dari skema kalender v4.4.0 bila kolom lama masih ada.
do $repair_old_calendar$
declare
  has_event_date boolean;
  has_start_time boolean;
  has_end_time boolean;
begin
  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='couple_calendar_events' and column_name='event_date'
  ) into has_event_date;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='couple_calendar_events' and column_name='start_time'
  ) into has_start_time;

  select exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='couple_calendar_events' and column_name='end_time'
  ) into has_end_time;

  if has_event_date and has_start_time then
    execute $sql$
      update public.couple_calendar_events
      set start_at=coalesce(
        start_at,
        event_date::timestamp +
          case when all_day then time '00:00'
               else coalesce(start_time,time '09:00') end
      )
      where start_at is null
    $sql$;
  elsif has_event_date then
    execute $sql$
      update public.couple_calendar_events
      set start_at=coalesce(
        start_at,
        event_date::timestamp + case when all_day then time '00:00' else time '09:00' end
      )
      where start_at is null
    $sql$;
  end if;

  if has_event_date and has_end_time then
    execute $sql$
      update public.couple_calendar_events
      set end_at=coalesce(
        end_at,
        case
          when all_day then event_date::timestamp + time '23:59:59'
          when end_time is not null then event_date::timestamp + end_time
          else null
        end
      )
      where end_at is null
    $sql$;
  elsif has_event_date then
    execute $sql$
      update public.couple_calendar_events
      set end_at=coalesce(
        end_at,
        case when all_day then event_date::timestamp + time '23:59:59' else null end
      )
      where end_at is null
    $sql$;
  end if;

  if has_event_date then
    execute 'alter table public.couple_calendar_events alter column event_date drop not null';
  end if;
end
$repair_old_calendar$;

-- Baris yang sangat lama atau tidak lengkap tetap dipertahankan.
update public.couple_calendar_events
set start_at=coalesce(start_at,created_at,now())
where start_at is null;

update public.couple_calendar_events
set color='rose'
where color is null or color not in ('rose','violet','blue','mint','amber');

update public.couple_calendar_events
set event_type='personal'
where event_type is null or event_type not in ('personal','meetup');

update public.couple_calendar_events
set countdown_enabled=false
where countdown_enabled is null;

update public.couple_calendar_events
set event_type='meetup'
where countdown_enabled=true;

alter table public.couple_calendar_events
  alter column start_at set not null,
  alter column all_day set default false,
  alter column all_day set not null,
  alter column color set default 'rose',
  alter column color set not null,
  alter column event_type set default 'personal',
  alter column event_type set not null,
  alter column countdown_enabled set default false,
  alter column countdown_enabled set not null,
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column updated_at set default now(),
  alter column updated_at set not null;

-- Hapus constraint waktu dari skema lama karena masih mewajibkan start_time.
alter table public.couple_calendar_events
  drop constraint if exists couple_calendar_time_valid,
  drop constraint if exists couple_calendar_events_time_valid,
  drop constraint if exists couple_calendar_events_time_valid_v452,
  drop constraint if exists couple_calendar_events_title_check,
  drop constraint if exists couple_calendar_events_notes_check,
  drop constraint if exists couple_calendar_events_title_length_v452,
  drop constraint if exists couple_calendar_events_notes_length_v452,
  drop constraint if exists couple_calendar_events_color_v452,
  drop constraint if exists couple_calendar_events_type_v452,
  drop constraint if exists couple_calendar_events_countdown_v452;

alter table public.couple_calendar_events
  add constraint couple_calendar_events_time_valid_v452
    check(end_at is null or end_at>=start_at),
  add constraint couple_calendar_events_title_length_v452
    check(char_length(trim(title)) between 1 and 120),
  add constraint couple_calendar_events_notes_length_v452
    check(notes is null or char_length(notes)<=1500),
  add constraint couple_calendar_events_color_v452
    check(color in ('rose','violet','blue','mint','amber')),
  add constraint couple_calendar_events_type_v452
    check(event_type in ('personal','meetup')),
  add constraint couple_calendar_events_countdown_v452
    check(countdown_enabled=false or event_type='meetup');

create index if not exists idx_couple_calendar_events_universe_start
  on public.couple_calendar_events(universe_id,start_at);
create index if not exists idx_couple_calendar_events_owner_start
  on public.couple_calendar_events(owner_id,start_at);
create index if not exists idx_couple_calendar_events_next_meeting
  on public.couple_calendar_events(universe_id,start_at)
  where event_type='meetup' and countdown_enabled=true;

create or replace function public.touch_couple_calendar_event_v452()
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

drop trigger if exists trg_touch_couple_calendar_event_v441 on public.couple_calendar_events;
drop trigger if exists trg_couple_calendar_updated_at_v44 on public.couple_calendar_events;
drop trigger if exists trg_touch_couple_calendar_event_v452 on public.couple_calendar_events;
create trigger trg_touch_couple_calendar_event_v452
before update on public.couple_calendar_events
for each row execute function public.touch_couple_calendar_event_v452();

alter table public.couple_calendar_events enable row level security;
alter table public.couple_calendar_events replica identity full;

drop policy if exists "couple_calendar_select_member" on public.couple_calendar_events;
create policy "couple_calendar_select_member" on public.couple_calendar_events
for select to authenticated
using(public.is_universe_member(universe_id));

drop policy if exists "couple_calendar_insert_owner" on public.couple_calendar_events;
create policy "couple_calendar_insert_owner" on public.couple_calendar_events
for insert to authenticated
with check(owner_id=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "couple_calendar_update_owner" on public.couple_calendar_events;
create policy "couple_calendar_update_owner" on public.couple_calendar_events
for update to authenticated
using(owner_id=auth.uid() and public.is_universe_member(universe_id))
with check(owner_id=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "couple_calendar_delete_owner" on public.couple_calendar_events;
create policy "couple_calendar_delete_owner" on public.couple_calendar_events
for delete to authenticated
using(owner_id=auth.uid() and public.is_universe_member(universe_id));

revoke all on public.couple_calendar_events from anon,authenticated;
grant select,insert,update,delete on public.couple_calendar_events to authenticated;

revoke all on function public.touch_couple_calendar_event_v452() from public,anon;
grant execute on function public.touch_couple_calendar_event_v452() to authenticated;

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='couple_calendar_events'
  ) then
    alter publication supabase_realtime add table public.couple_calendar_events;
  end if;
end $$;

notify pgrst,'reload schema';

commit;

-- ============================================================
-- SOURCE: supabase/migrations/2026-08-06-v4-7-love-timeline-stats.sql
-- ============================================================
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

-- ============================================================
-- SOURCE: RUN-THIS-IN-SUPABASE-V4.9.2-RESCUE.sql
-- ============================================================
-- OUR UNIVERSE v4.9.2 RESCUE MIGRATION
-- Aman dijalankan berulang kali. Tidak menghapus tabel, baris, kenangan, file, atau fitur lama.

begin;

-- 1. Cosmic Identity. Tambahkan hanya kolom yang belum tersedia.
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists hometown text;
alter table public.profiles add column if not exists love_language text;
alter table public.profiles add column if not exists favorite_things text;
alter table public.profiles add column if not exists personal_quote text;

-- 2. Relationship profile dasar. Dibuat hanya jika migration lama pernah terlewati.
create table if not exists public.couple_relationship_profiles (
  universe_id uuid primary key references public.universes(id) on delete cascade,
  started_on date,
  first_met_on date,
  anniversary_title text not null default 'Hari Kita',
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. Relationship Journey v4.9.x. Pertahankan seluruh kolom dan data versi lama.
alter table public.couple_relationship_profiles add column if not exists connection_title text not null default 'Terhubung Sejak';
alter table public.couple_relationship_profiles add column if not exists connected_on date;
alter table public.couple_relationship_profiles add column if not exists first_chat_on date;
alter table public.couple_relationship_profiles add column if not exists first_date_on date;
alter table public.couple_relationship_profiles add column if not exists relationship_story text not null default '';

-- 4. Constraint dibuat secara aman tanpa menggandakan nama constraint.
do $$
begin
  if not exists(select 1 from pg_constraint where conname='profiles_nickname_length_v490') then
    alter table public.profiles add constraint profiles_nickname_length_v490 check(nickname is null or char_length(trim(nickname))<=60);
  end if;
  if not exists(select 1 from pg_constraint where conname='profiles_birth_date_range_v490') then
    alter table public.profiles add constraint profiles_birth_date_range_v490 check(birth_date is null or birth_date>=date '1900-01-01');
  end if;
  if not exists(select 1 from pg_constraint where conname='profiles_hometown_length_v490') then
    alter table public.profiles add constraint profiles_hometown_length_v490 check(hometown is null or char_length(trim(hometown))<=100);
  end if;
  if not exists(select 1 from pg_constraint where conname='profiles_love_language_length_v490') then
    alter table public.profiles add constraint profiles_love_language_length_v490 check(love_language is null or char_length(trim(love_language))<=80);
  end if;
  if not exists(select 1 from pg_constraint where conname='profiles_favorite_things_length_v490') then
    alter table public.profiles add constraint profiles_favorite_things_length_v490 check(favorite_things is null or char_length(trim(favorite_things))<=300);
  end if;
  if not exists(select 1 from pg_constraint where conname='profiles_personal_quote_length_v490') then
    alter table public.profiles add constraint profiles_personal_quote_length_v490 check(personal_quote is null or char_length(trim(personal_quote))<=240);
  end if;
  if not exists(select 1 from pg_constraint where conname='couple_relationship_title_v470') then
    alter table public.couple_relationship_profiles add constraint couple_relationship_title_v470 check(char_length(trim(anniversary_title)) between 1 and 80);
  end if;
  if not exists(select 1 from pg_constraint where conname='couple_relationship_date_order_v470') then
    alter table public.couple_relationship_profiles add constraint couple_relationship_date_order_v470 check(first_met_on is null or started_on is null or first_met_on<=started_on);
  end if;
  if not exists(select 1 from pg_constraint where conname='couple_relationship_connection_title_v490') then
    alter table public.couple_relationship_profiles add constraint couple_relationship_connection_title_v490 check(char_length(trim(connection_title)) between 1 and 80);
  end if;
  if not exists(select 1 from pg_constraint where conname='couple_relationship_story_length_v490') then
    alter table public.couple_relationship_profiles add constraint couple_relationship_story_length_v490 check(char_length(relationship_story)<=2400);
  end if;
end $$;

-- 5. Timestamp update otomatis.
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

-- 6. Privasi dua anggota semesta.
alter table public.couple_relationship_profiles enable row level security;
alter table public.couple_relationship_profiles replica identity full;

drop policy if exists "couple_relationship_select_member" on public.couple_relationship_profiles;
create policy "couple_relationship_select_member" on public.couple_relationship_profiles
for select to authenticated using(public.is_universe_member(universe_id));

drop policy if exists "couple_relationship_insert_member" on public.couple_relationship_profiles;
create policy "couple_relationship_insert_member" on public.couple_relationship_profiles
for insert to authenticated with check(updated_by=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "couple_relationship_update_member" on public.couple_relationship_profiles;
create policy "couple_relationship_update_member" on public.couple_relationship_profiles
for update to authenticated
using(public.is_universe_member(universe_id))
with check(updated_by=auth.uid() and public.is_universe_member(universe_id));

revoke all on public.couple_relationship_profiles from anon,authenticated;
grant select,insert,update on public.couple_relationship_profiles to authenticated;
revoke all on function public.touch_couple_relationship_profile_v470() from public,anon;
grant execute on function public.touch_couple_relationship_profile_v470() to authenticated;

-- 7. Migrasikan tanggal versi lama tanpa menimpa tanggal baru.
update public.couple_relationship_profiles
set connected_on=coalesce(connected_on,started_on,first_met_on)
where connected_on is null and (started_on is not null or first_met_on is not null);

notify pgrst,'reload schema';
commit;

-- Hasil verifikasi. Semua nilai seharusnya true.
select
  to_regclass('public.couple_relationship_profiles') is not null as relationship_table_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='couple_relationship_profiles' and column_name='connected_on') as connected_on_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='birth_date') as cosmic_identity_ready;


-- ============================================================
-- FINAL VERIFICATION. Semua kolom *_ready seharusnya bernilai true.
-- ============================================================
notify pgrst,'reload schema';
select
  to_regclass('public.bond_pulses') is not null as heartbeat_ready,
  to_regclass('public.bond_replays') is not null as replay_cinema_ready,
  to_regclass('public.bond_capsules') is not null as secret_room_ready,
  to_regclass('public.love_timeline_moments') is not null as love_timeline_ready,
  to_regclass('public.couple_relationship_profiles') is not null as relationship_journey_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='couple_relationship_profiles' and column_name='connected_on') as connected_on_ready,
  exists(select 1 from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='birth_date') as cosmic_identity_ready;
