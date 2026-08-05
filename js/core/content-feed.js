import { supabase } from './supabase.js';
import { repository } from './repository.js';
import { preferredPageSize } from './data-mode.js';

function escapeFilter(value=''){
  return String(value).replace(/[,%()]/g,' ').trim().slice(0,120);
}

export async function listPlanetEntryPage(planetId,{query='',type='',page=0,pageSize=preferredPageSize()}={}){
  if(!repository.universeId)throw new Error('Semesta belum aktif.');
  const safePage=Math.max(0,Number(page)||0);
  const safeSize=Math.max(1,Math.min(24,Number(pageSize)||preferredPageSize()));
  const from=safePage*safeSize;
  const to=from+safeSize-1;
  let request=supabase().from('planet_entries')
    .select('entry_id,sort_order,created_at,entries!inner(*)',{count:'exact'})
    .eq('planet_id',planetId)
    .eq('universe_id',repository.universeId)
    .eq('entries.universe_id',repository.universeId)
    .order('sort_order',{ascending:true})
    .order('created_at',{ascending:false})
    .range(from,to);
  if(type)request=request.eq('entries.type',type);
  const text=escapeFilter(query);
  if(text){
    request=request.or(`title.ilike.%${text}%,body.ilike.%${text}%,location.ilike.%${text}%`,{referencedTable:'entries'});
  }
  const {data,error,count}=await request;
  if(error)throw error;
  const ordered=(data||[]).map(row=>row.entries).filter(Boolean);
  const entries=await repository.attachMedia(ordered);
  return {
    entries,
    count:count||0,
    page:safePage,
    pageSize:safeSize,
    hasMore:from+entries.length<(count||0)
  };
}
