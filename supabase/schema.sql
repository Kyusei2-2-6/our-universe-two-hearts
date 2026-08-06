-- OUR UNIVERSE · TWO HEARTS
-- Jalankan seluruh file ini sekali melalui Supabase SQL Editor.
-- Tidak ada data contoh yang dimasukkan.

begin;

create extension if not exists pgcrypto;

-- Instance guard: this deployment accepts exactly two pre-approved email addresses.
create table if not exists public.app_config (
  singleton boolean primary key default true check (singleton),
  owner_email text not null default '',
  partner_email text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint two_distinct_emails check (
    owner_email = '' or partner_email = '' or lower(owner_email) <> lower(partner_email)
  )
);
insert into public.app_config(singleton) values(true) on conflict(singleton) do nothing;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null default 'Seseorang',
  bio text not null default '',
  avatar_path text,
  accent text not null default 'violet',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.universes (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  owner_id uuid not null references public.profiles(id) on delete restrict,
  partner_email text,
  invite_code text not null unique,
  invite_closed_at timestamptz,
  max_members smallint not null default 2 check (max_members = 2),
  settings jsonb not null default '{"theme":"violet"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.universe_members (
  universe_id uuid not null references public.universes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (universe_id,user_id),
  unique (user_id)
);


create table if not exists public.memory_periods (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 140),
  description text,
  start_date date,
  end_date date,
  planet_style text not null default 'moon' check (planet_style in ('moon','saturn','aurora','ember','ice')),
  accent_color text not null default '#8fb8ff' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint memory_period_date_order check (end_date is null or start_date is null or end_date >= start_date)
);

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  period_id uuid references public.memory_periods(id) on delete set null,
  type text not null check (type in ('memory','gallery','letter','note','wish','music','timeline','capsule','file')),
  title text not null check (char_length(title) between 1 and 180),
  body text,
  event_date timestamptz,
  location text,
  mood text,
  weather text,
  tags text[] not null default '{}',
  favorite boolean not null default false,
  status text not null default 'active' check (status in ('active','in_progress','completed','archived')),
  progress smallint not null default 0 check (progress between 0 and 100),
  unlock_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint capsule_requires_unlock check (type <> 'capsule' or unlock_at is not null)
);

