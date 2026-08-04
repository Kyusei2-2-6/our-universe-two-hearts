-- OUR UNIVERSE v4 · Dynamic Planets
-- Adds user-created planets and a one-time destructive reset while preserving accounts,
-- memberships, profiles, notification subscriptions, and project configuration.

begin;

alter table public.universes alter column settings set default '{"theme":"violet","space_theme":"solar-system","content_model":"dynamic-planets","rebuilt_v4":true}'::jsonb;

create table if not exists public.planets (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  description text,
  cover_path text,
  planet_style text not null default 'ocean',
  accent_color text not null default '#7C8CFF' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  accepted_content_types text[] not null default array['memory','gallery','letter','note','wish','music','timeline','capsule','file']::text[],
  mode text not null default 'free' check (mode in ('special','mixed','free')),
  theme_song_path text,
  sort_order integer not null default 0,
  is_favorite boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.planet_entries (
  planet_id uuid not null references public.planets(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  universe_id uuid not null references public.universes(id) on delete cascade,
  added_by uuid not null references public.profiles(id) on delete restrict,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (planet_id,entry_id)
);

create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  planet_id uuid not null references public.planets(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  expires_at timestamptz not null default (now() + interval '24 hours'),
  keep_permanently boolean not null default true,
  created_at timestamptz not null default now(),
  unique (planet_id,entry_id)
);

create table if not exists public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id,user_id)
);

create index if not exists idx_planets_universe_order on public.planets(universe_id,is_favorite desc,sort_order,created_at);
create index if not exists idx_planet_entries_planet_order on public.planet_entries(planet_id,sort_order,created_at);
create index if not exists idx_planet_entries_entry on public.planet_entries(entry_id);
create index if not exists idx_stories_planet_expiry on public.stories(planet_id,expires_at desc);

-- Keep updated_at correct.
drop trigger if exists planets_set_updated_at on public.planets;
create trigger planets_set_updated_at before update on public.planets
for each row execute function public.set_updated_at();

alter table public.planets enable row level security;
alter table public.planet_entries enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;

-- Idempotent policies.
drop policy if exists "planets_select_member" on public.planets;
create policy "planets_select_member" on public.planets for select to authenticated
using (public.is_universe_member(universe_id));

drop policy if exists "planets_insert_member" on public.planets;
create policy "planets_insert_member" on public.planets for insert to authenticated
with check (public.is_universe_member(universe_id) and created_by=auth.uid() and updated_by=auth.uid());

drop policy if exists "planets_update_member" on public.planets;
create policy "planets_update_member" on public.planets for update to authenticated
using (public.is_universe_member(universe_id))
with check (public.is_universe_member(universe_id) and updated_by=auth.uid());

drop policy if exists "planets_delete_member" on public.planets;
create policy "planets_delete_member" on public.planets for delete to authenticated
using (public.is_universe_member(universe_id));

drop policy if exists "planet_entries_select_member" on public.planet_entries;
create policy "planet_entries_select_member" on public.planet_entries for select to authenticated
using (public.is_universe_member(universe_id));

drop policy if exists "planet_entries_insert_member" on public.planet_entries;
create policy "planet_entries_insert_member" on public.planet_entries for insert to authenticated
with check (public.is_universe_member(universe_id) and added_by=auth.uid());

drop policy if exists "planet_entries_update_member" on public.planet_entries;
create policy "planet_entries_update_member" on public.planet_entries for update to authenticated
using (public.is_universe_member(universe_id))
with check (public.is_universe_member(universe_id));

drop policy if exists "planet_entries_delete_member" on public.planet_entries;
create policy "planet_entries_delete_member" on public.planet_entries for delete to authenticated
using (public.is_universe_member(universe_id));

drop policy if exists "stories_select_member" on public.stories;
create policy "stories_select_member" on public.stories for select to authenticated
using (public.is_universe_member(universe_id));

drop policy if exists "stories_insert_member" on public.stories;
create policy "stories_insert_member" on public.stories for insert to authenticated
with check (public.is_universe_member(universe_id) and created_by=auth.uid());

drop policy if exists "stories_update_member" on public.stories;
create policy "stories_update_member" on public.stories for update to authenticated
using (public.is_universe_member(universe_id))
with check (public.is_universe_member(universe_id));

drop policy if exists "stories_delete_member" on public.stories;
create policy "stories_delete_member" on public.stories for delete to authenticated
using (public.is_universe_member(universe_id));

