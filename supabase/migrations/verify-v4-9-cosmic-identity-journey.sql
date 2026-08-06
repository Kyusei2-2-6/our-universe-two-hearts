-- Verifikasi OUR UNIVERSE v4.9.0
select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='profiles'
  and column_name in ('nickname','birth_date','hometown','love_language','favorite_things','personal_quote')
order by column_name;

select column_name,data_type
from information_schema.columns
where table_schema='public' and table_name='couple_relationship_profiles'
  and column_name in ('connection_title','connected_on','first_chat_on','first_date_on','relationship_story')
order by column_name;
