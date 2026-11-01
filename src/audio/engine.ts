// Audio engine: one lazily-created AudioContext and the mixing graph.
//   sfx ─┐
//  cries ┼─> master (mute + hidden-tab fade) ─> limiter ─> output
//  music ─> duck ─┘
// Settings volumes are applied live. Nothing here ever throws: when audio is unavailable every call is a no-op.

import { on, store } from '../state/store';

export interface Buses {
  sfx: GainNode;
  cries: GainNode;
  music: GainNode;
  duck: GainNode;
  master: GainNode;
}

const MUTE_KEY = 'pg-muted';
const MUSIC_LEVEL = 0.8;

let ctx: AudioContext | null = null;
let buses: Buses | null = null;
let unlocked = false;
let hidden = typeof document !== 'undefined' && document.hidden;
let muted = readMuted();
let suspendTimer: ReturnType<typeof setTimeout> | null = null;
let duckUntil = 0;

const unlockListeners = new Set<() => void>();
const changeListeners = new Set<() => void>();

const settings = () => store.save.settings;
const clamp01 = (v: number) => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);
/** Perceptual volume curve for the 0..1 sliders. */
export const volumeCurve = (v: number) => clamp01(v) ** 1.5;

function readMuted() {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

type AudioContextCtor = typeof AudioContext;
function contextClass(): AudioContextCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function create(): boolean {
  if (ctx) return true;
  const Ctor = contextClass();
  if (!Ctor) return false;
  try {
    const c = new Ctor({ latencyHint: 'interactive' });
    const limiter = c.createDynamicsCompressor();
    limiter.threshold.value = -9;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    const output = c.createGain();
    output.gain.value = 0.9;
    const master = c.createGain();
    master.gain.value = 0;
    const sfx = c.createGain();
    const cries = c.createGain();
    const music = c.createGain();
    const duck = c.createGain();
    sfx.gain.value = cries.gain.value = music.gain.value = 0;
    sfx.connect(master);
    cries.connect(master);
    music.connect(duck).connect(master);
    master.connect(limiter).connect(output).connect(c.destination);
    ctx = c;
    buses = { sfx, cries, music, duck, master };
    applyVolumes(0.01);
    return true;
  } catch {
    ctx = null;
    buses = null;
    return false;
  }
}

/** Smoothly moves an AudioParam to `value` (never jumps, so no clicks). */
export function rampTo(param: AudioParam, value: number, seconds = 0.08) {
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + Math.max(0.005, seconds));
  } catch { /* ignore */ }
}

function applyVolumes(seconds = 0.08) {
  if (!buses) return;
  const s = settings();
  rampTo(buses.sfx.gain, s.sound ? volumeCurve(s.volume) : 0, seconds);
  rampTo(buses.cries.gain, s.cries ? volumeCurve(s.volume) : 0, seconds);
  rampTo(buses.music.gain, s.music ? volumeCurve(s.musicVolume) * MUSIC_LEVEL : 0, seconds);
  rampTo(buses.master.gain, muted || hidden ? 0 : 1, hidden ? 0.25 : seconds);
}

function notifyChange() {
  changeListeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });
}

/** The context, but only once a user gesture unlocked it (so sounds never pile up on a frozen clock). */
export function readyContext(): { c: AudioContext; buses: Buses } | null {
  if (!unlocked && typeof navigator !== 'undefined' && (navigator as Navigator & { userActivation?: { isActive: boolean } }).userActivation?.isActive) {
    unlockAudio();
  }
  if (!unlocked || !ctx || !buses || ctx.state === 'closed') return null;
  return { c: ctx, buses };
}

/** The context if it exists, unlocked or not (for decoding). */
export const existingContext = () => ctx;

export const isUnlocked = () => unlocked;

/** Must run inside a user gesture once; cheap to call on every pointerdown. */
export function unlockAudio(): void {
  if (unlocked && ctx?.state === 'running') return;
  if (!create() || !ctx) return;
  const first = !unlocked;
  unlocked = true;
  try {
    if (ctx.state !== 'running' && !hidden) void ctx.resume().catch(() => {});
    if (first) {
      // iOS needs a sound started inside the gesture.
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, 22050);
      src.connect(ctx.destination);
      src.start(0);
    }
  } catch { /* ignore */ }
  if (first) unlockListeners.forEach(fn => { try { fn(); } catch { /* ignore */ } });
}

export function onUnlock(fn: () => void) {
  unlockListeners.add(fn);
}

/** Called when settings or mute change (music starts/stops accordingly). */
export function onAudioChange(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

/** Temporarily lowers the music (fanfares, cries). `amount` 0..1 is how much to take away. */
export function duck(amount: number, seconds: number) {
  if (!ctx || !buses) return;
  const now = ctx.currentTime;
  const until = now + seconds;
  if (until <= duckUntil) return;
  duckUntil = until;
  const g = buses.duck.gain;
  try {
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(1 - clamp01(amount), now + 0.08);
    g.setValueAtTime(1 - clamp01(amount), until);
    g.linearRampToValueAtTime(1, until + 0.6);
  } catch { /* ignore */ }
}

// --- Mute ----------------------------------------------------------------

export const isMuted = () => muted;

export function setMuted(value: boolean) {
  if (muted === value) return;
  muted = value;
  try { localStorage.setItem(MUTE_KEY, value ? '1' : '0'); } catch { /* storage blocked */ }
  applyVolumes(0.15);
  notifyChange();
}

export function toggleMute(): boolean {
  setMuted(!muted);
  return muted;
}

export const musicAllowed = () => settings().music && !muted;
export const sfxAllowed = () => settings().sound && !muted;
export const criesAllowed = () => settings().cries && !muted;

// --- Listeners -----------------------------------------------------------

if (typeof document !== 'undefined') {
  const refresh = () => {
    applyVolumes();
    notifyChange();
  };
  on('settings', refresh);
  on('player', refresh);

  document.addEventListener('visibilitychange', () => {
    hidden = document.hidden;
    if (!ctx) return;
    if (suspendTimer) clearTimeout(suspendTimer);
    suspendTimer = null;
    applyVolumes(0.4);
    if (hidden) {
      suspendTimer = setTimeout(() => {
        if (ctx?.state === 'running') void ctx.suspend().catch(() => {});
      }, 320);
    } else if (unlocked && ctx.state !== 'running') {
      void ctx.resume().catch(() => {});
    }
  });
}
