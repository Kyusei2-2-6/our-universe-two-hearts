import { supabase } from './supabase.js';

class Repository {
  universeId = null;
  userId = null;
  setContext({ universeId, userId }) { this.universeId = universeId; this.userId = userId; }
  requireContext() { if (!this.universeId || !this.userId) throw new Error('Semesta belum aktif.'); }

  async listEntries({ type, query, status, favorite, periodId, unassigned = false, limit = 100, ascending = false } = {}) {
    this.requireContext();
    let request = supabase().from('entries').select('*').eq('universe_id', this.universeId).order('event_date', { ascending, nullsFirst:false }).order('created_at', { ascending:false }).limit(limit);
    if (type) request = request.eq('type', type);
    if (status) request = request.eq('status', status);
    if (typeof favorite === 'boolean') request = request.eq('favorite', favorite);
    if (periodId) request = request.eq('period_id', periodId);
    if (unassigned) request = request.is('period_id', null);
    if (query) request = request.or(`title.ilike.%${this.escapeFilter(query)}%,body.ilike.%${this.escapeFilter(query)}%,location.ilike.%${this.escapeFilter(query)}%`);
    const { data, error } = await request;
    if (error) throw error;
    return this.attachMedia(data || []);
  }

  escapeFilter(value) { return String(value).replace(/[,%()]/g, ' ').trim().slice(0,120); }

  async attachMedia(entries) {
    if (!entries.length) return [];
    const ids = entries.map(entry => entry.id);
    const { data, error } = await supabase().from('attachments').select('*').in('entry_id', ids).order('sort_order').order('created_at');
    if (error) throw error;
    const grouped = new Map();
    for (const item of data || []) {
      if (!grouped.has(item.entry_id)) grouped.set(item.entry_id, []);
      grouped.get(item.entry_id).push(item);
    }
    return entries.map(entry => ({ ...entry, attachments:grouped.get(entry.id) || [] }));
  }


  async listPeriods() {
    this.requireContext();
    const { data, error } = await supabase().from('memory_periods').select('*').eq('universe_id',this.universeId).order('sort_order').order('start_date',{ascending:true,nullsFirst:false}).order('created_at',{ascending:true});
    if (error) throw error;
    return data || [];
  }

  async getPeriod(id) {
    this.requireContext();
    const { data, error } = await supabase().from('memory_periods').select('*').eq('universe_id',this.universeId).eq('id',id).single();
    if (error) throw error;
    return data;
  }

  async createPeriod(payload) {
    this.requireContext();
    const record={
      universe_id:this.universeId,created_by:this.userId,updated_by:this.userId,
      title:String(payload.title||'').trim().slice(0,140),
      description:payload.description?String(payload.description).trim().slice(0,12000):null,
      start_date:payload.start_date||null,end_date:payload.end_date||null,
      planet_style:payload.planet_style||'moon',accent_color:payload.accent_color||'#8fb8ff',
      sort_order:Number.isFinite(payload.sort_order)?payload.sort_order:0,metadata:payload.metadata||{}
    };
    const {data,error}=await supabase().from('memory_periods').insert(record).select().single();
    if(error)throw error;return data;
  }

  async updatePeriod(id,payload) {
    this.requireContext();
    const allowed=['title','description','start_date','end_date','planet_style','accent_color','sort_order','metadata'];
    const record={updated_by:this.userId};
    for(const key of allowed)if(key in payload)record[key]=payload[key];
    if('title' in record)record.title=String(record.title||'').trim().slice(0,140);
    if('description' in record)record.description=record.description?String(record.description).trim().slice(0,12000):null;
    const {data,error}=await supabase().from('memory_periods').update(record).eq('universe_id',this.universeId).eq('id',id).select().single();
    if(error)throw error;return data;
  }

  async deletePeriod(id) {
    this.requireContext();
    const {error}=await supabase().from('memory_periods').delete().eq('universe_id',this.universeId).eq('id',id);
    if(error)throw error;
  }

  async getEntry(id) {
    this.requireContext();
    const client = supabase();
    const [{ data:entry, error:entryError }, { data:attachments, error:attachmentError }, { data:comments, error:commentError }, { data:reactions, error:reactionError }] = await Promise.all([
      client.from('entries').select('*').eq('universe_id',this.universeId).eq('id',id).single(),
      client.from('attachments').select('*').eq('entry_id',id).order('sort_order').order('created_at'),
      client.from('comments').select('*').eq('entry_id',id).order('created_at'),
      client.from('reactions').select('*').eq('entry_id',id).order('created_at')
    ]);
    if (entryError) throw entryError;
    if (attachmentError && attachmentError.code !== 'PGRST116') throw attachmentError;
    if (commentError) throw commentError;
    if (reactionError) throw reactionError;
    return { ...entry, attachments:attachments || [], comments:comments || [], reactions:reactions || [] };
  }

