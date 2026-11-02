import { state } from '../core/state.js';
import { auth } from '../core/auth.js';
import { repository } from '../core/repository.js';
import { uploadAvatar, signedUrl } from '../core/storage.js';
import { initials } from '../core/utils.js';
import { openModal } from './modal.js';
import { openPlanetComposer } from './planet-composer.js';
import { toast } from './toast.js';

export function openProfileMenu({ onRefresh, onNavigate, onSignOut, onPlanetCreated } = {}) {
  const snapshot = state.snapshot;
  const content = document.createElement('div');
  content.className = 'profile-menu profile-hub';

  const pair = document.createElement('div');
  pair.className = 'profile-pair-list';
  for (const member of snapshot.members || []) {
    pair.append(createMemberButton(member, {
      currentUserId:snapshot.user?.id,
      onOpen:chosen => {
        modal.close();
        openMemberProfile(chosen, { onRefresh });
      }
    }));
  }

  const universeCard = document.createElement('section');
  universeCard.className = 'profile-universe-card';
  const memberCount = snapshot.members?.length || 0;
  universeCard.innerHTML = '<div><small></small><strong></strong><p></p></div><span>♡</span>';
  universeCard.querySelector('small').textContent = memberCount >= 2 ? 'SEMESTA PRIVAT BERDUA' : 'MENUNGGU PASANGAN';
  universeCard.querySelector('strong').textContent = snapshot.universe?.name || 'OUR UNIVERSE';
  universeCard.querySelector('p').textContent = memberCount >= 2
    ? 'Hanya kalian berdua yang dapat masuk dan membangun planet di sini.'
    : `Kode undangan: ${snapshot.universe?.invite_code || '-'}`;

  if (memberCount < 2) {
    universeCard.tabIndex = 0;
    universeCard.role = 'button';
    universeCard.title = 'Salin kode undangan';
    universeCard.onclick = async () => {
      await navigator.clipboard.writeText(snapshot.universe?.invite_code || '');
      toast('Kode undangan disalin.');
    };
  }

  const actions = document.createElement('div');
  actions.className = 'profile-menu__actions profile-menu__actions--simple';
  const create = button('＋ Ciptakan planet', 'button--primary');
  create.onclick = () => {
    modal.close();
    openPlanetComposer({ onSaved:onPlanetCreated });
  };
  const activity = button('◎ Aktivitas');
  activity.onclick = () => {
    modal.close();
    onNavigate?.('activity');
  };
  const settings = button('⚙ Pengaturan');
  settings.onclick = () => {
    modal.close();
    onNavigate?.('settings');
  };
  const logout = button('Keluar', 'button--danger');
  logout.onclick = async () => {
    logout.disabled = true;
    try {
      await auth.signOut();
      modal.close();
      await onSignOut?.();
    } catch (error) {
      toast(error.message, { type:'error' });
    } finally {
      logout.disabled = false;
    }
  };

  actions.append(create, activity, settings, logout);
  content.append(pair, universeCard, actions);
  const modal = openModal({ title:'Kalian berdua', content });
  return modal;
}

