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

  async activities(limit = 80) {
    this.requireContext();
    const { data, error } = await supabase().from('activity_logs').select('*').eq('universe_id',this.universeId).order('created_at',{ascending:false}).limit(limit);
    if (error) throw error;
    return data || [];
  }

  async stats() {
    this.requireContext();
    const client = supabase();
    const [entries, attachments, comments, periods] = await Promise.all([
      client.from('entries').select('id,type,status,progress,period_id',{count:'exact'}).eq('universe_id',this.universeId),
      client.from('attachments').select('id,kind,size_bytes',{count:'exact'}).eq('universe_id',this.universeId),
      client.from('comments').select('id',{count:'exact'}).eq('universe_id',this.universeId),
      client.from('memory_periods').select('id',{count:'exact'}).eq('universe_id',this.universeId)
    ]);
    if (entries.error) throw entries.error;
    if (attachments.error) throw attachments.error;
    if (comments.error) throw comments.error;
    if (periods.error) throw periods.error;
    return { entries:entries.data || [], entryCount:entries.count || 0, attachments:attachments.data || [], attachmentCount:attachments.count || 0, commentCount:comments.count || 0, periodCount:periods.count || 0 };
  }
}
export const repository = new Repository();
