-- OUR UNIVERSE · MEMORY ORBITS UPGRADE
-- Aman untuk instalasi yang sudah berjalan.
-- Tidak menghapus akun, semesta, entry, lampiran, atau file Storage.

begin;

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

alter table public.entries add column if not exists period_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname='entries_period_id_fkey'
      and conrelid='public.entries'::regclass
  ) then
    alter table public.entries
      add constraint entries_period_id_fkey
      foreign key(period_id) references public.memory_periods(id) on delete set null;
  end if;
end;
$$;

create index if not exists idx_periods_universe_order on public.memory_periods(universe_id,sort_order,start_date,created_at);
create index if not exists idx_entries_period on public.entries(universe_id,period_id,event_date,created_at);

drop trigger if exists memory_periods_set_updated_at on public.memory_periods;
create trigger memory_periods_set_updated_at
before update on public.memory_periods
for each row execute function public.set_updated_at();

alter table public.memory_periods enable row level security;

drop policy if exists "periods_select_member" on public.memory_periods;
create policy "periods_select_member" on public.memory_periods
for select to authenticated
using (public.is_universe_member(universe_id));

drop policy if exists "periods_insert_member" on public.memory_periods;
create policy "periods_insert_member" on public.memory_periods
for insert to authenticated
with check (
  public.is_universe_member(universe_id)
  and created_by=auth.uid()
  and updated_by=auth.uid()
);

drop policy if exists "periods_update_member" on public.memory_periods;
create policy "periods_update_member" on public.memory_periods
for update to authenticated
using (public.is_universe_member(universe_id))
with check (public.is_universe_member(universe_id) and updated_by=auth.uid());

drop policy if exists "periods_delete_member" on public.memory_periods;
create policy "periods_delete_member" on public.memory_periods
for delete to authenticated
using (public.is_universe_member(universe_id));

grant select,insert,update,delete on public.memory_periods to authenticated;

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
create trigger memory_periods_activity
after insert or update or delete on public.memory_periods
for each row execute function public.log_shared_activity();

do $$
begin
  begin
    alter publication supabase_realtime add table public.memory_periods;
  exception
    when duplicate_object then null;
    when undefined_object then null;
  end;
end;
$$;

commit;
