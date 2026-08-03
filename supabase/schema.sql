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

create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  universe_id uuid not null references public.universes(id) on delete cascade,
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
  elsif tg_table_name='attachments' then v_title:=row_data.file_name;
  elsif tg_table_name='comments' then v_title:=left(row_data.body,120);
  else v_title:=null; end if;
  insert into public.activity_logs(universe_id,actor_id,action,entity_type,entity_id,metadata)
  values(v_universe,auth.uid(),lower(tg_op),tg_table_name,v_entity_id,jsonb_build_object('title',v_title));
  if tg_op='DELETE' then return old; else return new; end if;
end;
$$;

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
grant select,insert,update,delete on public.entries,public.entry_secrets,public.attachments,public.comments,public.reactions to authenticated;
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

commit;
