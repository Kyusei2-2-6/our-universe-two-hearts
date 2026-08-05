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
