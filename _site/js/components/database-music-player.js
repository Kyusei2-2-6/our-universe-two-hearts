import { repository } from '../core/repository.js';
import { signedUrl } from '../core/storage.js';
import { audioEngine } from '../core/audio-engine.js';
import { events } from '../core/event-bus.js';
import { toast } from './toast.js';

const root = document.querySelector('#database-music-player');
const appShell = document.querySelector('#app-shell');

const elements = root ? {
  title:root.querySelector('[data-music-title]'),
  subtitle:root.querySelector('[data-music-subtitle]'),
  play:root.querySelector('[data-music-play]'),
  playIcon:root.querySelector('[data-music-play-icon]'),
  previous:root.querySelector('[data-music-previous]'),
  next:root.querySelector('[data-music-next]'),
  count:root.querySelector('[data-music-count]')
} : {};

let tracks = [];
let currentIndex = 0;
let isPlaying = false;
let isLoading = false;
let refreshTimer = 0;
let refreshGeneration = 0;

function makeTrackKey(entry, attachment) {
  return attachment.id || `${entry.id}:${attachment.file_path}`;
}

function cleanTitle(value = '') {
  return String(value).replace(/\.[a-z0-9]{1,8}$/i, '').replace(/[-_]+/g, ' ').trim();
}

function buildPlaylist(entries = []) {
  return entries.flatMap(entry => (entry.attachments || [])
    .filter(attachment => attachment.kind === 'audio' && attachment.file_path)
    .map(attachment => ({
      key:makeTrackKey(entry, attachment),
      id:entry.id,
      entryId:entry.id,
      attachmentId:attachment.id,
      source:'database-music',
      title:entry.title || cleanTitle(attachment.file_name) || 'Musik kita',
      fileName:attachment.file_name || 'Audio',
      filePath:attachment.file_path,
      mimeType:attachment.mime_type || 'audio/*'
    })));
}

function currentTrack() {
  return tracks[currentIndex] || null;
}

function setBusy(busy) {
  isLoading = Boolean(busy);
  root?.classList.toggle('is-loading', isLoading);
  for (const button of [elements.play, elements.previous, elements.next]) {
    if (button) button.disabled = isLoading || !tracks.length;
  }
}

function hidePlayer({ stop = false } = {}) {
  if (stop && audioEngine.currentSong?.source === 'database-music') audioEngine.stopTrack();
  isPlaying = false;
  if (root) root.hidden = true;
}

function updatePlayer() {
  if (!root) return;
  const track = currentTrack();
  const shouldShow = Boolean(track && appShell && !appShell.hidden);
  root.hidden = !shouldShow;
  if (!shouldShow) return;

  elements.title.textContent = track.title;
  elements.subtitle.textContent = track.fileName;
  elements.count.textContent = tracks.length > 1 ? `${currentIndex + 1}/${tracks.length}` : '1 lagu';
  elements.playIcon.textContent = isLoading ? '…' : isPlaying ? '❚❚' : '▶';
  elements.play.setAttribute('aria-label', isPlaying ? 'Jeda musik' : 'Putar musik');
  elements.previous.hidden = tracks.length < 2;
  elements.next.hidden = tracks.length < 2;
  root.classList.toggle('is-playing', isPlaying);
  setBusy(isLoading);
}

async function playTrack(index = currentIndex) {
  if (!tracks.length || isLoading) return;
  currentIndex = (index + tracks.length) % tracks.length;
  const track = currentTrack();
  if (!track) return;

  setBusy(true);
  updatePlayer();
  try {
    const src = await signedUrl(track.filePath);
    if (!src) throw new Error('Alamat audio tidak tersedia.');
    audioEngine.pauseAmbient();
    await audioEngine.playTrack({ ...track, src }, .35);
    isPlaying = true;
    localStorage.setItem('our-universe-last-music', track.key);
  } catch (error) {
    isPlaying = false;
    console.error('Database music player:', error);
    toast('Musik belum dapat diputar. Periksa file audio atau koneksi internet.', { type:'error' });
  } finally {
    setBusy(false);
    updatePlayer();
  }
}

async function togglePlayback() {
  const selected = currentTrack();
  const active = audioEngine.currentSong;
  if (!selected || isLoading) return;

  if (!active || active.source !== 'database-music' || active.key !== selected.key) {
    await playTrack(currentIndex);
    return;
  }

  isPlaying = audioEngine.toggleTrack();
  updatePlayer();
}

async function moveTrack(step) {
  if (!tracks.length || isLoading) return;
  await playTrack(currentIndex + step);
}

async function refreshPlaylist() {
  if (!root || !appShell || appShell.hidden || !repository.universeId) {
    hidePlayer();
    return;
  }

  const generation = ++refreshGeneration;
  try {
    const entries = await repository.listEntries({ type:'music', status:'active', limit:100 });
    if (generation !== refreshGeneration) return;

    const activeKey = audioEngine.currentSong?.source === 'database-music'
      ? audioEngine.currentSong.key
      : currentTrack()?.key || localStorage.getItem('our-universe-last-music');

    tracks = buildPlaylist(entries);
    if (!tracks.length) {
      hidePlayer({ stop:true });
      return;
    }

    const matchingIndex = tracks.findIndex(track => track.key === activeKey);
    currentIndex = matchingIndex >= 0 ? matchingIndex : Math.min(currentIndex, tracks.length - 1);
    isPlaying = Boolean(
      audioEngine.currentSong?.source === 'database-music' &&
      audioEngine.currentSong.key === currentTrack()?.key &&
      isPlaying
    );
    updatePlayer();
  } catch (error) {
    console.warn('Playlist musik database belum dapat dimuat:', error);
    hidePlayer();
  }
}

function scheduleRefresh(delay = 180) {
  clearTimeout(refreshTimer);
  refreshTimer = window.setTimeout(() => void refreshPlaylist(), delay);
}

if (root) {
  elements.play.addEventListener('click', () => void togglePlayback());
  elements.previous.addEventListener('click', () => void moveTrack(-1));
  elements.next.addEventListener('click', () => void moveTrack(1));

  events.on('audio:ended', event => {
    if (event.detail?.song?.source !== 'database-music') return;
    isPlaying = false;
    if (tracks.length > 1) void moveTrack(1);
    else updatePlayer();
  });

  events.on('audio:track', event => {
    const song = event.detail?.song;
    if (song?.source !== 'database-music') return;
    const index = tracks.findIndex(track => track.key === song.key);
    if (index >= 0) currentIndex = index;
    isPlaying = true;
    updatePlayer();
  });

  events.on('audio:enabled', event => {
    if (event.detail?.enabled && isPlaying) audioEngine.pauseAmbient();
  });

  events.on('realtime:change', event => {
    if (['entries', 'attachments'].includes(event.detail?.table)) scheduleRefresh(350);
  });
  events.on('data:changed', () => scheduleRefresh(350));

  const shellObserver = new MutationObserver(() => {
    if (appShell.hidden) hidePlayer({ stop:true });
    else scheduleRefresh(120);
  });
  shellObserver.observe(appShell, { attributes:true, attributeFilter:['hidden'] });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !appShell.hidden) scheduleRefresh(100);
  });

  if (!appShell.hidden) scheduleRefresh(100);
}
