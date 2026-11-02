import { CONFIG } from '../config.js';

const MODES = {
  cinematic: { stars:9000, galaxy:14500, asteroids:120, pixelRatio:1.6, fps:55, bloom:true, afterimage:false, nebula:7 },
  balanced: { stars:4200, galaxy:6800, asteroids:52, pixelRatio:1.2, fps:36, bloom:false, afterimage:false, nebula:4 },
  saver: { stars:1500, galaxy:2600, asteroids:20, pixelRatio:.9, fps:24, bloom:false, afterimage:false, nebula:2 }
};

function detectMode() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return 'saver';
  const memory = navigator.deviceMemory || 4;
  const cores = navigator.hardwareConcurrency || 4;
  const mobile = matchMedia('(pointer: coarse)').matches || innerWidth < 760;
  if (!mobile && memory >= 8 && cores >= 8) return 'cinematic';
  if (memory <= 3 || cores <= 4) return 'saver';
  return 'balanced';
}

export function getPerformanceMode() {
  const stored = localStorage.getItem('our-universe-performance') || CONFIG.DEFAULT_PERFORMANCE;
  return stored === 'auto' ? detectMode() : (MODES[stored] ? stored : detectMode());
}

export function getPerformanceProfile(mode = getPerformanceMode()) {
  return { mode, ...MODES[mode] };
}

export function setPerformanceMode(mode) {
  if (!['auto','cinematic','balanced','saver'].includes(mode)) throw new Error('Mode performa tidak valid.');
  localStorage.setItem('our-universe-performance', mode);
}
