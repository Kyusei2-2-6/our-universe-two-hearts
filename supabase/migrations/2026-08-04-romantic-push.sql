-- OUR UNIVERSE · Romantic Push Notifications
-- Menambah langganan Web Push dan preferensi perangkat tanpa mengubah akun atau data lama.

begin;

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
