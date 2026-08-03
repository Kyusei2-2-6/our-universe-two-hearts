import { CONFIG } from '../config.js';

const MODES = {
  cinematic: { stars:10500, galaxy:18000, asteroids:160, pixelRatio:1.8, fps:60, bloom:true, afterimage:true, nebula:8 },
  balanced: { stars:6500, galaxy:10500, asteroids:90, pixelRatio:1.45, fps:45, bloom:true, afterimage:false, nebula:6 },
  saver: { stars:3200, galaxy:5200, asteroids:45, pixelRatio:1.1, fps:30, bloom:false, afterimage:false, nebula:4 }
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
