import { events } from './event-bus.js';

export async function registerPWA() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const hadController=Boolean(navigator.serviceWorker.controller);
    const registration = await navigator.serviceWorker.register('./sw.js', { scope:'./', updateViaCache:'none' });
    registration.addEventListener('updatefound', () => events.emit('pwa:update', { registration }));
    if(hadController){
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        if(sessionStorage.getItem('our-universe-sw-reloaded')==='1')return;
        sessionStorage.setItem('our-universe-sw-reloaded','1');
        location.reload();
      },{once:true});
      window.setTimeout(()=>sessionStorage.removeItem('our-universe-sw-reloaded'),12000);
    }
  } catch (error) {
    console.warn('Service Worker tidak dapat didaftarkan:', error);
  }
}

export async function requestNotifications() {
  if (!('Notification' in window)) throw new Error('Notifikasi tidak didukung browser ini.');
  return Notification.requestPermission();
}

export async function scheduleCapsuleNotification(capsule) {
  if (!('serviceWorker' in navigator) || Notification.permission !== 'granted') return false;
  const delay = new Date(capsule.unlockAt).getTime() - Date.now();
  if (delay <= 0 || delay > 2147483647) return false;
  setTimeout(async () => {
    const registration = await navigator.serviceWorker.ready;
    registration.showNotification('Time Capsule Terbuka', {
      body: capsule.title,
      icon: './icons/icon-192.png',
      badge: './icons/icon-192.png',
      data: { url: './#time-capsule' }
    });
  }, delay);
  return true;
}
