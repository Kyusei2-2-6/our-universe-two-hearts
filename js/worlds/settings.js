import { state } from '../core/state.js';
import { auth } from '../core/auth.js';
import { repository } from '../core/repository.js';
import { setPerformanceMode } from '../core/performance.js';
import { setDataMode } from '../core/data-mode.js';
import { downloadBlob } from '../core/utils.js';
import { worldHeader } from './shared.js';
import { toast } from '../components/toast.js';
import { notificationService } from '../core/notifications.js';

export async function renderSettings(container) {
  const snapshot = state.snapshot;
  const requestedSection = state.get('routeParams')?.section || 'appearance';
  container.innerHTML = '';
  container.append(worldHeader({
    eyebrow:'OUR UNIVERSE',
    title:'Pengaturan',
    subtitle:'Semua yang penting, diringkas dalam satu tempat.'
  }));

  const shell = document.createElement('div');
  shell.className = 'settings-simple';
  const nav = document.createElement('nav');
  nav.className = 'settings-simple__nav';
  nav.setAttribute('aria-label', 'Bagian pengaturan');
  const list = document.createElement('div');
  list.className = 'settings-simple__list';
  shell.append(nav, list);
  container.append(shell);

  const groups = new Map();
  const register = (id, icon, title, subtitle, content) => {
    const details = document.createElement('details');
    details.className = 'settings-group';
    details.dataset.section = id;
    details.innerHTML = `
      <summary>
        <span class="settings-group__icon">${icon}</span>
        <span class="settings-group__copy"><strong>${title}</strong><small>${subtitle}</small></span>
        <span class="settings-group__chevron">⌄</span>
      </summary>
      <div class="settings-group__body"></div>
    `;
    details.querySelector('.settings-group__body').append(content);
    details.addEventListener('toggle', () => {
      if (!details.open) return;
      for (const [otherId, other] of groups) if (otherId !== id) other.open = false;
      updateNav(id);
    });
    groups.set(id, details);
    list.append(details);

    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.target = id;
    button.innerHTML = `<span>${icon}</span><small>${title}</small>`;
    button.onclick = () => {
      details.open = true;
      details.scrollIntoView({ behavior:'smooth', block:'start' });
    };
    nav.append(button);
  };

  register('appearance', '✦', 'Tampilan', 'Tema, background, dan animasi.', createAppearanceForm(snapshot));
  register('notifications', '♡', 'Notifikasi', 'Kabar romantis di perangkat ini.', await createNotificationSettings());
  register('universe', '◎', 'Semesta', 'Nama semesta dan akses pasangan.', createUniverseForm(snapshot));
  register('account', '⌁', 'Akun & data', 'Kata sandi dan backup metadata.', createAccountPanel(snapshot));

  const initial = groups.has(requestedSection) ? requestedSection : 'appearance';
  groups.get(initial).open = true;
  updateNav(initial);
  requestAnimationFrame(() => {
    if (requestedSection !== 'appearance') groups.get(initial)?.scrollIntoView({ behavior:'smooth', block:'start' });
  });

  function updateNav(activeId) {
    for (const button of nav.querySelectorAll('button')) button.classList.toggle('is-active', button.dataset.target === activeId);
  }
}

