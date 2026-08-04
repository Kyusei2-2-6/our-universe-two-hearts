-- OUR UNIVERSE v4.1.2 · Planet save and Storage stability
-- Safe migration: does not delete accounts, planets, entries, files, or notification data.

begin;

create or replace function public.create_planet_v412(p_universe_id uuid,p_payload jsonb)
returns setof public.planets
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_id uuid;
  v_name text;
  v_style text;
  v_accent text;
  v_mode text;
  v_types text[];
begin
  if auth.uid() is null or not public.is_universe_member(p_universe_id) then
    raise exception 'Kamu bukan anggota semesta ini.' using errcode='42501';
  end if;

  v_name := left(btrim(coalesce(p_payload->>'name','')),120);
  if v_name='' then raise exception 'Nama planet wajib diisi.' using errcode='22023'; end if;

  v_style := coalesce(nullif(p_payload->>'planet_style',''),'ocean');
  if v_style not in ('ocean','ember','aurora','rose','ice','forest','desert','lunar','violet') then v_style:='ocean'; end if;

  v_accent := coalesce(nullif(p_payload->>'accent_color',''),'#7C8CFF');
  if v_accent !~ '^#[0-9A-Fa-f]{6}$' then v_accent:='#7C8CFF'; end if;

  v_mode := coalesce(nullif(p_payload->>'mode',''),'free');
  if v_mode not in ('special','mixed','free') then v_mode:='free'; end if;

  select array_agg(t.value)
  into v_types
  from jsonb_array_elements_text(coalesce(p_payload->'accepted_content_types','[]'::jsonb)) as t(value)
  where t.value = any(array['memory','gallery','letter','note','wish','music','timeline','capsule','file']::text[]);
  if coalesce(array_length(v_types,1),0)=0 then
    v_types:=array['memory','gallery','letter','note','wish','music','timeline','capsule','file']::text[];
  end if;

  insert into public.planets(
    universe_id,name,description,cover_path,planet_style,accent_color,accepted_content_types,
    mode,theme_song_path,sort_order,is_favorite,metadata,created_by,updated_by
  ) values (
    p_universe_id,
    v_name,
    nullif(left(btrim(coalesce(p_payload->>'description','')),3000),''),
    nullif(p_payload->>'cover_path',''),
    v_style,
    v_accent,
    v_types,
    v_mode,
    nullif(p_payload->>'theme_song_path',''),
    coalesce((p_payload->>'sort_order')::integer,0),
    coalesce((p_payload->>'is_favorite')::boolean,false),
    case when jsonb_typeof(p_payload->'metadata')='object' then p_payload->'metadata' else '{}'::jsonb end,
    auth.uid(),
    auth.uid()
  ) returning id into v_id;

  return query select p.* from public.planets p where p.id=v_id;
end;
$$;

create or replace function public.update_planet_v412(p_planet_id uuid,p_payload jsonb)
returns setof public.planets
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  v_planet public.planets%rowtype;
  v_name text;
  v_style text;
  v_accent text;
  v_mode text;
  v_types text[];
