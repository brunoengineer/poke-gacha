// Music loops (original compositions) in the score format of score.ts: lead pulse, harmony pulse,
// triangle bass and noise drums. Every bar is 16 steps; tracks.test.ts checks the bar lengths.

import type { Instrument } from './instruments';
import type { MusicTrack } from './types';
import { rep, tr } from './score';

export interface Section {
  lead?: string;
  harm?: string;
  bass?: string;
  drums?: string;
}

export interface TrackDef {
  bpm: number;
  /** Delay of every odd 16th, as a fraction of a step (bouncy feel). */
  swing?: number;
  arpRate?: number;
  /** Lead echo: delay in steps, feedback and wet level. */
  echo?: { steps: number; feedback: number; wet: number };
  lead: Instrument;
  harm: Instrument;
  bass: Instrument;
  drumVol: number;
  loop: Section[];
}

// --- Writing helpers -----------------------------------------------------

const up = (n: string) => tr(n, 12);
const fifth = (n: string) => tr(n, 7);
const bars = (...list: string[]) => list.join(' | ');
/** Bass: octave bounce in 8ths, 16th-note pump, chug, bouncy root-fifth, slow walk. */
const octs = (r: string, beats = 4) => rep(`${r}*2 ${up(r)}*2`, beats);
const pump = (r: string, beats = 4) => rep(`${r} ${r} ${up(r)} ${r}`, beats);
const chug = (r: string, beats = 4) => rep(`${r}*2 ${r}*2 ${up(r)}*2 ${r}*2`, beats / 2);
const bounce = (r: string, beats = 4) =>
  beats === 2 ? `${r}*2 .*2 ${fifth(r)}*2 ${up(r)}*2` : `${r}*2 .*2 ${fifth(r)}*2 .*2 ${r}*2 .*2 ${fifth(r)}*2 ${up(r)}*2`;
const walk = (r: string) => `${r}*6 ${fifth(r)}*2 ${up(r)}*4 ${fifth(r)}*4`;
/** Harmony: offbeat chord stabs, 3+3+2 syncopated chords, 8th-note chords, whole-bar arpeggio. */
const stab = (ch: string, beats = 4) => rep(`.*2 ${ch}*2`, beats);
const syn = (ch: string, beats = 4) => rep(`${ch}*3 ${ch}*3 ${ch}*2`, beats / 2);
const eighths = (ch: string, beats = 4) => rep(`${ch}*2`, beats * 2);
const hold = (ch: string, beats = 4) => `${ch}*${beats * 4}`;

const LEAD: Instrument = { wave: 'p25', vol: 0.1, gate: 0.9, d: 0.15, s: 0.72, r: 0.07, vib: 12, vibDelay: 0.18 };
const BASS: Instrument = { wave: 'tri', vol: 0.24, gate: 0.8, r: 0.04 };

// --- Title: inviting, sunny D major -------------------------------------

const title: TrackDef = {
  bpm: 112,
  arpRate: 0.04,
  echo: { steps: 3, feedback: 0.3, wet: 0.22 },
  lead: LEAD,
  harm: { wave: 'p12', vol: 0.04, gate: 0.95, d: 0.2, s: 0.45, r: 0.05, pan: -0.25 },
  bass: BASS,
  drumVol: 0.55,
  loop: [{
    lead: bars('a4*2 d5*2 f#5*4 e5*2 d5*2 e5*4', 'f#5*2 e5*2 d5*2 b4*2 d5*6 .*2', 'g5*3 f#5 e5*2 d5*2 b4*4 d5*4', 'e5*6 c#5*2 a4*8',
      'a4*2 d5*2 f#5*4 a5*4 f#5*2 a5*2', 'c#6*4 b5*2 a5*2 f#5*8', 'g5*2 a5*2 b5*4 a5*2 g5*2 e5*4', 'd5*12 .*4'),
    harm: bars(syn('d4+f#4+a4'), syn('b3+d4+f#4'), syn('g3+b3+d4'), syn('a3+c#4+e4'),
      syn('d4+f#4+a4'), syn('f#3+a3+c#4'), `${syn('g3+b3+d4', 2)} ${syn('a3+c#4+e4', 2)}`, syn('d4+f#4+a4')),
    bass: bars(octs('d3'), octs('b2'), octs('g2'), octs('a2'), octs('d3'), octs('f#2'), `${octs('g2', 2)} ${octs('a2', 2)}`, octs('d3')),
    drums: bars(...Array(7).fill('k*2 h*2 s*2 h*2 k*2 h*2 s*2 h*2'), 'k*2 h*2 s*2 h*2 k*2 s s s s s*2'),
  }],
};

