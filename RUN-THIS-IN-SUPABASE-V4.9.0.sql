-- OUR UNIVERSE v4.9.0 · COSMIC IDENTITY + RELATIONSHIP JOURNEY
-- Aman dijalankan berulang. Tidak menghapus atau menimpa data lama.

begin;

-- Identitas personal yang hanya terlihat oleh dua anggota semesta yang sama.
alter table public.profiles add column if not exists nickname text;
alter table public.profiles add column if not exists birth_date date;
alter table public.profiles add column if not exists hometown text;
alter table public.profiles add column if not exists love_language text;
alter table public.profiles add column if not exists favorite_things text;
alter table public.profiles add column if not exists personal_quote text;

do $$
begin
  if not exists(select 1 from pg_constraint where conname='profiles_nickname_length_v490') then
    alter table public.profiles add constraint profiles_nickname_length_v490
      check(nickname is null or char_length(trim(nickname))<=60);
  end if;
  if not exists(select 1 from pg_constraint where conname='profiles_birth_date_range_v490') then
    alter table public.profiles add constraint profiles_birth_date_range_v490
      check(birth_date is null or birth_date>=date '1900-01-01');
  end if;
  if not exists(select 1 from pg_constraint where conname='profiles_hometown_length_v490') then
    alter table public.profiles add constraint profiles_hometown_length_v490
      check(hometown is null or char_length(trim(hometown))<=100);
  end if;
  if not exists(select 1 from pg_constraint where conname='profiles_love_language_length_v490') then
    alter table public.profiles add constraint profiles_love_language_length_v490
      check(love_language is null or char_length(trim(love_language))<=80);
  end if;
  if not exists(select 1 from pg_constraint where conname='profiles_favorite_things_length_v490') then
    alter table public.profiles add constraint profiles_favorite_things_length_v490
      check(favorite_things is null or char_length(trim(favorite_things))<=300);
  end if;
  if not exists(select 1 from pg_constraint where conname='profiles_personal_quote_length_v490') then
    alter table public.profiles add constraint profiles_personal_quote_length_v490
      check(personal_quote is null or char_length(trim(personal_quote))<=240);
  end if;
end $$;

-- Titik-titik perjalanan hubungan. Kolom lama tetap dipertahankan.
alter table public.couple_relationship_profiles add column if not exists connection_title text not null default 'Terhubung Sejak';
alter table public.couple_relationship_profiles add column if not exists connected_on date;
alter table public.couple_relationship_profiles add column if not exists first_chat_on date;
alter table public.couple_relationship_profiles add column if not exists first_date_on date;
alter table public.couple_relationship_profiles add column if not exists relationship_story text not null default '';

do $$
begin
  if not exists(select 1 from pg_constraint where conname='couple_relationship_connection_title_v490') then
    alter table public.couple_relationship_profiles add constraint couple_relationship_connection_title_v490
      check(char_length(trim(connection_title)) between 1 and 80);
  end if;
  if not exists(select 1 from pg_constraint where conname='couple_relationship_story_length_v490') then
    alter table public.couple_relationship_profiles add constraint couple_relationship_story_length_v490
      check(char_length(relationship_story)<=2400);
  end if;
end $$;

-- Untuk data versi lama, gunakan tanggal mulai bersama sebagai tanggal terhubung awal.
update public.couple_relationship_profiles
set connected_on=coalesce(connected_on,started_on,first_met_on)
where connected_on is null and (started_on is not null or first_met_on is not null);

notify pgrst,'reload schema';
commit;
