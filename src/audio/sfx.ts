// Sound effects, all synthesized (pulse/triangle/noise). Each effect returns its duration; playSfx() throttles
// rapid repeats of the same effect and softens bursts (100 level-ups in a batch stay pleasant).

import { duck, readyContext, sfxAllowed } from './engine';
import { playDrum, playJingle, type Jingle } from './instruments';
import { noteMidi } from './score';
import { hz, noise, tone, type NoiseOpts, type ToneOpts } from './synth';
import type { SfxName } from './types';

interface X {
  c: AudioContext;
  out: AudioNode;
  t: number;
}

interface Def {
  fn: (x: X) => number;
  /** Minimum seconds between two plays of this effect. */
  gap?: number;
  /** Lower the music while it plays (0..1). */
  duck?: number;
}

const N = (name: string) => hz(noteMidi(name));
const T = (x: X, at: number, o: ToneOpts) => tone(x.c, x.out, x.t + at, o) - x.t;
const Z = (x: X, at: number, o: NoiseOpts) => noise(x.c, x.out, x.t + at, o) - x.t;
const J = (x: X, at: number, j: Jingle) => at + playJingle(x.c, x.out, x.t + at, j);
const D = (x: X, at: number, drum: Parameters<typeof playDrum>[3], vol: number) => playDrum(x.c, x.out, x.t + at, drum, vol);
const jitter = (amount = 0.03) => 1 + (Math.random() - 0.5) * 2 * amount;

/** A few high, quick, panned blips: the sparkle used for shinies and big reveals. */
function twinkle(x: X, at: number, notes: string[], vol = 0.035, gap = 0.055) {
  let end = at;
  notes.forEach((name, i) => {
    const fade = 1 - i / (notes.length * 1.6);
    end = Math.max(end, T(x, at + i * gap, { f: N(name), dur: 0.02, vol: vol * fade, wave: i % 2 ? 'sine' : 'p12', d: 0.06, s: 0.25, r: 0.14, pan: i % 2 ? 0.35 : -0.35 }));
  });
  return end;
}

/** A small bell: sine plus an inharmonic partial and a pulse "ping". */
function bell(x: X, at: number, name: string, vol: number) {
  const f = N(name);
  T(x, at, { f: f * 2.76, dur: 0.01, vol: vol * 0.3, wave: 'sine', r: 0.25 });
  T(x, at, { f, dur: 0.02, vol: vol * 0.35, wave: 'p12', r: 0.12 });
  return T(x, at, { f, dur: 0.01, vol, wave: 'sine', r: 0.7 });
}

function crash(x: X, at: number, vol = 0.1, length = 0.9) {
  return Z(x, at, { dur: 0.04, vol, filter: 'highpass', freq: 3500, r: length });
}