export function openMemberProfile(member, { onRefresh } = {}) {
  if (!member) return null;
  const snapshot = state.snapshot;
  const isSelf = member.user_id === snapshot.user?.id;
  const online = Boolean((snapshot.presence || {})[member.user_id]?.length);
  const profile = member.profile || {};
  const content = document.createElement('div');
  content.className = 'member-profile member-profile--cosmic';

  const hero = document.createElement('section');
  hero.className = 'member-profile__hero member-profile__hero--cosmic';
  hero.innerHTML = `
    <div class="member-profile__constellation" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
    <div class="member-profile__avatar" data-avatar></div>
    <p class="eyebrow" data-role></p>
    <h2 data-name></h2>
    <p class="member-profile__nickname" data-nickname hidden></p>
    <p class="member-profile__bio" data-bio></p>
    <div class="member-profile__status"><span></span><strong></strong></div>
  `;
  hero.querySelector('[data-role]').textContent = isSelf ? 'COSMIC IDENTITY · KAMU' : 'COSMIC IDENTITY · PASANGAN';
  hero.querySelector('[data-name]').textContent = profile.display_name || 'Seseorang';
  const nickname=hero.querySelector('[data-nickname]');
  if(profile.nickname){nickname.hidden=false;nickname.textContent=`“${profile.nickname}”`;}
  hero.querySelector('[data-bio]').textContent = profile.bio || (isSelf ? 'Belum ada bio. Ceritakan sedikit tentang dirimu.' : 'Pasanganmu belum menulis bio.');
  hero.querySelector('.member-profile__status').classList.toggle('is-online', online);
  hero.querySelector('.member-profile__status strong').textContent = online ? 'Sedang online' : 'Sedang jauh dari layar';
  fillAvatar(hero.querySelector('[data-avatar]'), profile);

  const facts = document.createElement('div');
  facts.className = 'member-profile__facts member-profile__facts--cosmic';
  facts.append(
    createFact('Bergabung',formatDate(member.joined_at),'✦'),
    createFact('Ulang tahun',birthdayLabel(profile.birth_date),'🎂','birthday'),
    createFact('Menuju ultah',birthdayCountdown(profile.birth_date),'☾','birthday-countdown'),
    createFact('Planet dibuat','…','◉','planets'),
    createFact('Isi dibagikan','…','⌁','entries')
  );

  const identity = createIdentitySection(profile,isSelf);

  const actions = document.createElement('div');
  actions.className = 'member-profile__actions';
  if (isSelf) {
    const edit = button('✎ Edit Cosmic Identity', 'button--primary');
    edit.onclick = () => {
      modal.close();
      openProfileEditor({ onRefresh });
    };
    actions.append(edit);
  } else {
    const note = document.createElement('p');
    note.className = 'member-profile__private-note';
    note.textContent = 'Identitas ini hanya dapat diubah oleh pasanganmu.';
    actions.append(note);
  }

  content.append(hero, facts, identity, actions);
  const modal = openModal({ title:isSelf ? 'Profil saya' : 'Profil pasangan', content });
  loadMemberStats(member.user_id, facts);
  return modal;
}

function createIdentitySection(profile,isSelf){
  const section=document.createElement('section');
  section.className='member-profile__identity-card';
  const header=document.createElement('header');
  header.innerHTML='<div><small>PERSONAL CONSTELLATION</small><strong>Hal kecil yang membentuk dirinya</strong></div><span>✧</span>';
  const grid=document.createElement('div');grid.className='member-profile__identity-grid';
  const items=[
    ['Nama panggilan',profile.nickname,'♡'],
    ['Asal atau kota',profile.hometown,'⌖'],
    ['Love language',profile.love_language,'∞'],
    ['Hal favorit',profile.favorite_things,'✦']
  ].filter(([,value])=>value);
  for(const [label,value,icon] of items){
    const article=document.createElement('article');
    const mark=document.createElement('span');mark.textContent=icon;
    const copy=document.createElement('div');const small=document.createElement('small');small.textContent=label;const strong=document.createElement('strong');strong.textContent=value;copy.append(small,strong);article.append(mark,copy);grid.append(article);
  }
  if(!items.length){
    const empty=document.createElement('p');empty.className='member-profile__identity-empty';empty.textContent=isSelf?'Lengkapi identitasmu agar pasanganmu mengenal semesta kecil di dalam dirimu.':'Pasanganmu belum mengisi detail identitasnya.';grid.append(empty);
  }
  section.append(header,grid);
  if(profile.personal_quote){const quote=document.createElement('blockquote');quote.textContent=profile.personal_quote;section.append(quote);}
  return section;
}

function createFact(label,value,icon,key=''){
  const node=document.createElement('div');
  if(key)node.dataset.profileFact=key;
  const mark=document.createElement('span');mark.textContent=icon;
  const small=document.createElement('small');small.textContent=label;
  const strong=document.createElement('strong');strong.textContent=value;
  node.append(mark,small,strong);
  return node;
}

