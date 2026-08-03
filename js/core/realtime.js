import { supabase } from './supabase.js';
import { events } from './event-bus.js';

class RealtimeService {
  channels = [];
  async connect({ universeId, user, profile }) {
    await this.disconnect();
    const client = supabase();
    const tables = ['entries','attachments','comments','reactions','universe_members','profiles'];
    for (const table of tables) {
      const filter = ['profiles'].includes(table) ? undefined : `universe_id=eq.${universeId}`;
      const channel = client.channel(`db:${universeId}:${table}`)
        .on('postgres_changes', { event:'*', schema:'public', table, ...(filter ? { filter } : {}) }, payload => events.emit('realtime:change',{ table,payload }))
        .subscribe();
      this.channels.push(channel);
    }
    const presence = client.channel(`presence:${universeId}`, { config:{ presence:{ key:user.id } } });
    presence.on('presence',{event:'sync'},()=>events.emit('presence:sync',{ state:presence.presenceState() }));
    presence.on('presence',{event:'join'},({key,newPresences})=>events.emit('presence:join',{key,newPresences}));
    presence.on('presence',{event:'leave'},({key,leftPresences})=>events.emit('presence:leave',{key,leftPresences}));
    presence.subscribe(async status => {
      if (status === 'SUBSCRIBED') await presence.track({ user_id:user.id, display_name:profile?.display_name || 'Seseorang', online_at:new Date().toISOString() });
    });
    this.channels.push(presence);
  }
  async disconnect() {
    const client = (()=>{ try{return supabase();}catch{return null;} })();
    if (client) await Promise.all(this.channels.map(channel => client.removeChannel(channel).catch(()=>{})));
    this.channels = [];
  }
}
export const realtime = new RealtimeService();