const DEFS: Record<SfxName, Def> = {
  // --- UI: very short and soft -------------------------------------------
  click: {
    gap: 0.03,
    fn: x => {
      const v = jitter();
      return T(x, 0, { f: 1480 * v, to: 1180 * v, glide: 0.025, dur: 0.016, vol: 0.1, wave: 'p25', r: 0.025 });
    },
  },
  tab: {
    fn: x => {
      T(x, 0, { f: N('a5'), dur: 0.022, vol: 0.08, wave: 'p50', r: 0.02 });
      return T(x, 0.035, { f: N('e6'), dur: 0.028, vol: 0.07, wave: 'p50', r: 0.03 });
    },
  },
  open: {
    fn: x => {
      T(x, 0.025, { f: 1560, dur: 0.02, vol: 0.03, wave: 'sine', r: 0.06 });
      return T(x, 0, { f: 520, to: 1040, glide: 0.07, dur: 0.06, vol: 0.09, wave: 'p25', r: 0.03 });
    },
  },
  close: {
    fn: x => T(x, 0, { f: 900, to: 430, glide: 0.07, dur: 0.055, vol: 0.085, wave: 'p25', r: 0.03 }),
  },
  error: {
    gap: 0.15,
    fn: x => {
      T(x, 0, { f: N('d3'), dur: 0.07, vol: 0.1, wave: 'p12', r: 0.02 });
      return T(x, 0.1, { f: N('a2'), dur: 0.13, vol: 0.1, wave: 'p12', r: 0.05 });
    },
  },
  toggle: {
    fn: x => {
      T(x, 0, { f: N('e6'), dur: 0.018, vol: 0.07, wave: 'p50', r: 0.02 });
      return T(x, 0.03, { f: N('b6'), dur: 0.022, vol: 0.065, wave: 'p50', r: 0.03 });
    },
  },

  // --- Economy ---------------------------------------------------------------
  coin: {
    gap: 0.06,
    fn: x => {
      T(x, 0, { f: N('e6'), dur: 0.03, vol: 0.075, wave: 'p25', r: 0.01 });
      T(x, 0.035, { f: N('g#6'), dur: 0.03, vol: 0.075, wave: 'p25', r: 0.01 });
      T(x, 0.07, { f: N('e7'), dur: 0.01, vol: 0.02, wave: 'sine', r: 0.15 });
      return T(x, 0.07, { f: N('b6'), dur: 0.12, vol: 0.075, wave: 'p25', d: 0.12, s: 0.15, r: 0.08 });
    },
  },
  buy: {
    gap: 0.12,
    fn: x => {
      Z(x, 0, { dur: 0.012, vol: 0.08, filter: 'highpass', freq: 4000, r: 0.02 });
      T(x, 0.02, { f: N('c4'), dur: 0.08, vol: 0.14, wave: 'tri', r: 0.05 });
      T(x, 0.02, { f: N('c6'), dur: 0.16, vol: 0.055, wave: 'p25', arp: [0, 4, 7, 12], arpRate: 0.04, d: 0.1, s: 0.6, r: 0.08 });
      return T(x, 0.19, { f: N('c7'), dur: 0.02, vol: 0.03, wave: 'sine', r: 0.3 });
    },
  },
  daily: {
    gap: 0.6,
    duck: 0.5,
    fn: x => {
      const end = J(x, 0, { bpm: 150, lead: 'g5 . c6 . e6 g6*2 . e6 g6*4', harm: '.*4 c5+e5+g5*9', bass: 'c3*4 g3*4 c4*5' });
      return Math.max(end, twinkle(x, 0.6, ['c7', 'g7', 'e7', 'c8'], 0.025));
    },
  },

  // --- Captures --------------------------------------------------------------
  ballThrow: {
    gap: 0.08,
    fn: x => {
      T(x, 0, { f: 260, to: 820, glide: 0.2, dur: 0.16, vol: 0.05, wave: 'p12', a: 0.02, r: 0.06 });
      return Z(x, 0, { dur: 0.18, vol: 0.14, filter: 'bandpass', freq: 500, to: 3200, q: 1.2, a: 0.05, r: 0.08 });
    },
  },
  ballWobble: {
    gap: 0.12,
    fn: x => {
      const v = jitter(0.06);
      T(x, 0, { f: 200 * v, to: 130 * v, glide: 0.06, dur: 0.04, vol: 0.11, wave: 'tri', r: 0.04 });
      Z(x, 0, { dur: 0.012, vol: 0.05, kind: 'crunch', filter: 'bandpass', freq: 1800, q: 2, r: 0.02 });
      Z(x, 0.055, { dur: 0.01, vol: 0.04, kind: 'crunch', filter: 'bandpass', freq: 2200, q: 2, r: 0.02 });
      return T(x, 0.055, { f: 165 * v, to: 115 * v, glide: 0.05, dur: 0.03, vol: 0.07, wave: 'tri', r: 0.04 });
    },
  },
  ballClick: {
    gap: 0.1,
    fn: x => {
      Z(x, 0, { dur: 0.006, vol: 0.13, filter: 'highpass', freq: 3000, r: 0.02 });
      T(x, 0, { f: 220, to: 70, glide: 0.08, dur: 0.06, vol: 0.17, wave: 'tri', r: 0.05 });
      T(x, 0, { f: N('c6'), dur: 0.018, vol: 0.055, wave: 'p50', r: 0.01 });
      return T(x, 0.03, { f: N('g6'), dur: 0.03, vol: 0.055, wave: 'p50', r: 0.05 });
    },
  },
  ballOpen: {
    gap: 0.08,
    fn: x => {
      Z(x, 0, { dur: 0.15, vol: 0.07, filter: 'highpass', freq: 400, to: 5000, a: 0.11, r: 0.03 });
      T(x, 0.15, { f: 280, to: 1400, glide: 0.05, dur: 0.045, vol: 0.09, wave: 'sine', r: 0.06 });
      Z(x, 0.16, { dur: 0.01, vol: 0.11, kind: 'crunch', filter: 'bandpass', freq: 1500, q: 1, r: 0.05 });
      return T(x, 0.18, { f: N('e6'), dur: 0.03, vol: 0.04, wave: 'p25', d: 0.1, s: 0.3, r: 0.12 });
    },
  },
  reveal: {
    gap: 0.04,
    fn: x => {
      T(x, 0, { f: N('g6'), dur: 0.02, vol: 0.02, wave: 'p12', r: 0.12 });
      return T(x, 0, { f: N('g5'), dur: 0.1, vol: 0.11, wave: 'tri', arp: [0, 4, 7], arpRate: 0.04, r: 0.1 });
    },
  },
  revealRare: {
    gap: 0.08,
    fn: x => {
      T(x, 0, { f: N('c4'), dur: 0.3, vol: 0.14, wave: 'tri', r: 0.1 });
      T(x, 0, { f: N('c6'), dur: 0.15, vol: 0.055, wave: 'p25', arp: [0, 4, 7, 12], arpRate: 0.045, r: 0.02 });
      return T(x, 0.18, { f: N('c7'), dur: 0.2, vol: 0.045, wave: 'p25', d: 0.2, s: 0.5, vib: 20, vibDelay: 0.05, r: 0.15 });
    },
  },
  revealEpic: {
    gap: 0.2,
    duck: 0.4,
    fn: x => {
      T(x, 0, { f: N('d5'), dur: 0.26, vol: 0.06, wave: 'p25', arp: [0, 4, 7, 12, 16, 19], arpRate: 0.045, r: 0.02 });
      T(x, 0, { f: N('d4'), dur: 0.26, vol: 0.12, wave: 'tri', r: 0.03 });
      Z(x, 0, { dur: 0.28, vol: 0.04, filter: 'highpass', freq: 1500, to: 7000, a: 0.24, r: 0.04 });
      D(x, 0.3, 'k', 0.6);
      crash(x, 0.3, 0.08, 0.7);
      T(x, 0.3, { f: N('d3'), dur: 0.5, vol: 0.2, wave: 'tri', r: 0.2 });
      T(x, 0.3, { f: N('a5'), dur: 0.45, vol: 0.03, wave: 'p50', vib: 12, r: 0.25, pan: -0.2 });
      const end = T(x, 0.3, { f: N('d6'), dur: 0.45, vol: 0.055, wave: 'p25', arp: [0, 4, 7], arpRate: 0.035, vib: 15, vibDelay: 0.1, r: 0.25 });
      return Math.max(end, twinkle(x, 0.4, ['f#7', 'a7', 'd7'], 0.025));
    },
  },
  revealLegendary: {
    gap: 0.5,
    duck: 0.6,
    fn: x => {
      T(x, 0, { f: 180, to: 900, glide: 0.5, dur: 0.5, vol: 0.045, wave: 'p50', vib: 30, vibRate: 9, a: 0.1, r: 0.02 });
      Z(x, 0, { dur: 0.5, vol: 0.05, filter: 'bandpass', freq: 400, to: 5000, q: 1.5, a: 0.45, r: 0.03 });
      for (let i = 0; i < 9; i++) D(x, i * 0.055, 's', 0.15 + i * 0.05);
      D(x, 0.55, 'k', 0.9);
      crash(x, 0.55, 0.12, 1.3);
      T(x, 0.55, { f: N('e2'), dur: 0.9, vol: 0.2, wave: 'tri', r: 0.4 });
      T(x, 0.55, { f: N('e6'), dur: 0.9, vol: 0.05, wave: 'p25', arp: [0, 4, 7, 12], arpRate: 0.04, vib: 15, r: 0.4 });
      const end = J(x, 0.55, { bpm: 160, lead: 'b5 e6*2 g#6 b6*10', harm: 'g#5 b5*2 e6 g#6*10', bass: 'e3*4 b2*4 e3*6' });
      return Math.max(end, twinkle(x, 0.85, ['e7', 'b7', 'g#7', 'e7', 'b7', 'e8'], 0.028, 0.07));
    },
  },
  shiny: {
    gap: 0.4,
    fn: x => {
      const notes = ['b6', 'f#7', 'd#7', 'b7', 'g#7', 'e7', 'b7'];
      twinkle(x, 0.11, notes, 0.03);
      T(x, 0, { f: N('e7'), dur: 0.5, vol: 0.025, wave: 'sine', a: 0.1, r: 0.3, vib: 25, vibRate: 7 });
      return twinkle(x, 0, notes, 0.08);
    },
  },

  // --- Collection ----------------------------------------------------------
  newCard: {
    gap: 0.08,
    fn: x => {
      T(x, 0, { f: N('g4'), dur: 0.2, vol: 0.11, wave: 'tri', r: 0.06 });
      T(x, 0, { f: N('g5'), dur: 0.045, vol: 0.06, wave: 'p25', r: 0.02 });
      T(x, 0.06, { f: N('d6'), dur: 0.045, vol: 0.06, wave: 'p25', r: 0.02 });
      return T(x, 0.12, { f: N('g6'), dur: 0.12, vol: 0.05, wave: 'p25', d: 0.1, s: 0.5, vib: 15, vibDelay: 0.04, r: 0.12 });
    },
  },
  levelUp: {
    gap: 0.09,
    fn: x => {
      T(x, 0, { f: N('a4'), dur: 0.12, vol: 0.1, wave: 'tri', r: 0.05 });
      T(x, 0, { f: N('e5'), dur: 0.03, vol: 0.05, wave: 'p25', r: 0.01 });
      T(x, 0.04, { f: N('a5'), dur: 0.03, vol: 0.05, wave: 'p25', r: 0.01 });
      T(x, 0.08, { f: N('c#6'), dur: 0.03, vol: 0.05, wave: 'p25', r: 0.01 });
      return T(x, 0.12, { f: N('e6'), dur: 0.08, vol: 0.05, wave: 'p25', d: 0.08, s: 0.4, r: 0.08 });
    },
  },
  candy: {
    gap: 0.08,
    fn: x => {
      T(x, 0, { f: 400, to: 900, glide: 0.07, dur: 0.06, vol: 0.12, wave: 'tri', r: 0.03 });
      T(x, 0.08, { f: 600, to: 1300, glide: 0.06, dur: 0.05, vol: 0.108, wave: 'tri', r: 0.03 });
      return T(x, 0.14, { f: N('e6'), dur: 0.04, vol: 0.042, wave: 'p12', d: 0.1, s: 0.3, r: 0.12 });
    },
  },
  deckAdd: {
    fn: x => {
      Z(x, 0, { dur: 0.01, vol: 0.06, kind: 'crunch', filter: 'lowpass', freq: 2500, r: 0.02 });
      T(x, 0, { f: 300, to: 150, glide: 0.05, dur: 0.04, vol: 0.12, wave: 'tri', r: 0.03 });
      T(x, 0, { f: N('a5'), dur: 0.03, vol: 0.06, wave: 'p50', r: 0.01 });
      return T(x, 0.04, { f: N('e6'), dur: 0.05, vol: 0.06, wave: 'p50', r: 0.05 });
    },
  },
  deckRemove: {
    fn: x => {
      Z(x, 0, { dur: 0.01, vol: 0.06, kind: 'crunch', filter: 'lowpass', freq: 2000, r: 0.02 });
      T(x, 0, { f: N('e6'), dur: 0.03, vol: 0.06, wave: 'p50', r: 0.01 });
      return T(x, 0.04, { f: N('a5'), dur: 0.05, vol: 0.06, wave: 'p50', r: 0.05 });
    },
  },
  flip: {
    gap: 0.03,
    fn: x => {
      T(x, 0.03, { f: 1200 * jitter(), dur: 0.01, vol: 0.035, wave: 'p12', r: 0.015 });
      return Z(x, 0, { dur: 0.04, vol: 0.096, filter: 'bandpass', freq: 1800, to: 4000, q: 1.5, a: 0.012, r: 0.03 });
    },
  },

  // --- Evolution -------------------------------------------------------------
  evolveStart: {
    gap: 0.5,
    duck: 0.4,
    fn: x => {
      T(x, 0, { f: N('a2'), dur: 0.6, vol: 0.15, wave: 'tri', a: 0.3, r: 0.3 });
      T(x, 0, { f: N('a4'), dur: 0.5, vol: 0.045, wave: 'p25', a: 0.35, r: 0.3, vib: 40, vibRate: 4 });
      T(x, 0, { f: N('a4'), detune: 9, dur: 0.5, vol: 0.035, wave: 'p50', a: 0.35, r: 0.3, vib: 40, vibRate: 4.4, pan: 0.3 });
      const end = T(x, 0.35, { f: N('e5'), dur: 0.35, vol: 0.04, wave: 'p25', a: 0.2, r: 0.3, vib: 30, vibRate: 5, pan: -0.2 });
      return Math.max(end, twinkle(x, 0.3, ['e7', 'a7', 'c#7'], 0.016, 0.09));
    },
  },
  evolveCharge: {
    gap: 0.3,
    duck: 0.5,
    fn: x => {
      T(x, 0, { f: 90, to: 750, glide: 1.5, dur: 1.5, vol: 0.13, wave: 'tri', a: 0.2, r: 0.05 });
      T(x, 0, { f: 180, to: 1500, glide: 1.5, dur: 1.5, vol: 0.05, wave: 'p25', a: 0.2, r: 0.05, vib: 25, vibRate: 12 });
      return Z(x, 0, { dur: 1.5, vol: 0.05, filter: 'bandpass', freq: 300, to: 6000, q: 2, a: 1.2, r: 0.05 });
    },
  },
  evolveDone: {
    gap: 0.5,
    duck: 0.7,
    fn: x => {
      const end = J(x, 0, {
        bpm: 168,
        lead: 'e5 a5 c#6 e6*2 c#6 e6 a6*10',
        harm: '.*5 a5+c#6+e6*12',
        bass: 'a2*5 e3*2 a3*10',
        drums: 'k*5 s s k+c*10',
      });
      return Math.max(end, twinkle(x, 0.55, ['a7', 'e7', 'c#8', 'a7', 'e8'], 0.022, 0.08));
    },
  },

  // --- Battle ----------------------------------------------------------------
  cardPick: {
    fn: x => {
      Z(x, 0, { dur: 0.008, vol: 0.06, kind: 'crunch', filter: 'highpass', freq: 2500, r: 0.015 });
      return T(x, 0, { f: N('e5'), to: N('a5'), glide: 0.03, dur: 0.03, vol: 0.075, wave: 'p25', r: 0.02 });
    },
  },
  cardPlace: {
    fn: x => {
      Z(x, 0, { dur: 0.025, vol: 0.08, kind: 'crunch', filter: 'lowpass', freq: 1200, r: 0.04 });
      return T(x, 0, { f: 230, to: 100, glide: 0.08, dur: 0.06, vol: 0.17, wave: 'tri', r: 0.05 });
    },
  },
  statReveal: {
    gap: 0.05,
    fn: x => T(x, 0, { f: N('a5') * jitter(0.01), to: N('e6'), glide: 0.05, dur: 0.045, vol: 0.08, wave: 'p25', r: 0.03 }),
  },
  hit: {
    gap: 0.05,
    fn: x => {
      T(x, 0, { f: 160, to: 55, glide: 0.12, dur: 0.1, vol: 0.1, wave: 'p50', r: 0.05 });
      return Z(x, 0, { dur: 0.06, vol: 0.18, kind: 'crunch', filter: 'lowpass', freq: 2200, to: 400, r: 0.1 });
    },
  },
  superEffective: {
    gap: 0.15,
    fn: x => {
      Z(x, 0, { dur: 0.05, vol: 0.22, kind: 'crunch', filter: 'lowpass', freq: 4000, to: 600, r: 0.08 });
      T(x, 0, { f: 1800, to: 300, glide: 0.08, dur: 0.07, vol: 0.055, wave: 'p25', r: 0.02 });
      T(x, 0, { f: 180, to: 50, glide: 0.14, dur: 0.12, vol: 0.2, wave: 'tri', r: 0.05 });
      Z(x, 0.1, { dur: 0.08, vol: 0.2, kind: 'crunch', filter: 'lowpass', freq: 3000, to: 300, r: 0.12 });
      return T(x, 0.1, { f: 140, to: 40, glide: 0.18, dur: 0.16, vol: 0.12, wave: 'p50', r: 0.06 });
    },
  },
  notEffective: {
    gap: 0.15,
    fn: x => {
      Z(x, 0, { dur: 0.05, vol: 0.12, kind: 'crunch', filter: 'lowpass', freq: 500, r: 0.08 });
      T(x, 0, { f: 130, to: 95, glide: 0.1, dur: 0.08, vol: 0.13, wave: 'tri', r: 0.06 });
      return T(x, 0.06, { f: N('c4'), to: N('a3'), glide: 0.12, dur: 0.12, vol: 0.03, wave: 'p50', r: 0.05 });
    },
  },
  roundWin: {
    gap: 0.3,
    duck: 0.3,
    fn: x => J(x, 0, { bpm: 210, lead: 'g5 c6 e6 g6*5', harm: 'e5 g5 c6 e6*5', bass: 'c3*3 c4*5' }),
  },
  roundLose: {
    gap: 0.3,
    duck: 0.3,
    fn: x => J(x, 0, {
      bpm: 170, lead: 'e5*2 c5*2 a4*6', harm: 'c5*2 a4*2 e4*6', bass: 'f2*4 a2*6',
      leadInst: { wave: 'p50', vol: 0.075, vib: 20, vibDelay: 0.1 }, harmInst: { vol: 0.04 },
    }),
  },
  roundDraw: {
    gap: 0.3,
    fn: x => J(x, 0, { bpm: 200, lead: 'd5*2 . d5*5', harm: 'a4*2 . a4*5', bass: 'd3*3 d3*5', leadInst: { vol: 0.08 } }),
  },
  victory: {
    gap: 1,
    duck: 0.85,
    fn: x => J(x, 0, {
      bpm: 160,
      lead: 'c5 . e5 . g5 . c6*3 . a5 b5 c6*2 e6*8',
      harm: 'e4 . g4 . c5 . e5*3 . f5 g5 g5*2 c5+e5+g5*8',
      bass: 'c3*2 g2*2 c3*2 e3*3 . f3*2 g3*2 c3*8',
      drums: 'k . h . s . k . h s k . s s k+c*8',
    }),
  },
  defeat: {
    gap: 1,
    duck: 0.7,
    fn: x => J(x, 0, {
      bpm: 88,
      lead: 'e5*2 c5*2 d5*2 b4*2 c5*3 b4 a4*8',
      harm: 'c4*4 a3*4 g#3*4 a3*8',
      bass: 'a2*4 f2*4 e2*4 a2*8',
      leadInst: { wave: 'p50', vol: 0.07, vib: 18, vibDelay: 0.2, r: 0.2 },
      harmInst: { vol: 0.035, r: 0.2 },
      bassInst: { vol: 0.2, r: 0.2 },
    }),
  },

  // --- Progression -----------------------------------------------------------
  badge: {
    gap: 1,
    duck: 0.7,
    fn: x => {
      ['c6', 'e6', 'g6'].forEach((n, i) => bell(x, i * 0.08, n, 0.07));
      bell(x, 0.26, 'c7', 0.06);
      D(x, 0.34, 'k', 0.7);
      crash(x, 0.34, 0.08, 1);
      T(x, 0.34, { f: N('c3'), dur: 0.8, vol: 0.2, wave: 'tri', r: 0.3 });
      T(x, 0.34, { f: N('g5'), dur: 0.7, vol: 0.03, wave: 'p50', vib: 12, vibDelay: 0.1, r: 0.3, pan: -0.25 });
      return T(x, 0.34, { f: N('c5'), dur: 0.7, vol: 0.06, wave: 'p25', arp: [0, 4, 7, 12], arpRate: 0.045, vib: 15, vibDelay: 0.15, r: 0.35 });
    },
  },
  rankUp: {
    gap: 1,
    duck: 0.7,
    fn: x => J(x, 0, {
      bpm: 180,
      lead: 'c5 e5 g5*2 d5 f#5 a5*2 e5 g#5 b5 e6*8',
      harm: 'c4+e4+g4*4 d4+f#4+a4*4 e4+g#4+b4*11',
      bass: 'c3*4 d3*4 e3*11',
      drums: 'k . s . k . s . k . s s k+c*7',
    }),
  },
  champion: {
    gap: 2,
    duck: 0.9,
    fn: x => {
      for (let i = 0; i < 16; i++) D(x, i * 0.05, 's', 0.12 + i * 0.04);
      return J(x, 0.8, {
        bpm: 132,
        lead: 'bb4*2 d5*2 f5*2 bb5*6 a5 bb5 c6*2 d6*12',
        harm: 'f4*2 bb4*2 d5*2 f5*6 f5 f5 a5*2 bb5+d6+f6*12',
        bass: 'bb2*2 bb2*2 bb2*2 g2*6 f2*4 bb2*12',
        drums: 'k+c*2 s*2 k*2 s*2 k*2 s*2 k s s s k+c*12',
        leadInst: { vol: 0.12 },
      });
    },
  },
};

