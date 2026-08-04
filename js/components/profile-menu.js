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
  content.className = 'member-profile';

  const hero = document.createElement('section');
  hero.className = 'member-profile__hero';
  hero.innerHTML = `
    <div class="member-profile__avatar" data-avatar></div>
    <p class="eyebrow" data-role></p>
    <h2 data-name></h2>
    <p class="member-profile__bio" data-bio></p>
    <div class="member-profile__status"><span></span><strong></strong></div>
  `;
  hero.querySelector('[data-role]').textContent = isSelf ? 'PROFIL KAMU' : 'PROFIL PASANGAN';
  hero.querySelector('[data-name]').textContent = profile.display_name || 'Seseorang';
  hero.querySelector('[data-bio]').textContent = profile.bio || (isSelf ? 'Belum ada bio. Ceritakan sedikit tentang dirimu.' : 'Pasanganmu belum menulis bio.');
  hero.querySelector('.member-profile__status').classList.toggle('is-online', online);
  hero.querySelector('.member-profile__status strong').textContent = online ? 'Sedang online' : 'Sedang jauh dari layar';
  const avatar = hero.querySelector('[data-avatar]');
  fillAvatar(avatar, profile);

  const facts = document.createElement('div');
  facts.className = 'member-profile__facts';
  facts.innerHTML = `
    <div><small>Bergabung</small><strong>${formatDate(member.joined_at)}</strong></div>
    <div><small>Planet dibuat</small><strong data-planets>…</strong></div>
    <div><small>Isi dibagikan</small><strong data-entries>…</strong></div>
  `;

  const actions = document.createElement('div');
  actions.className = 'member-profile__actions';
  if (isSelf) {
    const edit = button('✎ Edit profil', 'button--primary');
    edit.onclick = () => {
      modal.close();
      openProfileEditor({ onRefresh });
    };
    actions.append(edit);
  } else {
    const note = document.createElement('p');
    note.className = 'member-profile__private-note';
    note.textContent = 'Profil ini hanya dapat diubah oleh pasanganmu.';
    actions.append(note);
  }

  content.append(hero, facts, actions);
  const modal = openModal({ title:isSelf ? 'Profil saya' : 'Profil pasangan', content });
  loadMemberStats(member.user_id, facts);
  return modal;
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
      <em>${online ? 'Online sekarang' : 'Lihat profil'}</em>
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
    const [planets, entries] = await Promise.all([
      repository.listPlanets(),
      repository.listEntries({ limit:10000 })
    ]);
    host.querySelector('[data-planets]').textContent = String(planets.filter(item => item.created_by === userId).length);
    host.querySelector('[data-entries]').textContent = String(entries.filter(item => item.created_by === userId).length);
  } catch {
    host.querySelector('[data-planets]').textContent = '—';
    host.querySelector('[data-entries]').textContent = '—';
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

function button(label, variant = 'button--ghost') {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = `button ${variant}`;
  node.textContent = label;
  return node;
}

function openProfileEditor({ onRefresh } = {}) {
  const snapshot = state.snapshot;
  const form = document.createElement('form');
  form.className = 'auth-form';
  form.innerHTML = `
    <div class="field"><label>Nama tampilan</label><input class="input" name="display_name" required maxlength="80"></div>
    <div class="field"><label>Bio singkat</label><textarea class="textarea" name="bio" maxlength="500"></textarea></div>
    <div class="field"><label>Foto profil</label><input class="input" name="avatar" type="file" accept="image/*"></div>
    <button class="button button--primary" type="submit">Simpan profil</button>
  `;
  form.elements.display_name.value = snapshot.profile?.display_name || '';
  form.elements.bio.value = snapshot.profile?.bio || '';
  const modal = openModal({ title:'Edit profil', content:form });
  form.onsubmit = async event => {
    event.preventDefault();
    const save = form.querySelector('button');
    save.disabled = true;
    try {
      let avatarPath = snapshot.profile?.avatar_path || null;
      const file = form.elements.avatar.files[0];
      if (file) avatarPath = await uploadAvatar({ universeId:snapshot.universe.id, userId:snapshot.user.id, file });
      await auth.updateProfile({
        display_name:form.elements.display_name.value,
        bio:form.elements.bio.value,
        avatar_path:avatarPath,
        accent:snapshot.profile?.accent
      });
      toast('Profil diperbarui.');
      modal.close();
      await onRefresh?.();
    } catch (error) {
      toast(error.message, { type:'error' });
    } finally {
      save.disabled = false;
    }
  };
}