create table if not exists public.entry_secrets (
  entry_id uuid primary key references public.entries(id) on delete cascade,
  universe_id uuid not null references public.universes(id) on delete cascade,
  payload jsonb,
  encrypted_payload jsonb,
  password_protected boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exactly_one_secret_payload check (
    (payload is not null and encrypted_payload is null and password_protected = false)
    or (payload is null and encrypted_payload is not null and password_protected = true)
  )
);

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  kind text not null check (kind in ('image','video','audio','pdf','text','document','archive','other')),
  file_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint not null default 0 check (size_bytes >= 0),
  sort_order integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reactions (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  entry_id uuid not null references public.entries(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 12),
  created_at timestamptz not null default now(),
  unique (entry_id,user_id,emoji)
);

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  universe_id uuid not null references public.universes(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (action in ('insert','update','delete')),
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_members_universe on public.universe_members(universe_id);
create index if not exists idx_periods_universe_order on public.memory_periods(universe_id,sort_order,start_date,created_at);
create index if not exists idx_entries_period on public.entries(universe_id,period_id,event_date,created_at);
create index if not exists idx_entries_universe_type_date on public.entries(universe_id,type,event_date desc,created_at desc);
create index if not exists idx_entries_tags on public.entries using gin(tags);
create index if not exists idx_attachments_entry on public.attachments(entry_id,sort_order);
create index if not exists idx_comments_entry on public.comments(entry_id,created_at);
create index if not exists idx_reactions_entry on public.reactions(entry_id);
create index if not exists idx_activity_universe_created on public.activity_logs(universe_id,created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists universes_set_updated_at on public.universes;
create trigger universes_set_updated_at before update on public.universes for each row execute function public.set_updated_at();
drop trigger if exists memory_periods_set_updated_at on public.memory_periods;
create trigger memory_periods_set_updated_at before update on public.memory_periods for each row execute function public.set_updated_at();
drop trigger if exists entries_set_updated_at on public.entries;
create trigger entries_set_updated_at before update on public.entries for each row execute function public.set_updated_at();
drop trigger if exists secrets_set_updated_at on public.entry_secrets;
create trigger secrets_set_updated_at before update on public.entry_secrets for each row execute function public.set_updated_at();
drop trigger if exists comments_set_updated_at on public.comments;
create trigger comments_set_updated_at before update on public.comments for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner text;
  v_partner text;
  v_email text := lower(coalesce(new.email,''));
  v_profile_count integer;
begin
  select lower(owner_email),lower(partner_email)
    into v_owner,v_partner
    from public.app_config where singleton=true for update;

  if coalesce(v_owner,'')='' or coalesce(v_partner,'')='' then
    raise exception 'Allowlist dua akun belum dikonfigurasi. Jalankan supabase/allowlist.sql terlebih dahulu.';
  end if;
  if v_email not in (v_owner,v_partner) then
    raise exception 'Email ini tidak diizinkan memasuki semesta.';
  end if;

  select count(*) into v_profile_count from public.profiles;
  if v_profile_count >= 2 then
    raise exception 'Semesta ini sudah memiliki dua akun.';
  end if;
  if v_profile_count = 0 and v_email <> v_owner then
    raise exception 'Akun penjaga pertama harus dibuat lebih dahulu.';
  end if;
  if v_profile_count = 1 and v_email <> v_partner then
    raise exception 'Hanya email pasangan yang dapat membuat akun kedua.';
  end if;

  insert into public.profiles(id,email,display_name)
  values (
    new.id,
    v_email,
    coalesce(nullif(trim(new.raw_user_meta_data->>'display_name'),''), split_part(v_email,'@',1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_universe_member(p_universe_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(
    select 1 from public.universe_members
    where universe_id = p_universe_id and user_id = auth.uid()
  );
$$;

create or replace function public.generate_invite_code()
returns text
language sql
volatile
security definer
set search_path = public, extensions, pg_catalog
as $$
  select upper(encode(gen_random_bytes(5),'hex'));
$$;

create or replace function public.enforce_two_members()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  current_count integer;
begin
  select count(*) into current_count from public.universe_members where universe_id = new.universe_id;
  if current_count >= 2 then
    raise exception 'Semesta ini sudah memiliki dua anggota.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_two_members_trigger on public.universe_members;
create trigger enforce_two_members_trigger before insert on public.universe_members for each row execute function public.enforce_two_members();

create or replace function public.create_universe(p_name text,p_display_name text,p_partner_email text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_universe public.universes;
  v_code text;
begin
  if v_user is null then raise exception 'Kamu harus masuk terlebih dahulu.'; end if;
  if exists(select 1 from public.universe_members where user_id=v_user) then raise exception 'Akun ini sudah memiliki semesta.'; end if;
  if exists(select 1 from public.universes) then raise exception 'Semesta utama sudah dibuat.'; end if;
  if lower(coalesce(auth.jwt()->>'email','')) <> (select lower(owner_email) from public.app_config where singleton=true) then
    raise exception 'Hanya penjaga pertama yang dapat membuat semesta.';
  end if;
  if lower(coalesce(nullif(trim(p_partner_email),''),'')) <> (select lower(partner_email) from public.app_config where singleton=true) then
    raise exception 'Email pasangan tidak cocok dengan allowlist instalasi.';
  end if;
  if nullif(trim(p_name),'') is null then raise exception 'Nama semesta wajib diisi.'; end if;
  update public.profiles set display_name=left(trim(p_display_name),80) where id=v_user;
  loop
    v_code := public.generate_invite_code();
    exit when not exists(select 1 from public.universes where invite_code=v_code);
  end loop;
  insert into public.universes(name,owner_id,partner_email,invite_code)
  values(left(trim(p_name),120),v_user,nullif(lower(trim(p_partner_email)),''),v_code)
  returning * into v_universe;
  insert into public.universe_members(universe_id,user_id,role) values(v_universe.id,v_user,'owner');
  return jsonb_build_object('universe_id',v_universe.id,'invite_code',v_universe.invite_code);
end;
$$;

create or replace function public.join_universe(p_invite_code text,p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt()->>'email',''));
  v_universe public.universes;
  v_count integer;
begin
  if v_user is null then raise exception 'Kamu harus masuk terlebih dahulu.'; end if;
  if exists(select 1 from public.universe_members where user_id=v_user) then raise exception 'Akun ini sudah memiliki semesta.'; end if;
  select * into v_universe from public.universes where invite_code=upper(trim(p_invite_code)) for update;
  if not found then raise exception 'Kode undangan tidak ditemukan.'; end if;
  if v_universe.invite_closed_at is not null then raise exception 'Pintu semesta ini sudah tertutup.'; end if;
  if v_universe.partner_email is not null and lower(v_universe.partner_email) <> v_email then raise exception 'Kode ini hanya dapat digunakan oleh email pasangan yang didaftarkan.'; end if;
  select count(*) into v_count from public.universe_members where universe_id=v_universe.id;
  if v_count >= 2 then raise exception 'Semesta ini sudah memiliki dua anggota.'; end if;
  update public.profiles set display_name=left(trim(p_display_name),80) where id=v_user;
  insert into public.universe_members(universe_id,user_id,role) values(v_universe.id,v_user,'member');
  update public.universes set invite_closed_at=now() where id=v_universe.id;
  return jsonb_build_object('universe_id',v_universe.id,'joined',true);
end;
$$;

create or replace function public.update_partner_email(p_universe_id uuid,p_partner_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_partner_email,'')));
  v_owner_email text;
  v_member_count integer;
  v_profile_count integer;
begin
  if v_email='' then raise exception 'Email pasangan wajib diisi.'; end if;
  if not exists(
    select 1 from public.universe_members
    where universe_id=p_universe_id and user_id=auth.uid() and role='owner'
  ) then raise exception 'Hanya penjaga pertama yang dapat mengubah email pasangan.'; end if;
  select lower(owner_email) into v_owner_email from public.app_config where singleton=true for update;
  if v_email=v_owner_email then raise exception 'Email pasangan harus berbeda.'; end if;
  select count(*) into v_member_count from public.universe_members where universe_id=p_universe_id;
  select count(*) into v_profile_count from public.profiles;
  if v_member_count>=2 or v_profile_count>=2 then raise exception 'Email tidak dapat diubah setelah akun kedua dibuat.'; end if;
  update public.app_config set partner_email=v_email,updated_at=now() where singleton=true;
  update public.universes set partner_email=v_email where id=p_universe_id;
end;
$$;

create or replace function public.regenerate_invite_code(p_universe_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_code text; v_count integer;
begin
  if not public.is_universe_member(p_universe_id) then raise exception 'Akses ditolak.'; end if;
  select count(*) into v_count from public.universe_members where universe_id=p_universe_id;
  if v_count >= 2 then raise exception 'Semesta sudah lengkap.'; end if;
  loop
    v_code := public.generate_invite_code();
    exit when not exists(select 1 from public.universes where invite_code=v_code);
  end loop;
  update public.universes set invite_code=v_code,invite_closed_at=null where id=p_universe_id;
  return v_code;
end;
$$;

create or replace function public.log_shared_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_data record;
  v_universe uuid;
  v_entity_id text;
  v_title text;
begin
  if tg_op='DELETE' then row_data:=old; else row_data:=new; end if;
  v_universe:=row_data.universe_id;
  v_entity_id:=row_data.id::text;
  if tg_table_name='entries' then v_title:=row_data.title;
  elsif tg_table_name='memory_periods' then v_title:=row_data.title;
  elsif tg_table_name='attachments' then v_title:=row_data.file_name;
  elsif tg_table_name='comments' then v_title:=left(row_data.body,120);
  else v_title:=null; end if;
  insert into public.activity_logs(universe_id,actor_id,action,entity_type,entity_id,metadata)
  values(v_universe,auth.uid(),lower(tg_op),tg_table_name,v_entity_id,jsonb_build_object('title',v_title));
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

drop trigger if exists memory_periods_activity on public.memory_periods;
create trigger memory_periods_activity after insert or update or delete on public.memory_periods for each row execute function public.log_shared_activity();
drop trigger if exists entries_activity on public.entries;
create trigger entries_activity after insert or update or delete on public.entries for each row execute function public.log_shared_activity();
drop trigger if exists attachments_activity on public.attachments;
create trigger attachments_activity after insert or delete on public.attachments for each row execute function public.log_shared_activity();
drop trigger if exists comments_activity on public.comments;
create trigger comments_activity after insert or delete on public.comments for each row execute function public.log_shared_activity();

alter table public.app_config enable row level security;
alter table public.profiles enable row level security;
alter table public.universes enable row level security;
alter table public.universe_members enable row level security;
alter table public.memory_periods enable row level security;
alter table public.entries enable row level security;
alter table public.entry_secrets enable row level security;
alter table public.attachments enable row level security;
alter table public.comments enable row level security;
alter table public.reactions enable row level security;
alter table public.activity_logs enable row level security;

-- Profiles
create policy "profiles_select_shared" on public.profiles for select to authenticated using (
  id=auth.uid() or exists(
    select 1 from public.universe_members mine
    join public.universe_members theirs on theirs.universe_id=mine.universe_id
    where mine.user_id=auth.uid() and theirs.user_id=profiles.id
  )
);
create policy "profiles_update_own" on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());

-- Universe and membership
create policy "universes_select_member" on public.universes for select to authenticated using(public.is_universe_member(id));
create policy "universes_update_member" on public.universes for update to authenticated using(public.is_universe_member(id)) with check(public.is_universe_member(id));
create policy "members_select_member" on public.universe_members for select to authenticated using(public.is_universe_member(universe_id));


-- Memory periods / Orbit Kenangan
create policy "periods_select_member" on public.memory_periods for select to authenticated using(public.is_universe_member(universe_id));
create policy "periods_insert_member" on public.memory_periods for insert to authenticated with check(public.is_universe_member(universe_id) and created_by=auth.uid() and updated_by=auth.uid());
create policy "periods_update_member" on public.memory_periods for update to authenticated using(public.is_universe_member(universe_id)) with check(public.is_universe_member(universe_id) and updated_by=auth.uid());
create policy "periods_delete_member" on public.memory_periods for delete to authenticated using(public.is_universe_member(universe_id));

-- Shared entries
create policy "entries_select_member" on public.entries for select to authenticated using(public.is_universe_member(universe_id));
create policy "entries_insert_member" on public.entries for insert to authenticated with check(public.is_universe_member(universe_id) and created_by=auth.uid() and updated_by=auth.uid());
create policy "entries_update_member" on public.entries for update to authenticated using(public.is_universe_member(universe_id)) with check(public.is_universe_member(universe_id) and updated_by=auth.uid());
create policy "entries_delete_member" on public.entries for delete to authenticated using(public.is_universe_member(universe_id));

-- Secret payload is invisible until unlock_at. Password encryption remains an additional client-side layer.
create policy "secrets_select_after_unlock" on public.entry_secrets for select to authenticated using(
  public.is_universe_member(universe_id) and exists(
    select 1 from public.entries e where e.id=entry_id and (e.unlock_at is null or e.unlock_at<=now())
  )
);
create policy "secrets_insert_member" on public.entry_secrets for insert to authenticated with check(public.is_universe_member(universe_id) and created_by=auth.uid());
create policy "secrets_update_member" on public.entry_secrets for update to authenticated using(public.is_universe_member(universe_id)) with check(public.is_universe_member(universe_id));
create policy "secrets_delete_member" on public.entry_secrets for delete to authenticated using(public.is_universe_member(universe_id));

create policy "attachments_select_member" on public.attachments for select to authenticated using(
  public.is_universe_member(universe_id) and exists(
    select 1 from public.entries e
    where e.id=entry_id and e.universe_id=attachments.universe_id
      and (e.unlock_at is null or e.unlock_at<=now())
  )
);
create policy "attachments_insert_member" on public.attachments for insert to authenticated with check(public.is_universe_member(universe_id) and created_by=auth.uid());
create policy "attachments_update_member" on public.attachments for update to authenticated using(public.is_universe_member(universe_id)) with check(public.is_universe_member(universe_id));
create policy "attachments_delete_member" on public.attachments for delete to authenticated using(public.is_universe_member(universe_id));

create policy "comments_select_member" on public.comments for select to authenticated using(public.is_universe_member(universe_id));
create policy "comments_insert_own" on public.comments for insert to authenticated with check(public.is_universe_member(universe_id) and user_id=auth.uid());
create policy "comments_update_own" on public.comments for update to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy "comments_delete_own" on public.comments for delete to authenticated using(user_id=auth.uid());

create policy "reactions_select_member" on public.reactions for select to authenticated using(public.is_universe_member(universe_id));
create policy "reactions_insert_own" on public.reactions for insert to authenticated with check(public.is_universe_member(universe_id) and user_id=auth.uid());
create policy "reactions_delete_own" on public.reactions for delete to authenticated using(user_id=auth.uid());

create policy "activity_select_member" on public.activity_logs for select to authenticated using(public.is_universe_member(universe_id));

-- Explicit privileges. No content is available to anon users.
revoke all on public.app_config from anon,authenticated;
revoke all on all tables in schema public from anon;
grant select,update on public.profiles to authenticated;
grant select on public.universe_members to authenticated;
grant select on public.universes to authenticated;
grant update(name,settings,updated_at) on public.universes to authenticated;
grant select,insert,update,delete on public.memory_periods,public.entries,public.entry_secrets,public.attachments,public.comments,public.reactions to authenticated;
grant select on public.activity_logs to authenticated;
grant usage,select on sequence public.activity_logs_id_seq to authenticated;
revoke all on function public.create_universe(text,text,text) from public;
revoke all on function public.join_universe(text,text) from public;
revoke all on function public.regenerate_invite_code(uuid) from public;
revoke all on function public.update_partner_email(uuid,text) from public;
grant execute on function public.create_universe(text,text,text) to authenticated;
grant execute on function public.join_universe(text,text) to authenticated;
grant execute on function public.regenerate_invite_code(uuid) to authenticated;
grant execute on function public.update_partner_email(uuid,text) to authenticated;
grant execute on function public.is_universe_member(uuid) to authenticated;

-- Private storage bucket
insert into storage.buckets(id,name,public,file_size_limit)
values('universe-files','universe-files',false,83886080)
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit;

create or replace function public.path_universe_id(p_name text)
returns uuid language plpgsql immutable as $$
declare v text;
begin
  v:=(storage.foldername(p_name))[1];
  if v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return v::uuid; end if;
  return null;
end;
$$;
create or replace function public.path_entry_id(p_name text)
returns uuid language plpgsql immutable as $$
declare v text;
begin
  v:=(storage.foldername(p_name))[2];
  if v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then return v::uuid; end if;
  return null;
end;
$$;

create policy "storage_select_shared_or_unlocked" on storage.objects for select to authenticated using(
  bucket_id='universe-files'
  and public.is_universe_member(public.path_universe_id(name))
  and (
    (storage.foldername(name))[2]='profiles'
    or exists(select 1 from public.entries e where e.id=public.path_entry_id(name) and e.universe_id=public.path_universe_id(name) and (e.unlock_at is null or e.unlock_at<=now()))
  )
);
create policy "storage_insert_member" on storage.objects for insert to authenticated with check(
  bucket_id='universe-files'
  and public.is_universe_member(public.path_universe_id(name))
  and (
    ((storage.foldername(name))[2]='profiles' and (storage.foldername(name))[3]=auth.uid()::text)
    or exists(select 1 from public.entries e where e.id=public.path_entry_id(name) and e.universe_id=public.path_universe_id(name))
  )
);
create policy "storage_delete_member" on storage.objects for delete to authenticated using(
  bucket_id='universe-files' and public.is_universe_member(public.path_universe_id(name))
);

-- Realtime for collaborative updates.
do $$
declare t text;
begin
  foreach t in array array['entries','attachments','comments','reactions','universe_members','profiles'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=t) then
      execute format('alter publication supabase_realtime add table public.%I',t);
    end if;
  end loop;
end $$;

do $$
begin
  begin
    alter publication supabase_realtime add table public.memory_periods;
  exception when duplicate_object then null; when undefined_object then null;
  end;
end;
$$;


-- Romantic Web Push notifications
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  device_name text not null default 'Perangkat',
  user_agent text not null default '',
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_recipient
  on public.push_subscriptions(universe_id,user_id)
  where enabled=true;

create table if not exists public.notification_preferences (
  universe_id uuid not null references public.universes(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  enabled boolean not null default true,
  entry_created boolean not null default true,
  comment_created boolean not null default true,
  reaction_created boolean not null default true,
  foreground_sound boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(universe_id,user_id)
);

create table if not exists public.push_delivery_events (
  id bigint generated always as identity primary key,
  event_key text not null unique,
  universe_id uuid not null references public.universes(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check(event_type in ('entry_created','comment_created','reaction_created','test')),
  resource_id uuid,
  attempted integer not null default 0,
  delivered integer not null default 0,
  failed integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.push_delivery_events enable row level security;

drop policy if exists "push_select_own" on public.push_subscriptions;
create policy "push_select_own" on public.push_subscriptions
for select to authenticated
using(user_id=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "push_insert_own" on public.push_subscriptions;
create policy "push_insert_own" on public.push_subscriptions
for insert to authenticated
with check(user_id=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "push_update_own" on public.push_subscriptions;
create policy "push_update_own" on public.push_subscriptions
for update to authenticated
using(user_id=auth.uid() and public.is_universe_member(universe_id))
with check(user_id=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "push_delete_own" on public.push_subscriptions;
create policy "push_delete_own" on public.push_subscriptions
for delete to authenticated
using(user_id=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "notification_preferences_select_own" on public.notification_preferences;
create policy "notification_preferences_select_own" on public.notification_preferences
for select to authenticated
using(user_id=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "notification_preferences_insert_own" on public.notification_preferences;
create policy "notification_preferences_insert_own" on public.notification_preferences
for insert to authenticated
with check(user_id=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "notification_preferences_update_own" on public.notification_preferences;
create policy "notification_preferences_update_own" on public.notification_preferences
for update to authenticated
using(user_id=auth.uid() and public.is_universe_member(universe_id))
with check(user_id=auth.uid() and public.is_universe_member(universe_id));

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists notification_preferences_set_updated_at on public.notification_preferences;
create trigger notification_preferences_set_updated_at
before update on public.notification_preferences
for each row execute function public.set_updated_at();

revoke all on public.push_subscriptions from anon,authenticated;
revoke all on public.notification_preferences from anon,authenticated;
revoke all on public.push_delivery_events from anon,authenticated;
grant select,insert,update,delete on public.push_subscriptions to authenticated;
grant select,insert,update on public.notification_preferences to authenticated;

commit;

-- ============================================================================
-- OUR UNIVERSE v4 · Dynamic Planets baseline
-- Kept in the canonical schema so a fresh installation gets the v4 model.
-- ============================================================================
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

-- OUR UNIVERSE v4.3 · Couple Connect
-- Aman dijalankan berulang. Tidak menghapus akun, planet, kenangan, atau media lama.

begin;

-- Ringkasan planet skala besar. Beranda menerima satu baris per planet,
-- bukan seluruh relasi planet_entries dan stories.
create or replace function public.list_planet_summaries_v43(target_universe_id uuid)
returns table(planet jsonb, entry_count bigint, active_story_count bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select
    to_jsonb(p) as planet,
    (select count(*) from public.planet_entries pe where pe.planet_id=p.id and pe.universe_id=p.universe_id) as entry_count,
    (select count(*) from public.stories s where s.planet_id=p.id and s.universe_id=p.universe_id and s.expires_at>now()) as active_story_count
  from public.planets p
  where p.universe_id=target_universe_id
    and public.is_universe_member(target_universe_id)
  order by p.is_favorite desc, p.sort_order asc, p.created_at asc;
$$;

revoke all on function public.list_planet_summaries_v43(uuid) from public,anon;
grant execute on function public.list_planet_summaries_v43(uuid) to authenticated;

create table if not exists public.couple_messages (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'text' check (kind in ('text','poke','heart','miss_you')),
  body text,
  metadata jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint couple_messages_distinct_people check (sender_id <> recipient_id),
  constraint couple_messages_body_valid check (
    (kind='text' and body is not null and char_length(trim(body)) between 1 and 2000)
    or (kind<>'text' and body is null)
  )
);

create index if not exists idx_couple_messages_universe_created
  on public.couple_messages(universe_id,created_at desc);
create index if not exists idx_couple_messages_unread
  on public.couple_messages(universe_id,recipient_id,created_at desc)
  where read_at is null;

alter table public.couple_messages enable row level security;

drop policy if exists "couple_messages_select_member" on public.couple_messages;
create policy "couple_messages_select_member" on public.couple_messages
for select to authenticated
using(public.is_universe_member(universe_id));

drop policy if exists "couple_messages_insert_sender" on public.couple_messages;
create policy "couple_messages_insert_sender" on public.couple_messages
for insert to authenticated
with check(
  sender_id=auth.uid()
  and sender_id<>recipient_id
  and public.is_universe_member(universe_id)
  and exists(
    select 1 from public.universe_members member
    where member.universe_id=couple_messages.universe_id
      and member.user_id=couple_messages.recipient_id
  )
);

drop policy if exists "couple_messages_mark_read_recipient" on public.couple_messages;
create policy "couple_messages_mark_read_recipient" on public.couple_messages
for update to authenticated
using(recipient_id=auth.uid() and public.is_universe_member(universe_id))
with check(recipient_id=auth.uid() and public.is_universe_member(universe_id));

drop policy if exists "couple_messages_delete_sender" on public.couple_messages;
create policy "couple_messages_delete_sender" on public.couple_messages
for delete to authenticated
using(sender_id=auth.uid() and public.is_universe_member(universe_id));

revoke all on public.couple_messages from anon,authenticated;
grant select,insert,delete on public.couple_messages to authenticated;
grant update(read_at) on public.couple_messages to authenticated;

alter table public.notification_preferences
  add column if not exists couple_message boolean not null default true,
  add column if not exists couple_signal boolean not null default true;

alter table public.push_delivery_events
  drop constraint if exists push_delivery_events_event_type_check;
alter table public.push_delivery_events
  add constraint push_delivery_events_event_type_check
  check(event_type in ('entry_created','comment_created','reaction_created','couple_message','couple_signal','test'));

-- Pastikan INSERT dan UPDATE Couple Connect diteruskan oleh Supabase Realtime.
do $$
begin
  if not exists(
    select 1
    from pg_publication_tables
    where pubname='supabase_realtime'
      and schemaname='public'
      and tablename='couple_messages'
  ) then
    alter publication supabase_realtime add table public.couple_messages;
  end if;
end $$;

commit;



-- Bundled v4.4.1 schema for fresh installations
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


-- Bundled v4.5.0 OUR BOND schema for fresh installations
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