drop policy if exists "story_views_select_member" on public.story_views;
create policy "story_views_select_member" on public.story_views for select to authenticated
using (exists(select 1 from public.stories s where s.id=story_id and public.is_universe_member(s.universe_id)));

drop policy if exists "story_views_insert_own" on public.story_views;
create policy "story_views_insert_own" on public.story_views for insert to authenticated
with check (user_id=auth.uid() and exists(select 1 from public.stories s where s.id=story_id and public.is_universe_member(s.universe_id)));

revoke all on public.planets,public.planet_entries,public.stories,public.story_views from anon;
grant select,insert,update,delete on public.planets,public.planet_entries,public.stories to authenticated;
grant select,insert on public.story_views to authenticated;

-- Allow procedural planet cover uploads: universe/planets/<planet_id>/file.
create or replace function public.path_planet_id(p_name text)
returns uuid language plpgsql immutable as $$
declare v text;
begin
  v := (storage.foldername(p_name))[3];
  if (storage.foldername(p_name))[2]='planets'
     and v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  then return v::uuid; end if;
  return null;
end;
$$;

-- Replace storage policies so entry media, profiles, and planet covers all work.
drop policy if exists "storage_select_shared_or_unlocked" on storage.objects;
create policy "storage_select_shared_or_unlocked" on storage.objects for select to authenticated using(
  bucket_id='universe-files'
  and public.is_universe_member(public.path_universe_id(name))
  and (
    (storage.foldername(name))[2]='profiles'
    or ((storage.foldername(name))[2]='planets' and exists(
      select 1 from public.planets p where p.id=public.path_planet_id(name) and p.universe_id=public.path_universe_id(name)
    ))
    or exists(select 1 from public.entries e where e.id=public.path_entry_id(name) and e.universe_id=public.path_universe_id(name) and (e.unlock_at is null or e.unlock_at<=now()))
  )
);

drop policy if exists "storage_insert_member" on storage.objects;
create policy "storage_insert_member" on storage.objects for insert to authenticated with check(
  bucket_id='universe-files'
  and public.is_universe_member(public.path_universe_id(name))
  and (
    ((storage.foldername(name))[2]='profiles' and (storage.foldername(name))[3]=auth.uid()::text)
    or ((storage.foldername(name))[2]='planets' and exists(
      select 1 from public.planets p where p.id=public.path_planet_id(name) and p.universe_id=public.path_universe_id(name)
    ))
    or exists(select 1 from public.entries e where e.id=public.path_entry_id(name) and e.universe_id=public.path_universe_id(name))
  )
);

-- One-time owner-only reset. Physical Storage objects are removed by the authenticated client first.
create or replace function public.reset_universe_v4(p_universe_id uuid,p_confirmation text)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_owner boolean;
  v_entries integer;
  v_planets integer;
begin
  if p_confirmation <> 'HAPUS DAN BANGUN ULANG' then
    raise exception 'Kalimat konfirmasi tidak sesuai.';
  end if;

  select exists(
    select 1 from public.universe_members
    where universe_id=p_universe_id and user_id=auth.uid() and role='owner'
  ) into v_owner;

  if not v_owner then raise exception 'Hanya pemilik semesta yang dapat melakukan reset permanen.'; end if;

  select count(*) into v_entries from public.entries where universe_id=p_universe_id;
  select count(*) into v_planets from public.planets where universe_id=p_universe_id;

  delete from public.stories where universe_id=p_universe_id;
  delete from public.planet_entries where universe_id=p_universe_id;
  delete from public.planets where universe_id=p_universe_id;
  delete from public.memory_periods where universe_id=p_universe_id;
  delete from public.entries where universe_id=p_universe_id;
  delete from public.activity_logs where universe_id=p_universe_id;

  update public.universes
  set settings = coalesce(settings,'{}'::jsonb)
    || jsonb_build_object(
      'rebuilt_v4',true,
      'rebuilt_v4_at',now(),
      'space_theme','solar-system',
      'content_model','dynamic-planets'
    ),
    updated_at=now()
  where id=p_universe_id;

  return jsonb_build_object('entries_deleted',v_entries,'planets_deleted',v_planets,'rebuilt_v4',true);
end;
$$;

revoke all on function public.reset_universe_v4(uuid,text) from public;
grant execute on function public.reset_universe_v4(uuid,text) to authenticated;

-- Realtime additions.
do $$
declare t text;
begin
  foreach t in array array['planets','planet_entries','stories'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;

commit;