// --- Menu: relaxed F major, lots of space; loops for a long time ------------

const Fmaj7 = 'f3+a3+c4+e4', Am7 = 'a3+c4+e4+g4', Bbmaj7 = 'bb3+d4+f4+a4', C = 'c4+e4+g4', Dm7 = 'd4+f4+a4+c5', Gm7 = 'g3+bb3+d4+f4';
const C7 = 'c4+e4+g4+bb4', Bb = 'bb3+d4+f4', Am = 'a3+c4+e4', Dm = 'd4+f4+a4', Gm = 'g3+bb3+d4', F = 'f3+a3+c4';
const MENU_DRUMS = ['k*4 h*4 .*4 h*4', 'k*4 h*4 k*2 .*2 h*2 h*2'];
const menuHarmA = bars(stab(Fmaj7), stab(Am7), stab(Bbmaj7), stab(C), stab(Fmaj7), stab(Dm7), stab(Gm7), stab(C7));
const menuBassA = bars(walk('f2'), walk('a2'), walk('bb2'), walk('c3'), walk('f2'), walk('d3'), walk('g2'), walk('c3'));

const menu: TrackDef = {
  bpm: 84,
  swing: 0.08,
  arpRate: 0.045,
  echo: { steps: 3, feedback: 0.35, wet: 0.25 },
  lead: { wave: 'p25', vol: 0.075, gate: 0.92, d: 0.3, s: 0.6, r: 0.12, vib: 10, vibDelay: 0.25 },
  harm: { wave: 'p50', vol: 0.03, gate: 0.9, d: 0.12, s: 0.3, r: 0.06, pan: -0.3 },
  bass: { wave: 'tri', vol: 0.2, gate: 0.92, r: 0.06 },
  drumVol: 0.35,
  loop: [
    {
      lead: bars('.*4 a4*2 c5*2 e5*6 .*2', 'd5*2 c5*2 a4*4 .*4 g4*2 a4*2', 'f4*4 d5*4 c5*4 a4*2 bb4*2', 'c5*10 .*6',
        '.*4 a4*2 c5*2 f5*6 e5*2', 'd5*2 e5*2 f5*2 a5*4 g5*2 f5*4', 'd5*4 bb4*2 d5*2 c5*4 g4*4', 'e5*4 d5*2 c5*2 g4*8'),
      harm: menuHarmA,
      bass: menuBassA,
      drums: bars(...Array(4).fill(MENU_DRUMS).flat()),
    },
    {
      lead: bars('f5*6 d5*2 bb4*8', 'g5*6 e5*2 c5*8', 'e5*4 c5*2 e5*2 a5*8', 'f5*4 e5*2 d5*2 a4*8',
        'bb4*4 d5*4 g5*4 f5*2 d5*2', 'e5*4 g5*4 c6*8', 'a5*6 g5*2 f5*4 c5*4', 'e5*2 f5*2 g5*4 .*8'),
      harm: bars(stab(Bb), stab(C), stab(Am), stab(Dm), stab(Gm), stab(C), stab(F), stab(C)),
      bass: bars(walk('bb2'), walk('c3'), walk('a2'), walk('d3'), walk('g2'), walk('c3'), walk('f2'), walk('c3')),
      drums: bars(...Array(3).fill(MENU_DRUMS).flat(), MENU_DRUMS[0], 'k*4 h*4 k*2 h*2 o*4'),
    },
    {
      lead: bars('.*8 c5*4 a4*4', 'e5*8 .*8', 'd5*4 f5*4 .*4 d5*2 c5*2', 'c5*8 .*8',
        '.*8 f5*4 g5*4', 'a5*8 f5*4 d5*4', 'bb4*4 d5*4 g5*4 f5*4', 'e5*8 .*8'),
      harm: menuHarmA,
      bass: menuBassA,
      drums: bars(...Array(8).fill('k*4 .*8 h*4')),
    },
  ],
};

