import { state } from '../core/state.js';
import { auth } from '../core/auth.js';
import { repository } from '../core/repository.js';
import { setPerformanceMode } from '../core/performance.js';
import { downloadBlob } from '../core/utils.js';
import { worldHeader } from './shared.js';
import { toast } from '../components/toast.js';
import { notificationService } from '../core/notifications.js';

export async function renderSettings(container){
  const snapshot=state.snapshot;container.innerHTML='';container.append(worldHeader({eyebrow:'SETTINGS',title:'Atur cara semesta bernafas.',subtitle:'Pengaturan bersama tersimpan di database. Pengaturan performa disimpan pada masing-masing perangkat.'}));
  const grid=document.createElement('div');grid.className='content-grid';
  const universe=panel('Semesta bersama');const universeForm=document.createElement('form');universeForm.className='auth-form';universeForm.innerHTML='<div class="field"><label>Nama semesta</label><input class="input" name="name" required maxlength="120"></div><div class="field"><label>Email pasangan yang diizinkan</label><input class="input" name="partner_email" type="email" required><small class="muted" data-partner-help></small></div><div class="field"><label>Tema cahaya</label><select class="select" name="theme"><option value="violet">Violet Galaxy</option><option value="rose">Rose Nebula</option><option value="aurora">Aurora</option><option value="gold">Golden Moon</option></select></div><div class="field"><label>Tema alam semesta</label><select class="select" name="space_theme"><option value="milky-way">Bima Sakti</option><option value="saturn-dream">Saturn Dream</option><option value="lunar-ocean">Lunar Ocean</option><option value="rose-cosmos">Rose Cosmos</option></select><small class="muted">Mengubah warna planet, Bima Sakti, planet menu, dan atmosfer galaksi.</small></div><button class="button button--primary" type="submit">Simpan pengaturan bersama</button>';universeForm.elements.name.value=snapshot.universe?.name||'';universeForm.elements.partner_email.value=snapshot.universe?.partner_email||'';universeForm.elements.theme.value=snapshot.universe?.settings?.theme||'violet';universeForm.elements.space_theme.value=snapshot.universe?.settings?.space_theme||'milky-way';const mayChangePartner=snapshot.members?.length<2&&snapshot.membership?.role==='owner';universeForm.elements.partner_email.disabled=!mayChangePartner;universeForm.querySelector('[data-partner-help]').textContent=mayChangePartner?'Hanya dapat diubah oleh penjaga pertama sebelum akun kedua dibuat.':'Email dikunci setelah akun kedua dibuat atau untuk anggota kedua.';universeForm.onsubmit=async event=>{event.preventDefault();const button=universeForm.querySelector('button');button.disabled=true;try{const settings={...(snapshot.universe?.settings||{}),theme:universeForm.elements.theme.value,space_theme:universeForm.elements.space_theme.value};const nextPartner=universeForm.elements.partner_email.value.trim().toLowerCase();if(mayChangePartner&&nextPartner!==String(snapshot.universe?.partner_email||'').toLowerCase())await auth.updatePartnerEmail(snapshot.universe.id,nextPartner);await auth.updateUniverse({id:snapshot.universe.id,name:universeForm.elements.name.value,settings});document.documentElement.dataset.theme=settings.theme;document.documentElement.dataset.spaceTheme=settings.space_theme;toast('Tema semesta disimpan. Muat ulang agar planet dan Bima Sakti memakai tema baru.');}catch(error){toast(error.message,{type:'error'});}finally{button.disabled=false;}};universe.append(universeForm);grid.append(universe);

  const invite=panel('Undangan pasangan');if((snapshot.members||[]).length>=2){invite.append(text('Semesta sudah lengkap. Tidak ada akun ketiga yang dapat bergabung.'));}else{const code=document.createElement('div');code.className='invite-code';code.innerHTML='<div><small class="muted">Kode undangan aktif</small><br><code></code></div><button class="button button--ghost" type="button">Salin</button>';code.querySelector('code').textContent=snapshot.universe?.invite_code||'-';code.querySelector('button').onclick=async()=>{await navigator.clipboard.writeText(snapshot.universe?.invite_code||'');toast('Kode disalin.');};const regenerate=document.createElement('button');regenerate.type='button';regenerate.className='button button--ghost';regenerate.textContent='Buat kode baru';regenerate.onclick=async()=>{regenerate.disabled=true;try{const next=await auth.regenerateInviteCode(snapshot.universe.id);code.querySelector('code').textContent=next;toast('Kode lama tidak berlaku lagi.');}catch(error){toast(error.message,{type:'error'});}finally{regenerate.disabled=false;}};invite.append(code,regenerate,text('Gunakan email pasangan di panel sebelah agar kode hanya dapat dipakai oleh email tersebut.'));}grid.append(invite);

  const performance=panel('Performa perangkat');const perfForm=document.createElement('form');perfForm.className='auth-form';perfForm.innerHTML='<div class="field"><label>Mode animasi</label><select class="select" name="mode"><option value="auto">Otomatis</option><option value="cinematic">Sinematik penuh</option><option value="balanced">Seimbang</option><option value="saver">Hemat daya</option></select></div><p class="muted">Perubahan diterapkan setelah halaman dimuat ulang. Mode ini hanya berlaku di perangkat yang sedang dipakai.</p><button class="button button--primary" type="submit">Simpan dan muat ulang</button>';perfForm.elements.mode.value=localStorage.getItem('our-universe-performance')||'auto';perfForm.onsubmit=event=>{event.preventDefault();setPerformanceMode(perfForm.elements.mode.value);location.reload();};performance.append(perfForm);grid.append(performance);

  const notifications=panel('Notifikasi romantis');notifications.classList.add('notification-panel');grid.append(notifications);await renderNotificationSettings(notifications);

  const security=panel('Keamanan akun');const passForm=document.createElement('form');passForm.className='auth-form';passForm.innerHTML='<div class="field"><label>Kata sandi baru</label><input class="input" name="password" type="password" minlength="8" required autocomplete="new-password"></div><button class="button button--primary" type="submit">Ganti kata sandi</button>';passForm.onsubmit=async event=>{event.preventDefault();const button=passForm.querySelector('button');button.disabled=true;try{await auth.updatePassword(passForm.elements.password.value);passForm.reset();toast('Kata sandi akun telah diganti.');}catch(error){toast(error.message,{type:'error'});}finally{button.disabled=false;}};security.append(passForm);grid.append(security);

  const backup=panel('Backup metadata');backup.append(text('File JSON ini mencatat isi dan susunan semesta. Media asli tetap aman di Storage dan tidak ikut disalin ke JSON.'));const exportButton=document.createElement('button');exportButton.type='button';exportButton.className='button button--ghost';exportButton.textContent='Ekspor metadata JSON';exportButton.onclick=async()=>{exportButton.disabled=true;try{const [entries,periods]=await Promise.all([repository.listEntries({limit:10000}),repository.listPeriods()]);const payload={version:2,exported_at:new Date().toISOString(),universe:{id:snapshot.universe.id,name:snapshot.universe.name},periods,entries};downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`our-universe-backup-${new Date().toISOString().slice(0,10)}.json`);toast('Backup metadata dibuat.');}catch(error){toast(error.message,{type:'error'});}finally{exportButton.disabled=false;}};backup.append(exportButton);grid.append(backup);
  container.append(grid);
}
function panel(title){const section=document.createElement('section');section.className='world-panel glass-panel';section.style.gridColumn='span 6';const heading=document.createElement('h3');heading.style.marginTop='0';heading.textContent=title;section.append(heading);return section;}
function text(value){const p=document.createElement('p');p.className='muted';p.style.lineHeight='1.65';p.textContent=value;return p;}


