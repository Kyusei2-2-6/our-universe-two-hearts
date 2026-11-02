import { events } from './event-bus.js';
import { clamp } from './utils.js';

class AudioEngine {
  #context;
  #master;
  #ambient;
  #current;
  #next;
  #volume = .22;
  #enabled = false;

  configure({ ambientElement, volume = .22, enabled = false }) {
    this.#ambient = ambientElement;
    this.#volume = clamp(volume, 0, 1);
    this.#enabled = enabled;
    if (this.#ambient) { this.#ambient.volume = this.#volume * .55; this.#ambient.muted = !this.#enabled; if (!this.#enabled) this.#ambient.pause(); }
  }

  async ensureContext() {
    if (!this.#context) {
      this.#context = new AudioContext();
      this.#master = this.#context.createGain();
      this.#master.gain.value = this.#volume;
      this.#master.connect(this.#context.destination);
    }
    if (this.#context.state === 'suspended') await this.#context.resume();
  }

  async playAmbient() {
    if (!this.#ambient || !this.#enabled) return;
    await this.ensureContext();
    try { await this.#ambient.play(); } catch { /* browser requires direct interaction */ }
  }

  pauseAmbient() { this.#ambient?.pause(); }

  async setEnabled(enabled) {
    this.#enabled = Boolean(enabled);
    if (this.#ambient) { this.#ambient.muted = !this.#enabled; if (enabled) await this.playAmbient(); else this.pauseAmbient(); }
    events.emit('audio:enabled', { enabled: this.#enabled });
  }

  setVolume(value) {
    this.#volume = clamp(Number(value), 0, 1);
    if (this.#ambient) this.#ambient.volume = this.#volume * .55;
    if (this.#master && this.#context) this.#master.gain.setTargetAtTime(this.#volume, this.#context.currentTime, .08);
  }

  async playTrack(song, crossfadeSeconds = 3) {
    await this.ensureContext();
    const audio = new Audio(song.src);
    audio.crossOrigin = 'anonymous';
    audio.loop = false;
    const source = this.#context.createMediaElementSource(audio);
    const gain = this.#context.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(this.#master);
    this.#next = { audio, source, gain, song };
    await audio.play();
    const now = this.#context.currentTime;
    gain.gain.linearRampToValueAtTime(1, now + crossfadeSeconds);
    if (this.#current) {
      this.#current.gain.gain.cancelScheduledValues(now);
      this.#current.gain.gain.linearRampToValueAtTime(0, now + crossfadeSeconds);
      const retiring = this.#current;
      setTimeout(() => { retiring.audio.pause(); retiring.audio.src = ''; }, crossfadeSeconds * 1000 + 100);
    }
    this.#current = this.#next;
    this.#next = null;
    audio.addEventListener('ended', () => events.emit('audio:ended', { song }), { once:true });
    events.emit('audio:track', { song });
  }

  toggleTrack() {
    if (!this.#current) return false;
    if (this.#current.audio.paused) this.#current.audio.play(); else this.#current.audio.pause();
    return !this.#current.audio.paused;
  }

  stopTrack() {
    if (!this.#current) return;
    this.#current.audio.pause();
    this.#current.audio.currentTime = 0;
    this.#current = null;
  }

  get enabled() { return this.#enabled; }
  get currentSong() { return this.#current?.song ?? null; }
}
export const audioEngine = new AudioEngine();
