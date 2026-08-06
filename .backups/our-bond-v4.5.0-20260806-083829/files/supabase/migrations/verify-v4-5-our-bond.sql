-- Verifikasi OUR UNIVERSE v4.5.0 · OUR BOND
select
  to_regclass('public.bond_pulses') as bond_pulses,
  to_regclass('public.bond_emotions') as bond_emotions,
  to_regclass('public.bond_replays') as bond_replays,
  to_regclass('public.bond_capsules') as bond_capsules,
  to_regclass('public.bond_capsule_secrets') as bond_capsule_secrets;

select tablename,rowsecurity
from pg_tables
where schemaname='public'
  and tablename in ('bond_pulses','bond_emotions','bond_replays','bond_capsules','bond_capsule_secrets')
order by tablename;

select schemaname,tablename
from pg_publication_tables
where pubname='supabase_realtime'
  and schemaname='public'
  and tablename in ('bond_pulses','bond_emotions','bond_replays','bond_capsules')
order by tablename;
