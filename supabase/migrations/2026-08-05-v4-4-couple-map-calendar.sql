-- OUR UNIVERSE v4.4.0
-- Peta jarak pasangan dan kalender bersama
-- Aman dijalankan berulang. Tidak menghapus data lama.

begin;

create table if not exists public.couple_locations (
  universe_id uuid not null references public.universes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  latitude double precision not null check(latitude between -90 and 90),
  longitude double precision not null check(longitude between -180 and 180),
  accuracy_m double precision check(accuracy_m is null or accuracy_m >= 0),
  heading double precision check(heading is null or heading between 0 and 360),
  speed_mps double precision check(speed_mps is null or speed_mps >= 0),
  updated_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  primary key(universe_id,user_id)
);

create index if not exists idx_couple_locations_active
  on public.couple_locations(universe_id,expires_at desc);

alter table public.couple_locations enable row level security;
alter table public.couple_locations replica identity full;

drop policy if exists "couple_locations_select_active_member" on public.couple_locations;
create policy "couple_locations_select_active_member" on public.couple_locations
for select to authenticated
using(
  expires_at > now()
  and public.is_universe_member(universe_id)
);

drop policy if exists "couple_locations_insert_self" on public.couple_locations;
create policy "couple_locations_insert_self" on public.couple_locations
for insert to authenticated
with check(
  user_id=auth.uid()
  and public.is_universe_member(universe_id)
  and expires_at <= now() + interval '3 minutes'
);

drop policy if exists "couple_locations_update_self" on public.couple_locations;
create policy "couple_locations_update_self" on public.couple_locations
for update to authenticated
using(user_id=auth.uid() and public.is_universe_member(universe_id))
with check(
  user_id=auth.uid()
  and public.is_universe_member(universe_id)
  and expires_at <= now() + interval '3 minutes'
);

drop policy if exists "couple_locations_delete_self" on public.couple_locations;
create policy "couple_locations_delete_self" on public.couple_locations
for delete to authenticated
using(user_id=auth.uid() and public.is_universe_member(universe_id));

revoke all on public.couple_locations from anon,authenticated;
grant select,insert,update,delete on public.couple_locations to authenticated;

create table if not exists public.couple_calendar_events (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check(char_length(trim(title)) between 1 and 120),
  event_date date not null,
  all_day boolean not null default false,
  start_time time,
  end_time time,
  notes text check(notes is null or char_length(notes) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint couple_calendar_time_valid check(
    (all_day=true and start_time is null and end_time is null)
    or
    (all_day=false and start_time is not null and (end_time is null or end_time >= start_time))
  )
);

create index if not exists idx_couple_calendar_universe_date
  on public.couple_calendar_events(universe_id,event_date,start_time);
create index if not exists idx_couple_calendar_owner
  on public.couple_calendar_events(owner_id,event_date desc);

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

create or replace function public.set_couple_calendar_updated_at_v44()
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

drop trigger if exists trg_couple_calendar_updated_at_v44 on public.couple_calendar_events;
create trigger trg_couple_calendar_updated_at_v44
before update on public.couple_calendar_events
for each row execute function public.set_couple_calendar_updated_at_v44();

revoke all on function public.set_couple_calendar_updated_at_v44() from public,anon;
grant execute on function public.set_couple_calendar_updated_at_v44() to authenticated;

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='couple_locations'
  ) then
    alter publication supabase_realtime add table public.couple_locations;
  end if;

  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='couple_calendar_events'
  ) then
    alter publication supabase_realtime add table public.couple_calendar_events;
  end if;
end $$;

commit;