// --- Capture: playful, bouncy G major with swing ----------------------------

const G = 'g3+b3+d4', Em = 'e3+g3+b3', Cc = 'c4+e4+g4', D = 'd4+f#4+a4', Bm = 'b3+d4+f#4', Am7c = 'a3+c4+e4+g4', D7 = 'd4+f#4+a4+c5';
const CAPTURE_GROOVE = 'k*2 h*2 s*2 h k k*2 h*2 s*2 h*2';
const CAPTURE_FILL = 'k*2 h*2 s*2 h k s s s s s*2 h*2';

const capture: TrackDef = {
  bpm: 132,
  swing: 0.16,
  arpRate: 0.035,
  echo: { steps: 3, feedback: 0.2, wet: 0.15 },
  lead: { wave: 'p12', vol: 0.095, gate: 0.6, r: 0.03, vib: 8, vibDelay: 0.2 },
  harm: { wave: 'p25', vol: 0.035, gate: 0.85, d: 0.08, s: 0.4, r: 0.04, pan: -0.25 },
  bass: { wave: 'tri', vol: 0.24, gate: 0.6, r: 0.03 },
  drumVol: 0.5,
  loop: [
    {
      lead: bars('g4 . b4 . d5 . b4 . g5*2 f#5*2 e5*2 d5*2', 'e5*2 g5*2 b4*2 e5*2 d5*4 b4*4', 'c5 . e5 . g5 . e5 . a5*2 g5*2 e5*2 c5*2', 'd5*2 f#5*2 a5*2 f#5*2 d5*6 .*2',
        'b5 . a5 . g5 . d5 . e5*2 g5*2 d5*4', 'b4*2 d5*2 e5*2 g5*2 b5*6 .*2', 'c6*2 b5*2 a5*2 e5*2 f#5*2 a5*2 d6*4', 'g5*2 d5*2 b4*2 d5*2 g5*4 .*4'),
      harm: bars(stab(G), stab(Em), stab(Cc), stab(D), stab(G), stab(Em), `${stab(Am, 2)} ${stab(D, 2)}`, stab(G)),
      bass: bars(bounce('g2'), bounce('e2'), bounce('c3'), bounce('d3'), bounce('g2'), bounce('e2'), `${bounce('a2', 2)} ${bounce('d3', 2)}`, bounce('g2')),
      drums: bars(...Array(7).fill(CAPTURE_GROOVE), CAPTURE_FILL),
    },
    {
      lead: bars('e5*2 . e5 g5*2 e5*2 c5*4 .*4', 'f#5*2 . f#5 a5*2 f#5*2 d5*4 .*4', 'b5 . a5 . f#5 . d5 . f#5*2 a5*2 b5*4', 'g5*2 f#5*2 e5*2 b4*2 e5*8',
        'c6 . b5 . a5 . g5 . e5*2 g5*2 c6*4', 'a5 . g5 . f#5 . e5 . d5*2 f#5*2 a5*4', 'c6*2 b5*2 a5*2 g5*2 e5*4 c5*4', 'd5 . e5 . f#5 . g5 . a5*2 b5*2 c6*2 a5*2'),
      harm: bars(stab(Cc), stab(D), stab(Bm), stab(Em), stab(Cc), stab(D), stab(Am7c), stab(D7)),
      bass: bars(bounce('c3'), bounce('d3'), bounce('b2'), bounce('e2'), bounce('c3'), bounce('d3'), bounce('a2'), bounce('d3')),
      drums: bars(...Array(7).fill(CAPTURE_GROOVE), CAPTURE_FILL),
    },
  ],
};

// --- Battle: driving A minor, 16th-note bass ----------------------------------

const bAm = 'a3+c4+e4', bF = 'f3+a3+c4', bG = 'g3+b3+d4', bE = 'e3+g#3+b3', bDm = 'd4+f4+a4', bC = 'c4+e4+g4', bEm = 'e3+g3+b3';
const BATTLE_GROOVE = 'k h k h s h h k k h k h s h s h';
const BATTLE_FILL = 'k h k h s h h k s s s s s s s s';