  async createEntry(payload) {
    this.requireContext();
    const record = {
      universe_id:this.universeId, created_by:this.userId, updated_by:this.userId,
      type:payload.type, title:String(payload.title || '').trim().slice(0,180),
      body:payload.body ? String(payload.body).trim().slice(0,100000) : null,
      event_date:payload.event_date || null, location:payload.location ? String(payload.location).trim().slice(0,300) : null,
      mood:payload.mood ? String(payload.mood).trim().slice(0,80) : null,
      weather:payload.weather ? String(payload.weather).trim().slice(0,80) : null,
      tags:Array.isArray(payload.tags) ? payload.tags.slice(0,30).map(tag => String(tag).trim().slice(0,50)).filter(Boolean) : [],
      favorite:Boolean(payload.favorite), status:payload.status || 'active', progress:Number.isFinite(payload.progress) ? Math.max(0,Math.min(100,payload.progress)) : 0,
      unlock_at:payload.unlock_at || null, period_id:payload.period_id || null, metadata:payload.metadata || {}
    };
    const { data, error } = await supabase().from('entries').insert(record).select().single();
    if (error) throw error;
    return data;
  }

  async updateEntry(id, payload) {
    this.requireContext();
    const allowed = ['type','title','body','event_date','location','mood','weather','tags','favorite','status','progress','unlock_at','period_id','metadata'];
    const record = { updated_by:this.userId };
    for (const key of allowed) if (key in payload) record[key] = payload[key];
    if ('title' in record) record.title = String(record.title || '').trim().slice(0,180);
    if ('body' in record) record.body = record.body ? String(record.body).trim().slice(0,100000) : null;
    const { data, error } = await supabase().from('entries').update(record).eq('universe_id',this.universeId).eq('id',id).select().single();
    if (error) throw error;
    return data;
  }

  async deleteEntry(id) {
    this.requireContext();
    const { error } = await supabase().from('entries').delete().eq('universe_id',this.universeId).eq('id',id);
    if (error) throw error;
  }

  async addAttachment(entryId, fileRecord, sortOrder = 0) {
    this.requireContext();
    const { data, error } = await supabase().from('attachments').insert({
      universe_id:this.universeId, entry_id:entryId, created_by:this.userId,
      kind:fileRecord.kind, file_path:fileRecord.path, file_name:String(fileRecord.name).slice(0,255),
      mime_type:fileRecord.mime_type, size_bytes:fileRecord.size_bytes, sort_order:sortOrder, metadata:fileRecord.metadata || {}
    }).select().single();
    if (error) throw error;
    return data;
  }

  async deleteAttachment(id) {
    this.requireContext();
    const { data, error } = await supabase().from('attachments').delete().eq('universe_id',this.universeId).eq('id',id).select().single();
    if (error) throw error;
    return data;
  }

  async setSecret(entryId, { payload = null, encryptedPayload = null, passwordProtected = false }) {
    this.requireContext();
    const { data, error } = await supabase().from('entry_secrets').upsert({
      entry_id:entryId, universe_id:this.universeId, created_by:this.userId,
      payload, encrypted_payload:encryptedPayload, password_protected:passwordProtected
    }, { onConflict:'entry_id' }).select().single();
    if (error) throw error;
    return data;
  }

  async getSecret(entryId) {
    this.requireContext();
    const { data, error } = await supabase().from('entry_secrets').select('*').eq('entry_id',entryId).maybeSingle();
    if (error) throw error;
    return data;
  }

  async addComment(entryId, body) {
    this.requireContext();
    const { data, error } = await supabase().from('comments').insert({ universe_id:this.universeId, entry_id:entryId, user_id:this.userId, body:String(body).trim().slice(0,5000) }).select().single();
    if (error) throw error;
    return data;
  }

  async deleteComment(id) {
    const { error } = await supabase().from('comments').delete().eq('id',id).eq('user_id',this.userId);
    if (error) throw error;
  }

  async toggleReaction(entryId, emoji) {
    this.requireContext();
    const client = supabase();
    const { data:existing, error:findError } = await client.from('reactions').select('id').eq('entry_id',entryId).eq('user_id',this.userId).eq('emoji',emoji).maybeSingle();
    if (findError) throw findError;
    if (existing) {
      const { error } = await client.from('reactions').delete().eq('id',existing.id);
      if (error) throw error;
      return { active:false, id:null };
    }
    const { data, error } = await client.from('reactions').insert({ universe_id:this.universeId, entry_id:entryId, user_id:this.userId, emoji:String(emoji).slice(0,12) }).select('id').single();
    if (error) throw error;
    return { active:true, id:data.id };
  }

