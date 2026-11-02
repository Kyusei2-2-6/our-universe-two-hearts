import { auth } from '../core/auth.js';
import { isSupabaseConfigured, setRuntimeSupabaseConfig } from '../core/supabase.js';
import { toast } from './toast.js';

export function renderConfigurationGate(root, onConfigured) {
  root.hidden=false;
  root.innerHTML='';
  const card=document.createElement('section');card.className='setup-error glass-panel';
  card.innerHTML=`<p class="eyebrow">KONFIGURASI PERTAMA</p><h1>Hubungkan semesta ke Supabase.</h1><p class="muted">Proyek ini belum memiliki URL dan publishable key Supabase. Cara permanen yang paling aman adalah menjalankan <code>npm run configure</code> di Termux lalu push. Untuk pengujian di HP ini saja, masukkan nilai sementara di bawah.</p><form class="auth-form" data-config-form><div class="field"><label>Project URL</label><input class="input" name="url" type="url" required placeholder="https://xxxx.supabase.co" autocomplete="url"></div><div class="field"><label>Publishable key</label><textarea class="textarea" name="key" required placeholder="sb_publishable_..."></textarea></div><button class="button button--primary" type="submit">Simpan di perangkat ini</button></form><hr><p class="muted">Jangan pernah menggunakan <strong>service_role key</strong> di browser. Gunakan publishable key atau anon key.</p>`;
  root.append(card);
  card.querySelector('form').onsubmit=event=>{
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    setRuntimeSupabaseConfig(form.get('url'),form.get('key'));
    if(!isSupabaseConfigured()){toast('URL atau key belum valid.',{type:'error'});return;}
    toast('Konfigurasi tersimpan untuk perangkat ini.');onConfigured?.();
  };
}

export function renderAuthGate(root, { onAuthenticated } = {}) {
  root.hidden=false;root.innerHTML='';
  const shell=document.createElement('section');shell.className='auth-shell glass-panel';
  shell.innerHTML=`<div class="auth-visual"><div class="auth-visual__copy"><p class="eyebrow">TWO HEARTS · ONE UNIVERSE</p><h1>Semesta privat untuk kalian berdua.</h1><p>Masuk untuk melanjutkan perjalanan atau buat akun yang akan menjadi salah satu dari dua penjaga semesta ini.</p></div></div><div class="auth-panel"><p class="eyebrow">OUR UNIVERSE</p><h2>Selamat datang.</h2><p class="auth-panel__lead">Tidak ada isi yang dapat dilihat sebelum masuk.</p><div class="auth-tabs"><button class="auth-tab is-active" type="button" data-tab="login">Masuk</button><button class="auth-tab" type="button" data-tab="signup">Buat akun</button></div><div data-form-host></div></div>`;
  root.append(shell);
  let tab='login';
  const host=shell.querySelector('[data-form-host]');
  const setTab=next=>{tab=next;shell.querySelectorAll('[data-tab]').forEach(btn=>btn.classList.toggle('is-active',btn.dataset.tab===next));renderForm();};
  shell.querySelectorAll('[data-tab]').forEach(btn=>btn.onclick=()=>setTab(btn.dataset.tab));

  function renderForm(){
    host.innerHTML='';
    const form=document.createElement('form');form.className='auth-form';
    if(tab==='login'){
      form.innerHTML=`<div class="field"><label>Email</label><input class="input" name="email" type="email" autocomplete="email" required></div><div class="field"><label>Kata sandi</label><input class="input" name="password" type="password" autocomplete="current-password" minlength="6" required></div><button class="button button--primary" type="submit">Masuk ke semesta</button><button class="link-button" type="button" data-reset>Lupa kata sandi?</button>`;
      form.querySelector('[data-reset]').onclick=async()=>{
        const email=form.elements.email.value.trim();
        if(!email){toast('Isi email terlebih dahulu.');return;}
        try{await auth.resetPassword(email);toast('Tautan pemulihan sudah dikirim.');}catch(error){toast(error.message,{type:'error'});}
      };
    }else{
      form.innerHTML=`<div class="field"><label>Nama tampilan</label><input class="input" name="displayName" maxlength="80" required placeholder="Nama yang akan terlihat oleh pasangan"></div><div class="field"><label>Email</label><input class="input" name="email" type="email" autocomplete="email" required></div><div class="field"><label>Kata sandi</label><input class="input" name="password" type="password" autocomplete="new-password" minlength="8" required></div><div class="auth-note">Membuat akun belum otomatis membuka isi semesta. Akun kedua tetap membutuhkan kode undangan dari pasangan.</div><button class="button button--primary" type="submit">Buat salah satu dari dua akun</button>`;
    }
    form.onsubmit=async event=>{
      event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
      try{
        const values=Object.fromEntries(new FormData(form));
        if(tab==='login') await auth.signIn(values.email,values.password);
        else {
          const result=await auth.signUp(values);
          if(!result.session){toast('Akun dibuat. Periksa email untuk konfirmasi, lalu masuk.');setTab('login');return;}
        }
        await onAuthenticated?.();
      }catch(error){toast(error.message,{type:'error',duration:5200});}
      finally{button.disabled=false;}
    };
    host.append(form);
  }
  renderForm();
}

