import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' }
});

function firstSecretFromJson(name: string): string {
  try {
    const parsed = JSON.parse(Deno.env.get(name) || '{}');
    return Object.values(parsed).find(value => typeof value === 'string' && value.length > 20) as string || '';
  } catch {
    return '';
  }
}

function requiredEnv(name: string, fallback = ''): string {
  const value = Deno.env.get(name) || fallback;
  if (!value) throw new Error(`Secret ${name} belum diatur.`);
  return value;
}

function routeForType(type: string): string {
  return ({
    memory:'memories', gallery:'gallery', letter:'letters', note:'notes', wish:'wishes',
    music:'music', timeline:'timeline', capsule:'time-capsules', file:'files'
  } as Record<string,string>)[type] || 'activity';
}

function notificationCopy(eventType: string, actor: string, entry: any, emoji = '') {
  if (eventType === 'test') return {
    title:'💫 Sinyal cinta berhasil',
    body:'OUR UNIVERSE sudah siap mengirim kabar romantis ke perangkat ini.',
    kind:'test'
  };

  const privateEntry = Boolean(entry?.metadata?.secret) || entry?.type === 'capsule';
  if (eventType === 'comment_created') return {
    title:'💬 Pesan baru di semesta kalian',
    body:`${actor} meninggalkan sebuah pesan pada kenangan kalian.`,
    kind:'comment'
  };
  if (eventType === 'reaction_created') return {
    title:`${emoji || '❤️'} Sebuah reaksi dari ${actor}`,
    body:'Salah satu kenangan kalian baru saja disentuh dengan perasaan.',
    kind:'reaction'
  };
  if (privateEntry) return {
    title:'🌙 Sesuatu yang rahasia telah dititipkan',
    body:`${actor} menambahkan sesuatu yang hanya menjadi milik semesta kalian.`,
    kind:'entry'
  };

  const map: Record<string,{title:string,body:string}> = {
    memory:{title:'✨ Bintang baru telah lahir',body:`${actor} menambahkan sebuah kenangan baru.`},
    gallery:{title:'📷 Sebuah momen baru tiba',body:`${actor} menyimpan foto atau video baru.`},
    letter:{title:'💌 Surat baru mengorbit',body:`${actor} menulis sebuah surat untuk semesta kalian.`},
    note:{title:'📝 Catatan baru dari hati',body:`${actor} menambahkan sebuah catatan baru.`},
    wish:{title:'🌠 Impian baru dinyalakan',body:`${actor} menambahkan harapan baru untuk kalian.`},
    music:{title:'🎵 Lagu baru mulai mengorbit',body:`${actor} menambahkan musik untuk perjalanan kalian.`},
    timeline:{title:'🪐 Perjalanan kalian bertambah',body:`${actor} menambahkan bagian baru pada timeline.`},
    file:{title:'📎 Sebuah berkas baru tersimpan',body:`${actor} menambahkan sesuatu ke semesta kalian.`}
  };
  return { ...(map[entry?.type] || {title:'✦ Semesta kalian bertambah terang',body:`${actor} menambahkan sesuatu yang baru.`}), kind:'entry' };
}

