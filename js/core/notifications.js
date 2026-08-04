import { CONFIG } from '../config.js';
import { supabase } from './supabase.js';
import { toast } from '../components/toast.js';

function urlBase64ToUint8Array(value) {
  const padding='='.repeat((4-value.length%4)%4);
  const base64=(value+padding).replace(/-/g,'+').replace(/_/g,'/');
  const raw=atob(base64);
  return Uint8Array.from([...raw].map(char=>char.charCodeAt(0)));
}

function deviceName() {
  const ua=navigator.userAgent;
  if (/Android/i.test(ua)) return 'Android';
  if (/iPhone|iPad|iPod/i.test(ua)) return 'iPhone/iPad';
  if (/Windows/i.test(ua)) return 'Windows';
  if (/Macintosh/i.test(ua)) return 'Mac';
  return 'Browser';
}

class NotificationService {
  universeId=null;
  userId=null;
  profile=null;
  listenerBound=false;
  preferences=null;
  chime=null;

  get supported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  configure({ universeId, userId, profile } = {}) {
    this.universeId=universeId||null;
    this.userId=userId||null;
    this.profile=profile||null;
    if(!this.chime){
      this.chime=new Audio(new URL('../../music/romantic-chime.wav',import.meta.url));
      this.chime.preload='auto';this.chime.volume=.58;
    }
    if(!this.listenerBound&&'serviceWorker' in navigator){
      navigator.serviceWorker.addEventListener('message',event=>this.handleServiceWorkerMessage(event));
      this.listenerBound=true;
    }
  }

  async loadPreferences() {
    if(!this.universeId||!this.userId)return null;
    const {data,error}=await supabase().from('notification_preferences').select('*')
      .eq('universe_id',this.universeId).eq('user_id',this.userId).maybeSingle();
    if(error&&error.code!=='PGRST116')throw error;
    this.preferences=data||{
      universe_id:this.universeId,user_id:this.userId,enabled:true,
      entry_created:true,comment_created:true,reaction_created:true,foreground_sound:true
    };
    return this.preferences;
  }

  async status() {
    const result={supported:this.supported,permission:'default',subscribed:false,preferences:null};
    if(!this.supported)return result;
    result.permission=Notification.permission;
    const registration=await navigator.serviceWorker.ready;
    result.subscribed=Boolean(await registration.pushManager.getSubscription());
    try{result.preferences=await this.loadPreferences();}catch{}
    return result;
  }

  async enable() {
    if(!this.supported)throw new Error('Browser ini belum mendukung Web Push. Gunakan Chrome Android terbaru.');
    if(!this.universeId||!this.userId)throw new Error('Semesta belum aktif.');
    if(!CONFIG.VAPID_PUBLIC_KEY||CONFIG.VAPID_PUBLIC_KEY.length<50)throw new Error('VAPID Public Key belum dipasang. Jalankan npm run setup:notifications.');
    const permission=await Notification.requestPermission();
    if(permission!=='granted')throw new Error('Izin notifikasi belum diberikan. Aktifkan dari pengaturan situs Chrome.');
    const registration=await navigator.serviceWorker.ready;
    let subscription=await registration.pushManager.getSubscription();
    if(!subscription){
      subscription=await registration.pushManager.subscribe({
        userVisibleOnly:true,
        applicationServerKey:urlBase64ToUint8Array(CONFIG.VAPID_PUBLIC_KEY)
      });
    }
    const serialized=subscription.toJSON();
    if(!serialized.endpoint||!serialized.keys?.p256dh||!serialized.keys?.auth)throw new Error('Browser tidak mengembalikan kunci langganan push.');
    const {error}=await supabase().from('push_subscriptions').upsert({
      universe_id:this.universeId,user_id:this.userId,endpoint:serialized.endpoint,
      p256dh:serialized.keys.p256dh,auth:serialized.keys.auth,
      device_name:deviceName(),user_agent:navigator.userAgent.slice(0,500),enabled:true,last_seen_at:new Date().toISOString()
    },{onConflict:'endpoint'});
    if(error)throw error;
    const preferences=await this.loadPreferences();
    const {data,error:preferenceError}=await supabase().from('notification_preferences').upsert({
      ...preferences,universe_id:this.universeId,user_id:this.userId,enabled:true
    },{onConflict:'universe_id,user_id'}).select().single();
    if(preferenceError)throw preferenceError;
    this.preferences=data;
    await this.unlockChime();
    return subscription;
  }

  async disable() {
    if(!this.supported)return;
    const registration=await navigator.serviceWorker.ready;
    const subscription=await registration.pushManager.getSubscription();
    if(subscription){
      await supabase().from('push_subscriptions').delete().eq('endpoint',subscription.endpoint).eq('user_id',this.userId);
      await subscription.unsubscribe().catch(()=>false);
    }
    if(this.universeId&&this.userId){
      await supabase().from('notification_preferences').upsert({
        universe_id:this.universeId,user_id:this.userId,enabled:false
      },{onConflict:'universe_id,user_id'});
    }
    if(this.preferences)this.preferences.enabled=false;
  }

  async updatePreferences(values) {
    if(!this.universeId||!this.userId)throw new Error('Semesta belum aktif.');
    const allowed={};
    for(const key of ['enabled','entry_created','comment_created','reaction_created','foreground_sound']){
      if(key in values)allowed[key]=Boolean(values[key]);
    }
    const {data,error}=await supabase().from('notification_preferences').upsert({
      universe_id:this.universeId,user_id:this.userId,...allowed
    },{onConflict:'universe_id,user_id'}).select().single();
    if(error)throw error;
    this.preferences=data;
    return data;
  }

  async send(eventType,{resourceId=null}={}) {
    if(!this.universeId)return {skipped:true};
    const {data,error}=await supabase().functions.invoke('send-romantic-push',{body:{
      event_type:eventType,universe_id:this.universeId,resource_id:resourceId
    }});
    if(error)throw error;
    if(data?.error)throw new Error(data.error);
    return data;
  }

  async test() {
    await this.enable();
    return this.send('test');
  }

  async unlockChime() {
    if(!this.chime)return;
    const volume=this.chime.volume;
    try{
      this.chime.volume=.001;await this.chime.play();this.chime.pause();this.chime.currentTime=0;
    }catch{}
    this.chime.volume=volume;
  }

  async playChime() {
    const preferences=this.preferences||await this.loadPreferences().catch(()=>null);
    if(preferences?.foreground_sound===false||!this.chime)return;
    try{this.chime.currentTime=0;await this.chime.play();}catch{}
    navigator.vibrate?.([90,55,130]);
  }

  async handleServiceWorkerMessage(event) {
    if(event.data?.type!=='ROMANTIC_PUSH')return;
    const payload=event.data.payload||{};
    await this.playChime();
    toast(`${payload.title||'✦ Kabar dari semesta'}\n${payload.body||''}`,{duration:7000});
    window.dispatchEvent(new CustomEvent('our-universe:romantic-push',{detail:payload}));
  }
}

export const notificationService=new NotificationService();