export function renderOnboarding(root, context, { onComplete, onSignOut } = {}) {
  root.hidden=false;root.innerHTML='';
  const card=document.createElement('section');card.className='onboarding-card glass-panel';
  card.innerHTML=`<p class="eyebrow">LANGKAH PERTAMA</p><h2>Bangun atau temukan semesta kalian.</h2><p class="muted">Satu semesta hanya menerima dua anggota. Setelah pasangan bergabung, pintu undangan akan tertutup.</p><div class="onboarding-choices"><button class="onboarding-choice is-active" type="button" data-choice="create"><span>✦</span><strong>Buat semesta baru</strong><p>Untuk orang pertama. Kamu akan menerima kode undangan.</p></button><button class="onboarding-choice" type="button" data-choice="join"><span>☾</span><strong>Gabung dengan pasangan</strong><p>Masukkan kode undangan dari orang pertama.</p></button></div><div data-onboarding-form></div><button class="link-button" type="button" data-signout style="margin-top:18px">Keluar dari akun ini</button>`;
  root.append(card);
  let choice='create';const host=card.querySelector('[data-onboarding-form]');
  card.querySelector('[data-signout]').onclick=()=>onSignOut?.();
  card.querySelectorAll('[data-choice]').forEach(button=>button.onclick=()=>{choice=button.dataset.choice;card.querySelectorAll('[data-choice]').forEach(item=>item.classList.toggle('is-active',item===button));renderForm();});
  function renderForm(){
    host.innerHTML='';const form=document.createElement('form');form.className='auth-form';
    if(choice==='create') form.innerHTML=`<div class="field"><label>Nama kamu di semesta</label><input class="input" name="displayName" required maxlength="80" value="${escapeAttribute(context.profile?.display_name || '')}"></div><div class="field"><label>Nama semesta</label><input class="input" name="universeName" required maxlength="120" placeholder="Semesta Kita"></div><div class="field"><label>Email pasangan</label><input class="input" name="partnerEmail" type="email" placeholder="Disarankan agar kode hanya bisa dipakai email ini"></div><button class="button button--primary" type="submit">Nyalakan bintang pertama</button>`;
    else form.innerHTML=`<div class="field"><label>Nama kamu di semesta</label><input class="input" name="displayName" required maxlength="80" value="${escapeAttribute(context.profile?.display_name || '')}"></div><div class="field"><label>Kode undangan</label><input class="input" name="inviteCode" required maxlength="20" autocapitalize="characters" placeholder="Contoh: A1B2C3D4E5"></div><button class="button button--primary" type="submit">Gabung ke semesta</button>`;
    form.onsubmit=async event=>{
      event.preventDefault();const button=form.querySelector('[type=submit]');button.disabled=true;
      try{const values=Object.fromEntries(new FormData(form));if(choice==='create') await auth.createUniverse(values);else await auth.joinUniverse(values);toast(choice==='create'?'Semesta baru telah lahir.':'Kalian sekarang berada di semesta yang sama.');await onComplete?.();}catch(error){toast(error.message,{type:'error',duration:6000});}finally{button.disabled=false;}
    };host.append(form);
  }renderForm();
}

function escapeAttribute(value){return String(value).replace(/[&"<>]/g,char=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[char]));}