const battle: TrackDef = {
  bpm: 150,
  arpRate: 0.035,
  lead: { wave: 'p25', vol: 0.1, gate: 0.88, d: 0.1, s: 0.75, r: 0.05, vib: 10, vibDelay: 0.15 },
  harm: { wave: 'p12', vol: 0.038, gate: 0.9, d: 0.1, s: 0.5, r: 0.04, pan: -0.25 },
  bass: { wave: 'tri', vol: 0.24, gate: 0.7, r: 0.03 },
  drumVol: 0.7,
  loop: [
    {
      lead: bars('a4*2 c5*2 e5*2 a5*4 g5*2 e5*2 c5*2', 'f5*4 e5*2 c5*2 a4*4 c5*4', 'd5*2 g5*2 b5*2 d6*4 c6*2 b5*2 g5*2', 'g#5*6 e5*2 b4*4 e5*2 g#5*2',
        'a5*3 g5 a5*2 e5*2 c5*2 e5*2 a5*4', 'c6*4 a5*2 f5*2 c6*2 d6*2 c6*4', 'd6*2 c6*2 a5*4 b5*2 g#5*2 e5*4', 'a5*8 e5*2 a4*2 c5*2 e5*2'),
      harm: bars(syn(bAm), syn(bF), syn(bG), syn(bE), syn(bAm), syn(bF), `${syn(bDm, 2)} ${syn(bE, 2)}`, syn(bAm)),
      bass: bars(pump('a2'), pump('f2'), pump('g2'), pump('e2'), pump('a2'), pump('f2'), `${pump('d3', 2)} ${pump('e2', 2)}`, pump('a2')),
      drums: bars(...Array(7).fill(BATTLE_GROOVE), BATTLE_FILL),
    },
    {
      lead: bars('e5*6 g5*2 c6*8', 'b5*6 a5*2 g5*8', 'a5*4 c6*4 e6*4 c6*4', 'b5*8 g5*4 e5*4',
        'f5*2 a5*2 c6*4 f6*4 e6*4', 'e6*2 d6*2 c6*4 g5*4 e5*4', 'f5*4 a5*4 d6*4 f6*4', 'e6*8 g#5*4 b5*4'),
      harm: bars(hold(bC), hold(bG), hold(bAm), hold(bEm), hold(bF), hold(bC), hold(bDm), hold(bE)),
      bass: bars(pump('c3'), pump('g2'), pump('a2'), pump('e2'), pump('f2'), pump('c3'), pump('d3'), pump('e2')),
      drums: bars(`k+c ${BATTLE_GROOVE.slice(2)}`, ...Array(6).fill(BATTLE_GROOVE), BATTLE_FILL),
    },
  ],
};

// --- Gym: tense E minor with a flat-II colour, chugging bass ---------------------

const gEm = 'e4+g4+b4', gC = 'c4+e4+g4', gF = 'f4+a4+c5', gAm = 'a3+c4+e4', gB = 'b3+d#4+f#4', gD = 'd4+f#4+a4';
const GYM_GROOVE = 'k h h k s h k h k h h k s h s h';

