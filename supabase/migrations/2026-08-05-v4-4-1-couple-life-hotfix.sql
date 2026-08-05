-- OUR UNIVERSE v4.4.1 · Couple Life Hotfix
-- Aman dijalankan berulang. Tidak menghapus data lama.

begin;

create table if not exists public.couple_calendar_events (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  notes text,
  location text,
  start_at timestamptz not null,
  end_at timestamptz,
  all_day boolean not null default false,
  color text not null default 'rose' check (color in ('rose','violet','blue','mint','amber')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint couple_calendar_events_time_valid check (end_at is null or end_at >= start_at)
);

-- Tidak ada UNIQUE pada tanggal atau owner. Artinya dua orang dan banyak kegiatan
-- boleh tersimpan pada tanggal yang sama tanpa saling menimpa.
create index if not exists idx_couple_calendar_events_universe_start
  on public.couple_calendar_events(universe_id,start_at);
create index if not exists idx_couple_calendar_events_owner_start
  on public.couple_calendar_events(owner_id,start_at);

create or replace function public.touch_couple_calendar_event_v441()
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
create trigger trg_touch_couple_calendar_event_v441
before update on public.couple_calendar_events
for each row execute function public.touch_couple_calendar_event_v441();

alter table public.couple_calendar_events enable row level security;

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

create table if not exists public.couple_live_locations (
  universe_id uuid not null references public.universes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  latitude double precision not null check (latitude between -90 and 90),
  longitude double precision not null check (longitude between -180 and 180),
  accuracy double precision,
  altitude double precision,
  heading double precision,
  speed double precision,
  sharing boolean not null default false,
  recorded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(universe_id,user_id)
);

create index if not exists idx_couple_live_locations_universe_updated
  on public.couple_live_locations(universe_id,updated_at desc);

alter table public.couple_live_locations enable row level security;

drop policy if exists "couple_locations_select_member" on public.couple_live_locations;
create policy "couple_locations_select_member" on public.couple_live_locations
for select to authenticated
using(public.is_universe_member(universe_id));

drop policy if exists "couple_locations_insert_self" on public.couple_live_locations;
create policy "couple_locations_insert_self" on public.couple_live_locations
for insert to authenticated
with check(user_id=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "couple_locations_update_self" on public.couple_live_locations;
create policy "couple_locations_update_self" on public.couple_live_locations
for update to authenticated
using(user_id=auth.uid() and public.is_universe_member(universe_id))
with check(user_id=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "couple_locations_delete_self" on public.couple_live_locations;
create policy "couple_locations_delete_self" on public.couple_live_locations
for delete to authenticated
using(user_id=auth.uid() and public.is_universe_member(universe_id));

revoke all on public.couple_live_locations from anon,authenticated;
grant select,insert,update,delete on public.couple_live_locations to authenticated;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='couple_calendar_events') then
    alter publication supabase_realtime add table public.couple_calendar_events;
  end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='couple_live_locations') then
    alter publication supabase_realtime add table public.couple_live_locations;
  end if;
end $$;

commit;