  async listPlanets() {
    this.requireContext();
    const {data,error}=await supabase().from('planets').select('*').eq('universe_id',this.universeId).order('is_favorite',{ascending:false}).order('sort_order').order('created_at');
    if(error)throw error;
    const planets=data||[];
    if(!planets.length)return [];
    const ids=planets.map(item=>item.id);
    const {data:links,error:linkError}=await supabase().from('planet_entries').select('planet_id,entry_id').in('planet_id',ids);
    if(linkError)throw linkError;
    const counts=new Map();for(const link of links||[])counts.set(link.planet_id,(counts.get(link.planet_id)||0)+1);
    const now=new Date().toISOString();
    const {data:stories,error:storyError}=await supabase().from('stories').select('planet_id,id').in('planet_id',ids).gt('expires_at',now);
    if(storyError)throw storyError;
    const storyCounts=new Map();for(const story of stories||[])storyCounts.set(story.planet_id,(storyCounts.get(story.planet_id)||0)+1);
    return planets.map(item=>({...item,entry_count:counts.get(item.id)||0,active_story_count:storyCounts.get(item.id)||0}));
  }

  async getPlanet(id) {
    this.requireContext();
    const {data,error}=await supabase().from('planets').select('*').eq('universe_id',this.universeId).eq('id',id).single();
    if(error)throw error;return data;
  }

  async createPlanet(payload) {
    this.requireContext();
    const record={
      name:String(payload.name||'').trim().slice(0,120),
      description:payload.description?String(payload.description).trim().slice(0,3000):null,
      cover_path:payload.cover_path||null,planet_style:payload.planet_style||'ocean',
      accent_color:payload.accent_color||'#7C8CFF',mode:payload.mode||'free',
      accepted_content_types:Array.isArray(payload.accepted_content_types)&&payload.accepted_content_types.length?payload.accepted_content_types:['memory','gallery','letter','note','wish','music','timeline','capsule','file'],
      theme_song_path:payload.theme_song_path||null,sort_order:Number(payload.sort_order)||0,
      is_favorite:Boolean(payload.is_favorite),metadata:payload.metadata||{}
    };
    const {data,error}=await supabase().rpc('create_planet_v412',{p_universe_id:this.universeId,p_payload:record}).single();
    if(error){
      if(error.code==='PGRST202')throw new Error('Pembaruan database V4.1.2 belum dipasang. Jalankan migrasi stabilitas terlebih dahulu.');
      throw friendlyPlanetError(error);
    }
    return data;
  }

  async updatePlanet(id,payload) {
    this.requireContext();
    const allowed=['name','description','cover_path','planet_style','accent_color','mode','accepted_content_types','theme_song_path','sort_order','is_favorite','metadata'];
    const record={};for(const key of allowed)if(key in payload)record[key]=payload[key];
    if('name' in record)record.name=String(record.name||'').trim().slice(0,120);
    if('description' in record)record.description=record.description?String(record.description).trim().slice(0,3000):null;
    const {data,error}=await supabase().rpc('update_planet_v412',{p_planet_id:id,p_payload:record}).single();
    if(error){
      if(error.code==='PGRST202')throw new Error('Pembaruan database V4.1.2 belum dipasang. Jalankan migrasi stabilitas terlebih dahulu.');
      throw friendlyPlanetError(error);
    }
    return data;
  }

  async deletePlanet(id) {
    this.requireContext();
    const {data,error}=await supabase().from('planets').delete().eq('universe_id',this.universeId).eq('id',id).select('cover_path,theme_song_path').single();
    if(error)throw error;return data;
  }

  async reorderPlanets(ids=[]) {
    this.requireContext();
    for(let index=0;index<ids.length;index++){
      const {error}=await supabase().from('planets').update({sort_order:index,updated_by:this.userId}).eq('universe_id',this.universeId).eq('id',ids[index]);
      if(error)throw error;
    }
  }

  async addEntryToPlanet(planetId,entryId,sortOrder=0) {
    this.requireContext();
    const {data,error}=await supabase().from('planet_entries').upsert({planet_id:planetId,entry_id:entryId,universe_id:this.universeId,added_by:this.userId,sort_order:sortOrder},{onConflict:'planet_id,entry_id'}).select().single();
    if(error)throw error;return data;
  }

  async countEntryPlanets(entryId) {
    this.requireContext();
    const {count,error}=await supabase().from('planet_entries').select('planet_id',{count:'exact',head:true}).eq('universe_id',this.universeId).eq('entry_id',entryId);
    if(error)throw error;return count||0;
  }

  async removeEntryFromPlanet(planetId,entryId) {
    this.requireContext();
    const {error}=await supabase().from('planet_entries').delete().eq('planet_id',planetId).eq('entry_id',entryId).eq('universe_id',this.universeId);
    if(error)throw error;
  }