const gym: TrackDef = {
  bpm: 140,
  arpRate: 0.03,
  lead: { wave: 'p50', vol: 0.085, gate: 0.92, d: 0.15, s: 0.8, r: 0.05, vib: 16, vibDelay: 0.2 },
  harm: { wave: 'p25', vol: 0.035, gate: 0.8, d: 0.06, s: 0.5, r: 0.03, pan: -0.25 },
  bass: { wave: 'tri', vol: 0.25, gate: 0.75, r: 0.03 },
  drumVol: 0.8,
  loop: [
    {
      lead: bars('e5*4 .*2 e5*2 g5*2 f#5*2 e5*2 b4*2', 'c5*6 b4*2 c5*2 e5*2 g5*4', 'b5*4 .*2 b5*2 a5*2 g5*2 f#5*2 e5*2', 'f5*6 e5*2 f5*2 a5*2 c6*4',
        'b5*2 e6*2 d6*2 b5*2 c6*4 b5*4', 'g5*2 a5*2 g5*2 e5*2 c5*8', 'c5*2 e5*2 a5*4 d#5*2 f#5*2 b5*4', 'e5*12 .*4'),
      harm: bars(eighths(gEm), eighths(gC), eighths(gEm), eighths(gF), eighths(gEm), eighths(gC), `${eighths(gAm, 2)} ${eighths(gB, 2)}`, eighths(gEm)),
      bass: bars(chug('e2'), chug('c3'), chug('e2'), chug('f2'), chug('e2'), chug('c3'), `${chug('a2', 2)} ${chug('b2', 2)}`, chug('e2')),
      drums: bars(...Array(7).fill(GYM_GROOVE), 'k k s k k s k s s s s s t t t t'),
    },
    {
      lead: bars('a5*4 c6*4 b5*2 a5*2 e5*4', 'g5*4 b5*4 a5*2 g5*2 e5*4', 'c6*4 e6*4 d6*2 c6*2 a5*4', 'b5*6 a5*2 f#5*4 d#5*4',
        'e5*2 g5*2 c6*4 b5*2 g5*2 e5*4', 'f#5*2 a5*2 d6*4 c6*2 a5*2 f#5*4', 'd#6*4 c6*4 b5*4 a5*4', 'b5*4 f#5*4 d#5*4 b4*4'),
      harm: bars(eighths(gAm), eighths(gEm), eighths(gAm), eighths(gB), eighths(gC), eighths(gD), eighths(gB), eighths(gB)),
      bass: bars(chug('a2'), chug('e2'), chug('a2'), chug('b2'), chug('c3'), chug('d3'), chug('b2'), 'b2*2 b2*2 b2*2 b2*2 a2*2 a2*2 g2*2 f#2*2'),
      drums: bars(`k+c ${GYM_GROOVE.slice(2)}`, ...Array(5).fill(GYM_GROOVE), 'k h o k s h k o k h o k s h s o', 't t s t t s t s s s s s s s c*2'),
    },
  ],
};

// --- League: epic C minor, held harmony and heroic leaps -------------------------

const LEAGUE_GROOVE = 'k*2 h*2 s*2 h*2 k*2 k*2 s*2 h*2';
const LEAGUE_FILL = 'k*2 s*2 k*2 s*2 t t t t s s s s';

const league: TrackDef = {
  bpm: 126,
  arpRate: 0.04,
  echo: { steps: 3, feedback: 0.3, wet: 0.2 },
  lead: { wave: 'p25', vol: 0.1, gate: 0.95, d: 0.2, s: 0.75, r: 0.1, vib: 14, vibDelay: 0.15 },
  harm: { wave: 'p50', vol: 0.04, gate: 0.98, a: 0.03, d: 0.3, s: 0.7, r: 0.1, vib: 8, vibDelay: 0.3, pan: -0.25 },
  bass: { wave: 'tri', vol: 0.25, gate: 0.8, r: 0.04 },
  drumVol: 0.75,
  loop: [
    {
      lead: bars('c5*4 g5*4 eb5*2 d5*2 c5*4', 'c5*2 eb5*2 ab5*8 g5*2 f5*2', 'd5*2 f5*2 bb5*8 ab5*2 g5*2', 'g5*6 f5*2 eb5*2 d5*2 b4*4',
        'c5*2 eb5*2 g5*4 c6*6 bb5*2', 'ab5*4 g5*2 f5*2 eb5*4 c5*4', 'f5*4 ab5*4 g5*4 b5*4', 'c6*12 .*4'),
      harm: bars('eb4*8 g4*8', 'eb4*8 c4*8', 'd4*8 f4*8', 'd4*8 b3*8', 'g4*8 eb4*8', 'c4*8 ab3*8', 'ab3*8 b3*8', 'c4*8 g3*8'),
      bass: bars(octs('c3'), octs('ab2'), octs('bb2'), octs('g2'), octs('c3'), octs('ab2'), `${octs('f2', 2)} ${octs('g2', 2)}`, octs('c3')),
      drums: bars(`k+c*2 ${LEAGUE_GROOVE.slice(4)}`, ...Array(6).fill(LEAGUE_GROOVE), LEAGUE_FILL),
    },
    {
      lead: bars('eb6*6 c6*2 ab5*8', 'f6*6 d6*2 bb5*8', 'g6*4 f6*2 eb6*2 bb5*4 g5*4', 'c6*8 g5*4 eb5*4',
        'ab5*4 c6*4 eb6*4 c6*4', 'd6*4 f6*4 d6*4 bb5*4', 'b5*6 d6*2 g6*8', 'f6*4 eb6*4 d6*4 b5*4'),
      harm: bars('c4*8 eb4*8', 'd4*8 f4*8', 'eb4*8 g4*8', 'eb4*8 g4*8', 'ab4*8 c5*8', 'bb4*8 d5*8', 'b4*8 d5*8', 'b4*8 g4*8'),
      bass: bars(octs('ab2'), octs('bb2'), octs('eb3'), octs('c3'), octs('ab2'), octs('bb2'), octs('g2'), pump('g2')),
      drums: bars(`k+c*2 ${LEAGUE_GROOVE.slice(4)}`, ...Array(6).fill(LEAGUE_GROOVE), LEAGUE_FILL),
    },
  ],
};