function createMemberButton(member, { currentUserId, onOpen }) {
  const isSelf = member.user_id === currentUserId;
  const online = Boolean((state.get('presence') || {})[member.user_id]?.length);
  const profile = member.profile || {};
  const node = document.createElement('button');
  node.type = 'button';
  node.className = 'profile-person-card';
  node.innerHTML = `
    <span class="profile-person-card__avatar" data-avatar></span>
    <span class="profile-person-card__copy">
      <small>${isSelf ? 'KAMU' : 'PASANGAN'}</small>
      <strong></strong>
      <em>${online ? 'Online sekarang' : (profile.nickname ? `Dipanggil ${profile.nickname}` : 'Lihat profil')}</em>
    </span>
    <span class="profile-person-card__arrow">›</span>
  `;
  node.querySelector('strong').textContent = profile.display_name || 'Seseorang';
  node.classList.toggle('is-online', online);
  fillAvatar(node.querySelector('[data-avatar]'), profile);
  node.onclick = () => onOpen?.(member);
  return node;
}

async function loadMemberStats(userId, host) {
  try {
    const [planetCount, entryCount] = await Promise.all([
      repository.countPlanetsByCreator(userId),
      repository.countEntriesByCreator(userId)
    ]);
    host.querySelector('[data-profile-fact="planets"] strong').textContent = String(planetCount);
    host.querySelector('[data-profile-fact="entries"] strong').textContent = String(entryCount);
  } catch {
    host.querySelector('[data-profile-fact="planets"] strong').textContent = '—';
    host.querySelector('[data-profile-fact="entries"] strong').textContent = '—';
  }
}

function fillAvatar(host, profile) {
  host.textContent = initials(profile?.display_name);
  if (!profile?.avatar_path) return;
  signedUrl(profile.avatar_path).then(url => {
    host.innerHTML = '';
    const img = document.createElement('img');
    img.src = url;
    img.alt = '';
    host.append(img);
  }).catch(() => {});
}

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('id-ID', { day:'numeric', month:'short', year:'numeric' }).format(new Date(value));
  } catch {
    return '—';
  }
}

function birthdayLabel(value){
  const date=parseDateOnly(value);if(!date)return'Belum diisi';
  const age=calculateAge(date);
  const dayMonth=new Intl.DateTimeFormat('id-ID',{day:'numeric',month:'long'}).format(date);
  return age===null?dayMonth:`${dayMonth} · ${age} th`;
}

function birthdayCountdown(value){
  const birth=parseDateOnly(value);if(!birth)return'Belum diisi';
  const today=startOfDay(new Date());
  let next=new Date(today.getFullYear(),birth.getMonth(),birth.getDate());
  if(next<today)next=new Date(today.getFullYear()+1,birth.getMonth(),birth.getDate());
  const days=Math.round((next-today)/86400000);
  if(days===0)return'Hari ini 🎉';
  if(days===1)return'Besok';
  return`${days} hari lagi`;
}

function calculateAge(birth){
  const today=new Date();if(birth>today)return null;
  let age=today.getFullYear()-birth.getFullYear();
  const beforeBirthday=today.getMonth()<birth.getMonth()||(today.getMonth()===birth.getMonth()&&today.getDate()<birth.getDate());
  if(beforeBirthday)age-=1;
  return Math.max(0,age);
}

function parseDateOnly(value){
  if(!value)return null;const date=new Date(`${value}T12:00:00`);return Number.isFinite(date.getTime())?date:null;
}
function startOfDay(date){const copy=new Date(date);copy.setHours(0,0,0,0);return copy;}

function button(label, variant = 'button--ghost') {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = `button ${variant}`;
  node.textContent = label;
  return node;
}

