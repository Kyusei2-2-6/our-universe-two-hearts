import { state } from '../core/state.js';
import { repository } from '../core/repository.js';
import { removeFiles } from '../core/storage.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';

const PHRASE='HAPUS DAN BANGUN ULANG';

export function needsV4Rebuild(){return state.get('universe')?.settings?.rebuilt_v4!==true;}

export function openRebuildGate({onComplete}={}){
  const owner=state.get('membership')?.role==='owner';
  const content=document.createElement('section');content.className='rebuild-gate';
  if(!owner){content.innerHTML='<div class="rebuild-gate__planet"><span>✦</span></div><p class="eyebrow">OUR UNIVERSE v4</p><h2>Semesta sedang menunggu pemiliknya.</h2><p>Penjaga pertama perlu menyelesaikan pembangunan ulang satu kali. Akun, hubungan kalian, login, dan notifikasi tetap aman.</p><button class="button button--ghost" type="button" data-refresh>Muat ulang status</button>';const modal=openModal({title:'',content,className:'rebuild-gate-modal',dismissible:false});content.querySelector('[data-refresh]').onclick=()=>location.reload();return modal;}
  content.innerHTML=`<div class="rebuild-gate__planet"><span>＋</span></div><p class="eyebrow">PEMBANGUNAN ULANG SEKALI PAKAI</p><h2>Mulai dari nol, tanpa mengulang setup.</h2><p>Isi lama, file lama, periode, komentar, dan reaksi akan dihapus permanen. Akun kalian, pasangan, URL, Supabase, GitHub, profil, dan notifikasi tetap dipertahankan.</p><div class="rebuild-gate__preserved"><span>✓ Dua akun</span><span>✓ Login</span><span>✓ Profil</span><span>✓ Push notification</span><span>✓ Project Supabase</span></div><label class="field"><span>Ketik kalimat konfirmasi</span><input class="input" data-confirm autocomplete="off" placeholder="${PHRASE}"></label><div class="rebuild-gate__progress" hidden><strong data-progress-title>Menyiapkan reset…</strong><div><span data-progress-bar></span></div><small data-progress-copy>Jangan tutup halaman.</small></div><button class="button button--danger" type="button" data-reset disabled>Hapus isi lama dan bangun OUR UNIVERSE v4</button>`;
  const modal=openModal({title:'',content,className:'rebuild-gate-modal',dismissible:false});
  const input=content.querySelector('[data-confirm]');const button=content.querySelector('[data-reset]');input.oninput=()=>button.disabled=input.value.trim()!==PHRASE;
  button.onclick=async()=>{button.disabled=true;input.disabled=true;const progress=content.querySelector('.rebuild-gate__progress');progress.hidden=false;try{setProgress(8,'Membaca file lama…','Mengumpulkan media yang akan dihapus.');const paths=await repository.listAllContentFilePaths();setProgress(22,'Menghapus media lama…',`${paths.length} file ditemukan.`);for(let i=0;i<paths.length;i+=80){await removeFiles(paths.slice(i,i+80));setProgress(22+Math.round((i+80)/Math.max(1,paths.length)*50),'Menghapus media lama…',`${Math.min(i+80,paths.length)} dari ${paths.length} file.`);}setProgress(78,'Membersihkan database lama…','Akun dan notifikasi tidak disentuh.');const result=await repository.resetUniverseV4(PHRASE);setProgress(100,'Semesta baru siap.','Membuka ruang kosong untuk planet pertama kalian.');toast(`Reset selesai. ${result?.entries_deleted||0} isi lama dihapus.`);setTimeout(()=>{modal.close();onComplete?.();},900);}catch(error){toast(error.message,{type:'error',duration:8000});button.disabled=false;input.disabled=false;setProgress(0,'Reset berhenti','Tidak ada langkah lanjutan yang dijalankan. Coba lagi setelah koneksi stabil.');}};
  function setProgress(value,title,copy){content.querySelector('[data-progress-bar]').style.width=`${Math.max(0,Math.min(100,value))}%`;content.querySelector('[data-progress-title]').textContent=title;content.querySelector('[data-progress-copy]').textContent=copy;}
  return modal;
}