function createAppearanceForm(snapshot) {
  const form = document.createElement('form');
  form.className = 'settings-compact-form';
  form.innerHTML = `
    <div class="field"><label>Warna antarmuka</label><select class="select" name="theme"><option value="violet">Violet</option><option value="rose">Rose</option><option value="aurora">Aurora</option><option value="gold">Golden</option></select></div>
    <div class="field"><label>Background alam semesta</label><select class="select" name="space_theme"><option value="solar-system">Solar System Journey</option><option value="milky-way">Milky Way</option><option value="saturn-dream">Saturn Dream</option><option value="lunar-ocean">Lunar Ocean</option><option value="rose-cosmos">Rose Cosmos</option></select><small class="muted">Planet tata surya hanya menjadi background, bukan tombol menu.</small></div>
    <div class="field"><label>Mode animasi</label><select class="select" name="performance"><option value="auto">Otomatis</option><option value="cinematic">Sinematik penuh</option><option value="balanced">Seimbang</option><option value="saver">Hemat daya</option></select></div>
    <div class="field"><label>Penggunaan data media</label><select class="select" name="data_mode"><option value="auto">Otomatis sesuai HP dan jaringan</option><option value="economy">Hemat data</option><option value="balanced">Seimbang</option></select><small class="muted">Media hanya dimuat ketika terlihat. Mode hemat menampilkan 6 kenangan per halaman.</small></div>
    <button class="button button--primary" type="submit">Simpan tampilan</button>
  `;
  form.elements.theme.value = snapshot.universe?.settings?.theme || 'violet';
  form.elements.space_theme.value = snapshot.universe?.settings?.space_theme || 'solar-system';
  form.elements.performance.value = localStorage.getItem('our-universe-performance') || 'auto';
  form.elements.data_mode.value = localStorage.getItem('our-universe-data-mode') || 'auto';
  form.onsubmit = async event => {
    event.preventDefault();
    const save = form.querySelector('[type=submit]');
    save.disabled = true;
    try {
      const settings = {
        ...(snapshot.universe?.settings || {}),
        theme:form.elements.theme.value,
        space_theme:form.elements.space_theme.value,
        content_model:'dynamic-planets'
      };
      await auth.updateUniverse({ id:snapshot.universe.id, settings });
      setPerformanceMode(form.elements.performance.value);
      setDataMode(form.elements.data_mode.value);
      toast('Tampilan disimpan. Memuat ulang…');
      setTimeout(() => location.reload(), 450);
    } catch (error) {
      toast(error.message, { type:'error' });
      save.disabled = false;
    }
  };
  return form;
}

function createUniverseForm(snapshot) {
  const wrapper = document.createElement('div');
  wrapper.className = 'settings-compact-form';
  const form = document.createElement('form');
  form.className = 'settings-compact-form';
  form.innerHTML = '<div class="field"><label>Nama semesta</label><input class="input" name="name" required maxlength="120"></div><button class="button button--primary" type="submit">Simpan nama</button>';
  form.elements.name.value = snapshot.universe?.name || '';
  form.onsubmit = async event => {
    event.preventDefault();
    const save = form.querySelector('[type=submit]');
    save.disabled = true;
    try {
      await auth.updateUniverse({ id:snapshot.universe.id, name:form.elements.name.value });
      toast('Nama semesta diperbarui.', { type:'success' });
      window.dispatchEvent(new CustomEvent('our-universe:refresh',{detail:{source:'settings-name'}}));
    } catch (error) {
      toast(error.message, { type:'error' });
    } finally {
      save.disabled = false;
    }
  };
  wrapper.append(form);

  const members = snapshot.members || [];
  if (members.length >= 2) {
    const complete = document.createElement('div');
    complete.className = 'settings-info-card';
    complete.innerHTML = '<span>♡</span><div><strong>Dua penjaga sudah terhubung</strong><p>Semesta ini tertutup untuk akun lain.</p></div>';
    wrapper.append(complete);
  } else {
    const invite = document.createElement('div');
    invite.className = 'settings-invite-card';
    invite.innerHTML = '<div><small>KODE UNDANGAN</small><strong></strong></div><button class="button button--ghost" type="button">Salin</button>';
    invite.querySelector('strong').textContent = snapshot.universe?.invite_code || '-';
    invite.querySelector('button').onclick = async () => {
      await navigator.clipboard.writeText(snapshot.universe?.invite_code || '');
      toast('Kode undangan disalin.');
    };
    wrapper.append(invite);

    if (snapshot.membership?.role === 'owner') {
      const partnerForm = document.createElement('form');
      partnerForm.className = 'settings-compact-form settings-compact-form--subtle';
      partnerForm.innerHTML = '<div class="field"><label>Email pasangan</label><input class="input" name="partner_email" type="email" required><small class="muted">Dapat diubah sebelum pasangan bergabung.</small></div><button class="button button--ghost" type="submit">Perbarui email</button>';
      partnerForm.elements.partner_email.value = snapshot.universe?.partner_email || '';
      partnerForm.onsubmit = async event => {
        event.preventDefault();
        const save = partnerForm.querySelector('[type=submit]');
        save.disabled = true;
        try {
          await auth.updatePartnerEmail(snapshot.universe.id, partnerForm.elements.partner_email.value.trim().toLowerCase());
          toast('Email pasangan diperbarui.', { type:'success' });
          window.dispatchEvent(new CustomEvent('our-universe:refresh',{detail:{source:'settings-partner'}}));
        } catch (error) {
          toast(error.message, { type:'error' });
        } finally {
          save.disabled = false;
        }
      };
      wrapper.append(partnerForm);
    }
  }
  return wrapper;
}