  async listPlanetEntries(planetId,{query='',limit=250}={}) {
    this.requireContext();
    const {data:links,error}=await supabase().from('planet_entries').select('entry_id,sort_order,created_at').eq('planet_id',planetId).eq('universe_id',this.universeId).order('sort_order').order('created_at',{ascending:false}).limit(limit);
    if(error)throw error;if(!links?.length)return [];
    const ids=links.map(item=>item.entry_id);
    let req=supabase().from('entries').select('*').eq('universe_id',this.universeId).in('id',ids);
    if(query)req=req.or(`title.ilike.%${this.escapeFilter(query)}%,body.ilike.%${this.escapeFilter(query)}%,location.ilike.%${this.escapeFilter(query)}%`);
    const {data,error:entryError}=await req;if(entryError)throw entryError;
    const media=await this.attachMedia(data||[]);const map=new Map(media.map(item=>[item.id,item]));
    return links.map(link=>map.get(link.entry_id)).filter(Boolean);
  }

  async recommendPlanets(entryType) {
    const planets=await this.listPlanets();
    return planets.map(planet=>({planet,score:(planet.accepted_content_types||[]).includes(entryType)?100:planet.mode==='free'?60:0})).filter(item=>item.score>0).sort((a,b)=>b.score-a.score||b.planet.is_favorite-a.planet.is_favorite).map(item=>item.planet);
  }

  async createStory({planetId,entryId,keepPermanently=true}) {
    this.requireContext();
    const {data,error}=await supabase().from('stories').upsert({universe_id:this.universeId,planet_id:planetId,entry_id:entryId,created_by:this.userId,expires_at:new Date(Date.now()+86400000).toISOString(),keep_permanently:Boolean(keepPermanently)},{onConflict:'planet_id,entry_id'}).select().single();
    if(error)throw error;return data;
  }

  async listExpiredStories() {
    this.requireContext();
    const {data,error}=await supabase().from('stories').select('id,entry_id,keep_permanently,expires_at').eq('universe_id',this.universeId).lte('expires_at',new Date().toISOString()).limit(100);
    if(error)throw error;return data||[];
  }

  async deleteStory(id) {
    this.requireContext();
    const {error}=await supabase().from('stories').delete().eq('universe_id',this.universeId).eq('id',id);
    if(error)throw error;
  }

  async listActiveStories() {
    this.requireContext();
    const {data,error}=await supabase().from('stories').select('*,planets(name,accent_color,planet_style),entries(title,type,metadata,created_by,created_at)').eq('universe_id',this.universeId).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false});
    if(error)throw error;return data||[];
  }

  async listAllContentFilePaths() {
    this.requireContext();
    const [{data:attachments,error:aError},{data:planets,error:pError}]=await Promise.all([
      supabase().from('attachments').select('file_path').eq('universe_id',this.universeId),
      supabase().from('planets').select('cover_path,theme_song_path').eq('universe_id',this.universeId)
    ]);
    if(aError)throw aError;if(pError)throw pError;
    return [...(attachments||[]).map(item=>item.file_path),...(planets||[]).flatMap(item=>[item.cover_path,item.theme_song_path])].filter(Boolean);
  }

  async resetUniverseV4(confirmation) {
    this.requireContext();
    const {data,error}=await supabase().rpc('reset_universe_v4',{p_universe_id:this.universeId,p_confirmation:confirmation});
    if(error)throw error;return data;
  }

  async activities(limit = 80) {
    this.requireContext();
    const { data, error } = await supabase().from('activity_logs').select('*').eq('universe_id',this.universeId).order('created_at',{ascending:false}).limit(limit);
    if (error) throw error;
    return data || [];
  }

  async stats() {
    this.requireContext();
    const client=supabase();
    const [entries,attachments,comments,planets]=await Promise.all([
      client.from('entries').select('id,type,status',{count:'exact'}).eq('universe_id',this.universeId),
      client.from('attachments').select('id,kind,size_bytes',{count:'exact'}).eq('universe_id',this.universeId),
      client.from('comments').select('id',{count:'exact'}).eq('universe_id',this.universeId),
      client.from('planets').select('id',{count:'exact'}).eq('universe_id',this.universeId)
    ]);
    for(const result of [entries,attachments,comments,planets])if(result.error)throw result.error;
    return {entries:entries.data||[],entryCount:entries.count||0,attachments:attachments.data||[],attachmentCount:attachments.count||0,commentCount:comments.count||0,planetCount:planets.count||0};
  }}

function friendlyPlanetError(error){
  const message=String(error?.message||'').toLowerCase();
  if(message.includes('row-level security')||message.includes('permission denied'))return new Error('Izin menyimpan planet belum sinkron. Migrasi V4.1.2 akan memperbaikinya tanpa menghapus data.');
  return error instanceof Error?error:new Error(String(error?.message||'Planet belum dapat disimpan.'));
}

export const repository = new Repository();
