// Chiptune voices: pulse waves with Game Boy duty cycles (12.5%, 25%, 50%), triangle, LFSR noise.
// tone() and noise() schedule one enveloped voice and return its end time; every envelope starts and ends at 0.

export type Wave = 'p12' | 'p25' | 'p50' | 'tri' | 'sine' | 'saw';
export type NoiseKind = 'white' | 'crunch' | 'metal';

export interface Env {
  /** Attack, decay and release in seconds; sustain is a 0..1 fraction of `vol`. */
  a?: number;
  d?: number;
  s?: number;
  r?: number;
}

export interface ToneOpts extends Env {
  f: number;
  /** Seconds before the release starts. */
  dur: number;
  vol: number;
  wave?: Wave;
  /** Pitch slide target (Hz) reached after `glide` seconds (default: dur). */
  to?: number;
  glide?: number;
  /** Arpeggio: semitone offsets cycled every `arpRate` seconds. */
  arp?: number[];
  arpRate?: number;
  /** Vibrato depth in cents, rate in Hz, delay in seconds. */
  vib?: number;
  vibRate?: number;
  vibDelay?: number;
  detune?: number;
  pan?: number;
}

export interface NoiseOpts extends Env {
  dur: number;
  vol: number;
  kind?: NoiseKind;
  filter?: BiquadFilterType;
  freq?: number;
  /** Filter frequency sweep target (Hz), reached at the end of `dur`. */
  to?: number;
  q?: number;
  /** Playback rate (lower = darker, grainier noise). */
  rate?: number;
  pan?: number;
}

const waves = new WeakMap<BaseAudioContext, Map<Wave, PeriodicWave>>();
const noises = new WeakMap<BaseAudioContext, Map<NoiseKind, AudioBuffer>>();

export const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function pulseWave(c: BaseAudioContext, duty: number): PeriodicWave {
  const n = 48;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k++) real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
  return c.createPeriodicWave(real, imag);
}

function setWave(c: BaseAudioContext, osc: OscillatorNode, wave: Wave) {
  if (wave === 'tri') osc.type = 'triangle';
  else if (wave === 'sine') osc.type = 'sine';
  else if (wave === 'saw') osc.type = 'sawtooth';
  else {
    let map = waves.get(c);
    if (!map) waves.set(c, (map = new Map()));
    let pw = map.get(wave);
    if (!pw) map.set(wave, (pw = pulseWave(c, wave === 'p12' ? 0.125 : wave === 'p25' ? 0.25 : 0.5)));
    osc.setPeriodicWave(pw);
  }
}

function noiseBuffer(c: BaseAudioContext, kind: NoiseKind): AudioBuffer {
  let map = noises.get(c);
  if (!map) noises.set(c, (map = new Map()));
  let buf = map.get(kind);
  if (buf) return buf;
  const len = c.sampleRate;
  buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  if (kind === 'white') {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  } else {
    // Game Boy style linear-feedback shift register; "metal" is the short 7-bit mode (pitched, ringing).
    const short = kind === 'metal';
    const hold = short ? 4 : 3;
    let lfsr = 0x7fff;
    let out = 0;
    for (let i = 0; i < len; i++) {
      if (i % hold === 0) {
        const bit = (lfsr ^ (lfsr >> 1)) & 1;
        lfsr = (lfsr >> 1) | (bit << 14);
        if (short) lfsr = (lfsr & ~0x40) | (bit << 6);
        out = lfsr & 1 ? 0.8 : -0.8;
      }
      data[i] = out;
    }
  }
  map.set(kind, buf);
  return buf;
}

/** Applies an ADSR envelope (linear, chiptune-like) and returns the end time. */
function envelope(param: AudioParam, t: number, dur: number, vol: number, e: Env): number {
  const a = Math.max(0.002, e.a ?? 0.004);
  const d = e.d ?? 0;
  const s = e.s ?? 1;
  const r = Math.max(0.005, e.r ?? 0.03);
  const hold = Math.max(dur, a);
  param.setValueAtTime(0, t);
  param.linearRampToValueAtTime(vol, t + a);
  let level = vol;
  if (d > 0 && s !== 1) {
    const end = Math.min(a + d, hold);
    level = vol + (vol * s - vol) * ((end - a) / d);
    param.linearRampToValueAtTime(level, t + end);
  }
  param.setValueAtTime(level, t + hold);
  param.linearRampToValueAtTime(0, t + hold + r);
  return t + hold + r;
}

function output(c: BaseAudioContext, node: AudioNode, dest: AudioNode, pan?: number) {
  if (pan && 'createStereoPanner' in c) {
    const p = c.createStereoPanner();
    p.pan.value = pan;
    node.connect(p).connect(dest);
  } else {
    node.connect(dest);
  }
}

export function tone(c: BaseAudioContext, dest: AudioNode, t: number, o: ToneOpts): number {
  try {
    const osc = c.createOscillator();
    setWave(c, osc, o.wave ?? 'p50');
    const f = osc.frequency;
    f.setValueAtTime(o.f, t);
    const g = c.createGain();
    const end = envelope(g.gain, t, o.dur, o.vol, o);
    if (o.arp?.length) {
      const rate = o.arpRate ?? 0.05;
      for (let x = t + rate, i = 1; x < end; x += rate, i++) f.setValueAtTime(o.f * 2 ** (o.arp[i % o.arp.length] / 12), x);
    } else if (o.to) {
      f.exponentialRampToValueAtTime(Math.max(1, o.to), t + (o.glide ?? o.dur));
    }
    if (o.detune) osc.detune.value = o.detune;
    if (o.vib) {
      const lfo = c.createOscillator();
      lfo.frequency.value = o.vibRate ?? 5.5;
      const depth = c.createGain();
      const start = t + (o.vibDelay ?? 0);
      depth.gain.setValueAtTime(0, t);
      if (start < end) {
        depth.gain.setValueAtTime(0, start);
        depth.gain.linearRampToValueAtTime(o.vib, Math.min(end, start + 0.15));
      }
      lfo.connect(depth).connect(osc.detune);
      lfo.start(t);
      lfo.stop(end + 0.02);
    }
    osc.connect(g);
    output(c, g, dest, o.pan);
    osc.start(t);
    osc.stop(end + 0.02);
    return end;
  } catch {
    return t;
  }
}

export function noise(c: BaseAudioContext, dest: AudioNode, t: number, o: NoiseOpts): number {
  try {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, o.kind ?? 'white');
    src.loop = true;
    if (o.rate) src.playbackRate.value = o.rate;
    const g = c.createGain();
    const end = envelope(g.gain, t, o.dur, o.vol, { a: 0.002, r: 0.02, ...o });
    let node: AudioNode = src;
    if (o.filter) {
      const filter = c.createBiquadFilter();
      filter.type = o.filter;
      filter.frequency.setValueAtTime(o.freq ?? 2000, t);
      if (o.to) filter.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + o.dur);
      filter.Q.value = o.q ?? 0.8;
      node = src.connect(filter);
    }
    node.connect(g);
    output(c, g, dest, o.pan);
    src.start(t, Math.random() * 0.8);
    src.stop(end + 0.02);
    return end;
  } catch {
    return t;
  }
}