function createAccountPanel(snapshot) {
  const wrapper = document.createElement('div');
  wrapper.className = 'settings-compact-form';

  const pass = document.createElement('form');
  pass.className = 'settings-compact-form';
  pass.innerHTML = '<div class="field"><label>Kata sandi baru</label><input class="input" name="password" type="password" minlength="8" required autocomplete="new-password"></div><button class="button button--primary" type="submit">Ganti kata sandi</button>';
  pass.onsubmit = async event => {
    event.preventDefault();
    const save = pass.querySelector('button');
    save.disabled = true;
    try {
      await auth.updatePassword(pass.elements.password.value);
      pass.reset();
      toast('Kata sandi diganti.');
    } catch (error) {
      toast(error.message, { type:'error' });
    } finally {
      save.disabled = false;
    }
  };

  const backup = document.createElement('div');
  backup.className = 'settings-info-card settings-info-card--backup';
  backup.innerHTML = '<span>⇩</span><div><strong>Backup metadata</strong><p>Menyimpan daftar planet dan susunan isi dalam JSON. File media tetap aman di Supabase.</p></div>';
  const exportButton = document.createElement('button');
  exportButton.type = 'button';
  exportButton.className = 'button button--ghost';
  exportButton.textContent = 'Ekspor JSON';
  exportButton.onclick = async () => {
    exportButton.disabled = true;
    try {
      const [planets, entries] = await Promise.all([
        repository.listPlanets(),
        repository.listEntries({ limit:10000 })
      ]);
      const payload = {
        version:4,
        exported_at:new Date().toISOString(),
        universe:{ id:snapshot.universe.id, name:snapshot.universe.name },
        planets,
        entries
      };
      downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type:'application/json' }), `our-universe-v4-${new Date().toISOString().slice(0, 10)}.json`);
      toast('Backup metadata dibuat.');
    } catch (error) {
      toast(error.message, { type:'error' });
    } finally {
      exportButton.disabled = false;
    }
  };
  backup.append(exportButton);
  wrapper.append(pass, backup);
  return wrapper;
}

