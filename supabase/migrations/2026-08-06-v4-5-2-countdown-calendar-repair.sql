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