async function renderNotificationSettings(section){
  const intro=text('Saat salah satu dari kalian menambahkan kenangan, komentar, atau reaksi, perangkat pasangan dapat menerima kabar walaupun web sedang tidak dibuka.');
  const status=document.createElement('div');status.className='notification-status';status.innerHTML='<div class="notification-status__orb">✦</div><div><strong data-status-title>Memeriksa perangkat…</strong><span data-status-copy>Mohon tunggu sebentar.</span></div>';
  const options=document.createElement('div');options.className='notification-options';options.innerHTML=`
    <label class="notification-option"><input type="checkbox" data-pref="entry_created"><span><strong>Kenangan dan isi baru</strong><small>Foto, video, surat, musik, wish, catatan, dan file baru.</small></span></label>
    <label class="notification-option"><input type="checkbox" data-pref="comment_created"><span><strong>Komentar baru</strong><small>Pesan yang ditulis pasangan pada salah satu kenangan.</small></span></label>
    <label class="notification-option"><input type="checkbox" data-pref="reaction_created"><span><strong>Reaksi baru</strong><small>Hati, bulan, dan reaksi kecil dari pasangan.</small></span></label>
    <label class="notification-option"><input type="checkbox" data-pref="foreground_sound"><span><strong>Nada romantis saat web aktif</strong><small>Memainkan chime khusus OUR UNIVERSE ketika web atau PWA sedang terbuka.</small></span></label>`;
  const toolbar=document.createElement('div');toolbar.className='toolbar';
  const enable=document.createElement('button');enable.type='button';enable.className='button button--primary';enable.textContent='Aktifkan notifikasi';
  const test=document.createElement('button');test.type='button';test.className='button button--ghost';test.textContent='Tes notifikasi';
  const disable=document.createElement('button');disable.type='button';disable.className='button button--ghost';disable.textContent='Matikan di perangkat ini';
  toolbar.append(enable,test,disable);
  const note=document.createElement('p');note.className='notification-note muted';note.textContent='Catatan: ketika web tertutup, Android memakai suara notifikasi sistem. Nada romantis khusus berbunyi saat web atau PWA sedang aktif karena browser tidak mengizinkan situs memaksa suara khusus dari latar belakang.';
  section.append(intro,status,options,toolbar,note);

  let snapshot=null;
  async function refresh(){
    try{
      snapshot=await notificationService.status();
      status.dataset.active=String(snapshot.subscribed&&snapshot.permission==='granted');
      const title=status.querySelector('[data-status-title]');const copy=status.querySelector('[data-status-copy]');
      if(!snapshot.supported){title.textContent='Perangkat belum mendukung Web Push';copy.textContent='Gunakan Chrome Android terbaru.';}
      else if(snapshot.permission==='denied'){title.textContent='Izin notifikasi diblokir';copy.textContent='Buka ikon pengaturan situs di Chrome lalu izinkan Notifikasi.';}
      else if(snapshot.subscribed){title.textContent='Terhubung dengan semesta';copy.textContent='Perangkat ini siap menerima kabar dari pasangan.';}
      else{title.textContent='Belum diaktifkan';copy.textContent='Tekan Aktifkan notifikasi satu kali pada perangkat ini.';}
      const prefs=snapshot.preferences||{};
      for(const input of options.querySelectorAll('[data-pref]'))input.checked=prefs[input.dataset.pref]!==false;
      enable.hidden=snapshot.subscribed;disable.hidden=!snapshot.subscribed;test.disabled=!snapshot.subscribed;
    }catch(error){status.querySelector('[data-status-title]').textContent='Status belum dapat dibaca';status.querySelector('[data-status-copy]').textContent=error.message;}
  }

  enable.onclick=async()=>{enable.disabled=true;try{await notificationService.enable();toast('Notifikasi romantis aktif di perangkat ini.');await refresh();}catch(error){toast(error.message,{type:'error',duration:7000});}finally{enable.disabled=false;}};
  disable.onclick=async()=>{disable.disabled=true;try{await notificationService.disable();toast('Notifikasi dimatikan di perangkat ini.');await refresh();}catch(error){toast(error.message,{type:'error'});}finally{disable.disabled=false;}};
  test.onclick=async()=>{test.disabled=true;try{const result=await notificationService.test();toast(result?.delivered?'Sinyal tes dikirim.':'Tes diproses. Pastikan notifikasi diizinkan.');}catch(error){toast(error.message,{type:'error',duration:7000});}finally{test.disabled=false;}};
  options.onchange=async event=>{const input=event.target.closest('[data-pref]');if(!input)return;try{await notificationService.updatePreferences({[input.dataset.pref]:input.checked});if(input.dataset.pref==='foreground_sound'&&input.checked)await notificationService.playChime();toast('Pilihan notifikasi disimpan.');}catch(error){input.checked=!input.checked;toast(error.message,{type:'error'});}};
  await refresh();
}