begin
  select * into v_planet from public.planets where id=p_planet_id;
  if not found then raise exception 'Planet tidak ditemukan.' using errcode='P0002'; end if;
  if auth.uid() is null or not public.is_universe_member(v_planet.universe_id) then
    raise exception 'Kamu bukan anggota semesta ini.' using errcode='42501';
  end if;

  v_name:=v_planet.name;
  if p_payload ? 'name' then
    v_name:=left(btrim(coalesce(p_payload->>'name','')),120);
    if v_name='' then raise exception 'Nama planet wajib diisi.' using errcode='22023'; end if;
  end if;

  v_style:=coalesce(nullif(p_payload->>'planet_style',''),v_planet.planet_style);
  if v_style not in ('ocean','ember','aurora','rose','ice','forest','desert','lunar','violet') then v_style:=v_planet.planet_style; end if;

  v_accent:=coalesce(nullif(p_payload->>'accent_color',''),v_planet.accent_color);
  if v_accent !~ '^#[0-9A-Fa-f]{6}$' then v_accent:=v_planet.accent_color; end if;

  v_mode:=coalesce(nullif(p_payload->>'mode',''),v_planet.mode);
  if v_mode not in ('special','mixed','free') then v_mode:=v_planet.mode; end if;

  v_types:=v_planet.accepted_content_types;
  if p_payload ? 'accepted_content_types' then
    select array_agg(t.value)
    into v_types
    from jsonb_array_elements_text(coalesce(p_payload->'accepted_content_types','[]'::jsonb)) as t(value)
    where t.value = any(array['memory','gallery','letter','note','wish','music','timeline','capsule','file']::text[]);
    if coalesce(array_length(v_types,1),0)=0 then v_types:=v_planet.accepted_content_types; end if;
  end if;

  update public.planets set
    name=v_name,
    description=case when p_payload ? 'description' then nullif(left(btrim(coalesce(p_payload->>'description','')),3000),'') else description end,
    cover_path=case when p_payload ? 'cover_path' then nullif(p_payload->>'cover_path','') else cover_path end,
    planet_style=v_style,
    accent_color=v_accent,
    mode=v_mode,
    accepted_content_types=v_types,
    theme_song_path=case when p_payload ? 'theme_song_path' then nullif(p_payload->>'theme_song_path','') else theme_song_path end,
    sort_order=case when p_payload ? 'sort_order' then coalesce((p_payload->>'sort_order')::integer,sort_order) else sort_order end,
    is_favorite=case when p_payload ? 'is_favorite' then coalesce((p_payload->>'is_favorite')::boolean,false) else is_favorite end,
    metadata=case when p_payload ? 'metadata' and jsonb_typeof(p_payload->'metadata')='object' then p_payload->'metadata' else metadata end,
    updated_by=auth.uid()
  where id=p_planet_id;

  return query select p.* from public.planets p where p.id=p_planet_id;
end;
$$;

revoke all on function public.create_planet_v412(uuid,jsonb) from public;
revoke all on function public.update_planet_v412(uuid,jsonb) from public;
grant execute on function public.create_planet_v412(uuid,jsonb) to authenticated;
grant execute on function public.update_planet_v412(uuid,jsonb) to authenticated;

-- Direct table policies remain available for old clients, but use an explicit membership check.
drop policy if exists "planets_insert_member" on public.planets;
create policy "planets_insert_member" on public.planets for insert to authenticated
with check (
  exists(select 1 from public.universe_members m where m.universe_id=planets.universe_id and m.user_id=auth.uid())
  and created_by=auth.uid() and updated_by=auth.uid()
);

drop policy if exists "planets_update_member" on public.planets;
create policy "planets_update_member" on public.planets for update to authenticated
using (exists(select 1 from public.universe_members m where m.universe_id=planets.universe_id and m.user_id=auth.uid()))
with check (
  exists(select 1 from public.universe_members m where m.universe_id=planets.universe_id and m.user_id=auth.uid())
  and updated_by=auth.uid()
);

create or replace function public.can_manage_planet_storage_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select auth.uid() is not null and exists(
    select 1
    from public.planets p
    join public.universe_members m on m.universe_id=p.universe_id and m.user_id=auth.uid()
    where p.id=public.path_planet_id(p_name)
      and p.universe_id=public.path_universe_id(p_name)
  );
$$;

revoke all on function public.can_manage_planet_storage_object(text) from public;
grant execute on function public.can_manage_planet_storage_object(text) to authenticated;

-- Preserve profile and entry access while making planet covers reliable.
drop policy if exists "storage_select_shared_or_unlocked" on storage.objects;
create policy "storage_select_shared_or_unlocked" on storage.objects for select to authenticated using(
  bucket_id='universe-files'
  and public.is_universe_member(public.path_universe_id(name))
  and (
    (storage.foldername(name))[2]='profiles'
    or public.can_manage_planet_storage_object(name)
    or exists(select 1 from public.entries e where e.id=public.path_entry_id(name) and e.universe_id=public.path_universe_id(name) and (e.unlock_at is null or e.unlock_at<=now()))
  )
);

drop policy if exists "storage_insert_member" on storage.objects;
create policy "storage_insert_member" on storage.objects for insert to authenticated with check(
  bucket_id='universe-files'
  and public.is_universe_member(public.path_universe_id(name))
  and (
    ((storage.foldername(name))[2]='profiles' and (storage.foldername(name))[3]=auth.uid()::text)
    or public.can_manage_planet_storage_object(name)
    or exists(select 1 from public.entries e where e.id=public.path_entry_id(name) and e.universe_id=public.path_universe_id(name))
  )
);

commit;