Deno.serve(async request => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers:corsHeaders });
  if (request.method !== 'POST') return json({ error:'Method not allowed' }, 405);

  try {
    const authorization = request.headers.get('Authorization') || '';
    if (!authorization.startsWith('Bearer ')) return json({ error:'Sesi tidak ditemukan.' }, 401);

    const supabaseUrl = requiredEnv('SUPABASE_URL');
    const secretKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
      || Deno.env.get('SUPABASE_SECRET_KEY')
      || firstSecretFromJson('SUPABASE_SECRET_KEYS');
    if (!secretKey) throw new Error('Secret key server Supabase tidak tersedia pada Edge Function.');

    const vapidPublic = requiredEnv('VAPID_PUBLIC_KEY');
    const vapidPrivate = requiredEnv('VAPID_PRIVATE_KEY');
    const vapidSubject = requiredEnv('VAPID_SUBJECT');
    const appOrigin = requiredEnv('APP_ORIGIN').replace(/\/$/, '');
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    const admin = createClient(supabaseUrl, secretKey, {
      auth:{ persistSession:false, autoRefreshToken:false }
    });
    const token = authorization.slice('Bearer '.length);
    const { data:{ user }, error:userError } = await admin.auth.getUser(token);
    if (userError || !user) return json({ error:'Sesi tidak valid.' }, 401);

    const body = await request.json().catch(() => ({}));
    const eventType = String(body.event_type || '');
    const universeId = String(body.universe_id || '');
    const resourceId = body.resource_id ? String(body.resource_id) : null;
    if (!['entry_created','comment_created','reaction_created','test'].includes(eventType)) return json({ error:'Jenis notifikasi tidak valid.' }, 400);
    if (!/^[0-9a-f-]{36}$/i.test(universeId)) return json({ error:'Semesta tidak valid.' }, 400);

    const { data:membership } = await admin.from('universe_members')
      .select('universe_id,user_id').eq('universe_id',universeId).eq('user_id',user.id).maybeSingle();
    if (!membership) return json({ error:'Akses ke semesta ditolak.' }, 403);

    let entry:any = null;
    let emoji = '';
    let validatedResourceId = resourceId;

    if (eventType === 'entry_created') {
      if (!resourceId) return json({ error:'ID kenangan wajib diisi.' }, 400);
      const { data, error } = await admin.from('entries')
        .select('id,universe_id,created_by,type,title,metadata,unlock_at')
        .eq('id',resourceId).eq('universe_id',universeId).eq('created_by',user.id).maybeSingle();
      if (error || !data) return json({ error:'Kenangan tidak ditemukan atau bukan milik pengirim.' }, 404);
      entry = data;
    }

    if (eventType === 'comment_created') {
      if (!resourceId) return json({ error:'ID komentar wajib diisi.' }, 400);
      const { data:comment, error } = await admin.from('comments')
        .select('id,entry_id,universe_id,user_id').eq('id',resourceId).eq('universe_id',universeId).eq('user_id',user.id).maybeSingle();
      if (error || !comment) return json({ error:'Komentar tidak ditemukan.' }, 404);
      const { data } = await admin.from('entries').select('id,type,title,metadata,unlock_at').eq('id',comment.entry_id).maybeSingle();
      entry = data;
      validatedResourceId = comment.id;
    }

    if (eventType === 'reaction_created') {
      if (!resourceId) return json({ error:'ID reaksi wajib diisi.' }, 400);
      const { data:reaction, error } = await admin.from('reactions')
        .select('id,entry_id,universe_id,user_id,emoji').eq('id',resourceId).eq('universe_id',universeId).eq('user_id',user.id).maybeSingle();
      if (error || !reaction) return json({ error:'Reaksi tidak ditemukan.' }, 404);
      const { data } = await admin.from('entries').select('id,type,title,metadata,unlock_at').eq('id',reaction.entry_id).maybeSingle();
      entry = data;
      emoji = reaction.emoji || '';
      validatedResourceId = reaction.id;
    }

    const { data:actorProfile } = await admin.from('profiles').select('display_name').eq('id',user.id).maybeSingle();
    const actorName = String(actorProfile?.display_name || 'Seseorang').slice(0,80);

    const { data:members, error:memberError } = await admin.from('universe_members')
      .select('user_id').eq('universe_id',universeId);
    if (memberError) throw memberError;
    const recipientIds = eventType === 'test'
      ? [user.id]
      : (members || []).map(row => row.user_id).filter(id => id !== user.id);
    if (!recipientIds.length) return json({ delivered:0, reason:'Pasangan belum bergabung.' });

    const eventKey = eventType === 'test'
      ? `test:${user.id}:${crypto.randomUUID()}`
      : `${eventType}:${validatedResourceId}:${user.id}`;
    const { data:eventRow, error:eventError } = await admin.from('push_delivery_events').insert({
      event_key:eventKey, universe_id:universeId, actor_id:user.id, event_type:eventType, resource_id:validatedResourceId
    }).select('id').single();
    if (eventError?.code === '23505') return json({ delivered:0, duplicate:true });
    if (eventError) throw eventError;

    const [{ data:preferences }, { data:subscriptions, error:subscriptionError }] = await Promise.all([
      admin.from('notification_preferences').select('*').eq('universe_id',universeId).in('user_id',recipientIds),
      admin.from('push_subscriptions').select('*').eq('universe_id',universeId).in('user_id',recipientIds).eq('enabled',true)
    ]);
    if (subscriptionError) throw subscriptionError;

    const preferenceMap = new Map((preferences || []).map(row => [row.user_id,row]));
    const preferenceColumn = eventType === 'entry_created' ? 'entry_created' : eventType === 'comment_created' ? 'comment_created' : eventType === 'reaction_created' ? 'reaction_created' : null;
    const eligible = (subscriptions || []).filter(subscription => {
      const pref = preferenceMap.get(subscription.user_id);
      if (!pref) return true;
      if (!pref.enabled) return false;
      return preferenceColumn ? pref[preferenceColumn] !== false : true;
    });

    const copy = notificationCopy(eventType, actorName, entry, emoji);
    const entryId = entry?.id || null;
    const route = entry ? routeForType(entry.type) : 'settings';
    const targetUrl = `${appOrigin}/#${route}${entryId ? `?entry=${encodeURIComponent(entryId)}` : ''}`;
    const payload = JSON.stringify({
      title:copy.title,
      body:copy.body,
      icon:`${appOrigin}/icons/icon-192.png`,
      badge:`${appOrigin}/icons/icon-192.png`,
      url:targetUrl,
      tag:`our-universe-${eventType}-${validatedResourceId || 'test'}`,
      kind:copy.kind,
      entry_id:entryId,
      event_type:eventType,
      created_at:new Date().toISOString()
    });

    let delivered = 0;
    let failed = 0;
    const staleIds:string[] = [];
    await Promise.all(eligible.map(async subscription => {
      try {
        await webpush.sendNotification({
          endpoint:subscription.endpoint,
          keys:{ p256dh:subscription.p256dh, auth:subscription.auth }
        }, payload, { TTL:60 * 60 * 24, urgency:'high', topic:`ou-${eventType}` });
        delivered += 1;
      } catch (error:any) {
        failed += 1;
        if ([404,410].includes(Number(error?.statusCode))) staleIds.push(subscription.id);
        console.error('Push delivery failed', error?.statusCode || '', error?.message || error);
      }
    }));

    if (staleIds.length) await admin.from('push_subscriptions').delete().in('id',staleIds);
    await admin.from('push_delivery_events').update({ attempted:eligible.length, delivered, failed }).eq('id',eventRow.id);
    return json({ attempted:eligible.length, delivered, failed });
  } catch (error) {
    console.error(error);
    return json({ error:error instanceof Error ? error.message : 'Pengiriman notifikasi gagal.' }, 500);
  }
});