async function createNotificationSettings() {
  const section = document.createElement('div');
  section.className = 'notification-panel notification-panel--compact';
  const status = document.createElement('div');
  status.className = 'notification-status';
  status.innerHTML = '<div class="notification-status__orb">✦</div><div><strong data-status-title>Memeriksa perangkat…</strong><span data-status-copy>Mohon tunggu.</span></div>';
  const options = document.createElement('div');
  options.className = 'notification-options';
  options.innerHTML = `
    <label class="notification-option"><input type="checkbox" data-pref="entry_created"><span><strong>Isi planet baru</strong><small>Foto, video, musik, surat, catatan, dan file.</small></span></label>
    <label class="notification-option"><input type="checkbox" data-pref="comment_created"><span><strong>Komentar baru</strong><small>Pesan baru dari pasangan.</small></span></label>
    <label class="notification-option"><input type="checkbox" data-pref="reaction_created"><span><strong>Reaksi baru</strong><small>Hati dan reaksi kecil.</small></span></label>
    <label class="notification-option"><input type="checkbox" data-pref="couple_message"><span><strong>Pesan Couple Connect</strong><small>Chat baru dari pasangan.</small></span></label>
    <label class="notification-option"><input type="checkbox" data-pref="couple_signal"><span><strong>Colek dan sinyal cinta</strong><small>Colek, hati, dan pesan kangen.</small></span></label>
    <label class="notification-option"><input type="checkbox" data-pref="foreground_sound"><span><strong>Nada romantis saat web aktif</strong><small>Chime khusus OUR UNIVERSE.</small></span></label>
  `;
  const toolbar = document.createElement('div');
  toolbar.className = 'toolbar notification-toolbar';
  const enable = actionButton('Aktifkan notifikasi', 'button--primary');
  const test = actionButton('Tes notifikasi');
  const disable = actionButton('Matikan di perangkat ini');
  toolbar.append(enable, test, disable);
  const note = document.createElement('p');
  note.className = 'muted settings-footnote';
  note.textContent = 'Saat web tertutup, Android menggunakan suara notifikasi sistem.';
  section.append(status, options, toolbar, note);

  async function refresh() {
    try {
      const snap = await notificationService.status();
      const title = status.querySelector('[data-status-title]');
      const copy = status.querySelector('[data-status-copy]');
      if (!snap.supported) {
        title.textContent = 'Web Push belum didukung';
        copy.textContent = 'Gunakan Chrome Android terbaru.';
      } else if (snap.permission === 'denied') {
        title.textContent = 'Izin diblokir';
        copy.textContent = 'Izinkan notifikasi dari pengaturan situs Chrome.';
      } else if (snap.subscribed) {
        title.textContent = 'Terhubung dengan semesta';
        copy.textContent = 'Perangkat ini siap menerima kabar.';
      } else {
        title.textContent = 'Belum diaktifkan';
        copy.textContent = 'Aktifkan satu kali di perangkat ini.';
      }
      for (const input of options.querySelectorAll('[data-pref]')) input.checked = (snap.preferences || {})[input.dataset.pref] !== false;
      enable.hidden = snap.subscribed;
      disable.hidden = !snap.subscribed;
      test.disabled = !snap.subscribed;
    } catch (error) {
      status.querySelector('[data-status-title]').textContent = 'Status tidak tersedia';
      status.querySelector('[data-status-copy]').textContent = error.message;
    }
  }

  enable.onclick = async () => {
    enable.disabled = true;
    try {
      await notificationService.enable();
      toast('Notifikasi aktif.');
      await refresh();
    } catch (error) {
      toast(error.message, { type:'error', duration:7000 });
    } finally {
      enable.disabled = false;
    }
  };
  disable.onclick = async () => {
    disable.disabled = true;
    try {
      await notificationService.disable();
      toast('Notifikasi dimatikan.');
      await refresh();
    } catch (error) {
      toast(error.message, { type:'error' });
    } finally {
      disable.disabled = false;
    }
  };
  test.onclick = async () => {
    test.disabled = true;
    try {
      await notificationService.test();
      toast('Sinyal tes dikirim.');
    } catch (error) {
      toast(error.message, { type:'error', duration:7000 });
    } finally {
      test.disabled = false;
    }
  };
  options.onchange = async event => {
    const input = event.target.closest('[data-pref]');
    if (!input) return;
    try {
      await notificationService.updatePreferences({ [input.dataset.pref]:input.checked });
      toast('Pilihan disimpan.');
    } catch (error) {
      input.checked = !input.checked;
      toast(error.message, { type:'error' });
    }
  };
  await refresh();
  return section;
}

function actionButton(label, variant = 'button--ghost') {
  const node = document.createElement('button');
  node.type = 'button';
  node.className = `button ${variant}`;
  node.textContent = label;
  return node;
}