/** Dev/test helper: schedules an effect into any context (e.g. an OfflineAudioContext) and returns its duration. */
export function renderSfx(c: BaseAudioContext, out: AudioNode, name: SfxName, t = 0): number {
  return DEFS[name].fn({ c: c as AudioContext, out, t });
}

export const SFX_NAMES = Object.keys(DEFS) as SfxName[];

const lastAt = new Map<SfxName, number>();
const burst = new Map<SfxName, number>();
let voices: number[] = [];
const MAX_VOICES = 12;

/** `exact` skips the burst softening (volume previews must play at the real level). */
export function playSfx(name: SfxName, exact = false): void {
  if (!sfxAllowed()) return;
  const ready = readyContext();
  if (!ready) return;
  const def = DEFS[name];
  if (!def) return;
  const { c, buses } = ready;
  const now = c.currentTime;
  const last = lastAt.get(name);
  if (last !== undefined && now - last < (def.gap ?? 0.04)) return;
  voices = voices.filter(end => end > now);
  if (voices.length >= MAX_VOICES) return;
  // Bursts of the same effect get progressively softer instead of stacking up.
  const count = exact ? 1 : (burst.get(name) ?? 0) * (last === undefined ? 0 : Math.exp(-(now - last) / 0.5)) + 1;
  burst.set(name, count);
  lastAt.set(name, now);
  try {
    const out = c.createGain();
    out.gain.value = Math.max(0.25, 1 / Math.sqrt(count));
    out.connect(buses.sfx);
    const dur = def.fn({ c, out, t: now + 0.005 });
    voices.push(now + dur);
    if (def.duck) duck(def.duck, dur);
    setTimeout(() => out.disconnect(), (dur + 0.5) * 1000);
  } catch { /* audio failures are silent */ }
}
