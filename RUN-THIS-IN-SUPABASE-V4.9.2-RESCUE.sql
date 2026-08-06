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