// --- Champion: grand, triumphant B-flat major march ------------------------------

const CHAMP_GROOVE = 'k*2 h*2 s*2 s s k*2 h*2 s*2 s s';

const champion: TrackDef = {
  bpm: 120,
  arpRate: 0.04,
  echo: { steps: 3, feedback: 0.28, wet: 0.2 },
  lead: { wave: 'p25', vol: 0.105, gate: 0.92, d: 0.15, s: 0.8, r: 0.08, vib: 14, vibDelay: 0.15 },
  harm: { wave: 'p50', vol: 0.045, gate: 0.95, d: 0.2, s: 0.7, r: 0.08, pan: -0.25 },
  bass: { wave: 'tri', vol: 0.25, gate: 0.75, r: 0.04 },
  drumVol: 0.75,
  loop: [
    {
      lead: bars('f4*2 bb4*2 d5*4 f5*6 d5*2', 'c5*2 f5*2 a5*4 c6*6 a5*2', 'bb5*4 a5*2 g5*2 d5*4 g5*4', 'g5*6 f5*2 eb5*4 bb4*4',
        'd5*2 f5*2 bb5*4 d6*6 c6*2', 'c6*4 a5*2 f5*2 c6*4 eb6*4', 'g5*2 bb5*2 eb6*4 f5*2 a5*2 c6*4', 'bb5*12 .*4'),
      harm: bars('d4*4 f4*4 bb4*8', 'c4*4 f4*4 a4*8', 'd4*4 g4*4 bb4*8', 'eb4*4 g4*4 bb4*8',
        'd4*4 f4*4 bb4*8', 'c4*4 f4*4 a4*4 eb4*4', 'eb4*4 g4*4 f4*4 a4*4', 'd4*4 f4*4 bb4*8'),
      bass: bars(octs('bb2'), octs('f2'), octs('g2'), octs('eb3'), octs('bb2'), octs('f2'), `${octs('eb3', 2)} ${octs('f2', 2)}`, octs('bb2')),
      drums: bars(`k+c*2 ${CHAMP_GROOVE.slice(4)}`, ...Array(6).fill(CHAMP_GROOVE), 's s s s s s s s t t t t s s s s'),
    },
    {
      lead: bars('g5*4 bb5*4 eb6*8', 'f5*4 a5*4 c6*8', 'd6*4 c6*2 a5*2 f5*4 a5*4', 'g5*6 a5*2 bb5*8',
        'c6*4 eb6*4 g6*4 eb6*4', 'f6*6 eb6*2 c6*4 a5*4', 'bb5*2 c6*2 eb6*4 c6*2 eb6*2 f6*4', 'f6*8 d6*4 bb5*4'),
      harm: bars('eb4*8 g4*8', 'f4*8 a4*8', 'f4*8 a4*8', 'd4*8 g4*8', 'eb4*8 g4*8', 'a4*8 c5*8', 'g4*8 a4*8', 'f4*8 d4*8'),
      bass: bars(octs('eb3'), octs('f2'), octs('d3'), octs('g2'), octs('c3'), octs('f2'), `${octs('eb3', 2)} ${octs('f2', 2)}`, octs('bb2')),
      drums: bars(`k+c*2 ${CHAMP_GROOVE.slice(4)}`, ...Array(6).fill(CHAMP_GROOVE), 's s s s s s s s t t t t s s s s'),
    },
  ],
};

export const TRACKS: Record<MusicTrack, TrackDef> = { title, menu, capture, battle, gym, league, champion };