function openProfileEditor({ onRefresh } = {}) {
  const snapshot = state.snapshot;
  const profile=snapshot.profile||{};
  const form = document.createElement('form');
  form.className = 'auth-form profile-editor profile-editor--cosmic';
  form.innerHTML = `
    <section class="profile-editor__section">
      <header><span>✦</span><div><small>IDENTITAS UTAMA</small><strong>Bagaimana kamu dikenal di semesta ini</strong></div></header>
      <div class="profile-editor__grid">
        <div class="field"><label>Nama tampilan</label><input class="input" name="display_name" required maxlength="80"></div>
        <div class="field"><label>Nama panggilan</label><input class="input" name="nickname" maxlength="60" placeholder="Nama kesayangan atau panggilan"></div>
        <div class="field"><label>Tanggal lahir</label><input class="input" name="birth_date" type="date"></div>
        <div class="field"><label>Asal atau kota</label><input class="input" name="hometown" maxlength="100" placeholder="Contoh: Jambi"></div>
      </div>
    </section>
    <section class="profile-editor__section">
      <header><span>♡</span><div><small>PERSONAL CONSTELLATION</small><strong>Hal kecil yang penting tentang dirimu</strong></div></header>
      <div class="field"><label>Love language</label><input class="input" name="love_language" maxlength="80" list="love-language-options" placeholder="Contoh: Quality time"></div>
      <datalist id="love-language-options"><option value="Quality time"><option value="Words of affirmation"><option value="Acts of service"><option value="Physical touch"><option value="Receiving gifts"></datalist>
      <div class="field"><label>Hal favorit</label><textarea class="textarea" name="favorite_things" maxlength="300" rows="3" placeholder="Makanan, musik, tempat, warna, atau hal kecil yang kamu suka"></textarea></div>
      <div class="field"><label>Kalimat yang menggambarkanmu</label><textarea class="textarea" name="personal_quote" maxlength="240" rows="3" placeholder="Satu kalimat yang terasa seperti dirimu"></textarea></div>
      <div class="field"><label>Bio singkat</label><textarea class="textarea" name="bio" maxlength="500" rows="4"></textarea></div>
    </section>
    <section class="profile-editor__section profile-editor__section--avatar">
      <header><span>☾</span><div><small>WAJAH DI SEMESTA</small><strong>Foto profil</strong></div></header>
      <div class="field"><input class="input" name="avatar" type="file" accept="image/*"></div>
    </section>
    <button class="button button--primary profile-editor__save" type="submit">Simpan Cosmic Identity</button>
  `;
  for(const field of ['display_name','nickname','birth_date','hometown','love_language','favorite_things','personal_quote','bio']){
    if(form.elements[field])form.elements[field].value=profile[field]||'';
  }
  form.elements.birth_date.max=new Date().toISOString().slice(0,10);
  const modal = openModal({ title:'Edit Cosmic Identity', content:form });
  form.onsubmit = async event => {
    event.preventDefault();
    const save = form.querySelector('button[type="submit"]');
    save.disabled = true;
    save.textContent='Menyimpan identitas…';
    try {
      let avatarPath = profile.avatar_path || null;
      const file = form.elements.avatar.files[0];
      if (file) avatarPath = await uploadAvatar({ universeId:snapshot.universe.id, userId:snapshot.user.id, file });
      await auth.updateProfile({
        display_name:form.elements.display_name.value,
        nickname:form.elements.nickname.value,
        birth_date:form.elements.birth_date.value,
        hometown:form.elements.hometown.value,
        love_language:form.elements.love_language.value,
        favorite_things:form.elements.favorite_things.value,
        personal_quote:form.elements.personal_quote.value,
        bio:form.elements.bio.value,
        avatar_path:avatarPath,
        accent:profile.accent
      });
      toast('Cosmic Identity berhasil diperbarui.', { type:'success' });
      modal.close();
      await onRefresh?.();
      window.dispatchEvent(new CustomEvent('our-universe:refresh',{detail:{source:'profile'}}));
    } catch (error) {
      toast(friendlyProfileError(error), { type:'error',duration:6500 });
    } finally {
      save.disabled = false;
      save.textContent='Simpan Cosmic Identity';
    }
  };
}

function friendlyProfileError(error){
  const message=String(error?.message||error||'');
  if(/nickname|birth_date|hometown|love_language|favorite_things|personal_quote|schema cache|column/i.test(message))return'Cosmic Identity membutuhkan SQL v4.9.3 ALL-IN-ONE di Supabase.';
  return message||'Profil belum dapat disimpan.';
}
