import { supabase } from './supabase.js';

class AuthService {
  async session() {
    const { data, error } = await supabase().auth.getSession();
    if (error) throw error;
    return data.session;
  }

  onChange(handler) {
    const { data } = supabase().auth.onAuthStateChange((event, session) => handler(event, session));
    return () => data.subscription.unsubscribe();
  }

  async signIn(email, password) {
    const { data, error } = await supabase().auth.signInWithPassword({ email:String(email).trim(), password });
    if (error) throw error;
    return data;
  }

  async signUp({ email, password, displayName }) {
    const redirectTo = `${location.origin}${location.pathname}`;
    const { data, error } = await supabase().auth.signUp({
      email:String(email).trim(), password,
      options:{ emailRedirectTo:redirectTo, data:{ display_name:String(displayName || '').trim() } }
    });
    if (error) throw error;
    return data;
  }

  async resetPassword(email) {
    const redirectTo = `${location.origin}${location.pathname}#settings`;
    const { error } = await supabase().auth.resetPasswordForEmail(String(email).trim(), { redirectTo });
    if (error) throw error;
  }

  async updatePassword(password) {
    const { error } = await supabase().auth.updateUser({ password });
    if (error) throw error;
  }

  async signOut() {
    const { error } = await supabase().auth.signOut();
    if (error) throw error;
  }

  async context() {
    const session = await this.session();
    if (!session?.user) return { session:null, user:null, profile:null, membership:null, universe:null, members:[] };
    const client = supabase();
    const [{ data:profile, error:profileError }, { data:membership, error:membershipError }] = await Promise.all([
      client.from('profiles').select('*').eq('id', session.user.id).maybeSingle(),
      client.from('universe_members').select('universe_id,user_id,role,joined_at').eq('user_id', session.user.id).maybeSingle()
    ]);
    if (profileError) throw profileError;
    if (membershipError) throw membershipError;
    if (!membership) return { session, user:session.user, profile, membership:null, universe:null, members:[] };
    const [{ data:universe, error:universeError }, { data:members, error:membersError }] = await Promise.all([
      client.from('universes').select('*').eq('id', membership.universe_id).single(),
      client.from('universe_members').select('universe_id,user_id,role,joined_at').eq('universe_id', membership.universe_id).order('joined_at')
    ]);
    if (universeError) throw universeError;
    if (membersError) throw membersError;
    const userIds = members.map(item => item.user_id);
    const { data:profiles, error:profilesError } = await client.from('profiles').select('*').in('id', userIds);
    if (profilesError) throw profilesError;
    const profileMap = new Map((profiles || []).map(item => [item.id,item]));
    return {
      session, user:session.user, profile, membership, universe,
      members:members.map(item => ({ ...item, profile:profileMap.get(item.user_id) || null }))
    };
  }

  async createUniverse({ universeName, displayName, partnerEmail }) {
    const { data, error } = await supabase().rpc('create_universe', {
      p_name:String(universeName).trim(),
      p_display_name:String(displayName).trim(),
      p_partner_email:String(partnerEmail || '').trim() || null
    });
    if (error) throw error;
    return data;
  }

  async joinUniverse({ inviteCode, displayName }) {
    const { data, error } = await supabase().rpc('join_universe', {
      p_invite_code:String(inviteCode).trim().toUpperCase(),
      p_display_name:String(displayName).trim()
    });
    if (error) throw error;
    return data;
  }

  async updateProfile(values) {
    const user = (await this.session())?.user;
    if (!user) throw new Error('Sesi sudah berakhir.');
    const allowed = {
      display_name:String(values.display_name || '').trim().slice(0,80),
      bio:String(values.bio || '').trim().slice(0,500),
      avatar_path:values.avatar_path || null,
      accent:values.accent || 'violet'
    };
    const { data, error } = await supabase().from('profiles').update(allowed).eq('id', user.id).select().single();
    if (error) throw error;
    return data;
  }

  async updateUniverse(values) {
    const payload = {};
    if ('name' in values) payload.name = String(values.name).trim().slice(0,120);
    if ('partner_email' in values) payload.partner_email = String(values.partner_email || '').trim().toLowerCase() || null;
    if ('settings' in values) payload.settings = values.settings;
    const { data, error } = await supabase().from('universes').update(payload).eq('id', values.id).select().single();
    if (error) throw error;
    return data;
  }

  async updatePartnerEmail(universeId, partnerEmail) {
    const { error } = await supabase().rpc('update_partner_email', {
      p_universe_id:universeId,
      p_partner_email:String(partnerEmail || '').trim().toLowerCase()
    });
    if (error) throw error;
  }

  async regenerateInviteCode(universeId) {
    const { data, error } = await supabase().rpc('regenerate_invite_code', { p_universe_id:universeId });
    if (error) throw error;
    return data;
  }
}

export const auth = new AuthService();
