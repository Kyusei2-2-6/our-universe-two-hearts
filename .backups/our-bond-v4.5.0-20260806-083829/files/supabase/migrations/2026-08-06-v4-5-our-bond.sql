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
