// Instruments shared by the music sequencer and the jingles: melodic channels (pulse/triangle with an
// envelope, vibrato and chord arpeggios) and a noise drum kit.

import type { Drum, Line, ScoreEvent } from './score';
import { parseLine } from './score';
import { hz, noise, tone, type Wave } from './synth';

export interface Instrument {
  wave: Wave;
  vol: number;
  /** Fraction of the note length that sounds (lower = staccato). */
  gate?: number;
  a?: number;
  d?: number;
  s?: number;
  r?: number;
  vib?: number;
  vibRate?: number;
  vibDelay?: number;
  pan?: number;
  detune?: number;
}

/** Plays one melodic event. Chords become a fast arpeggio (the classic handheld way to fake polyphony). */
export function playNote(c: BaseAudioContext, dest: AudioNode, t: number, ev: ScoreEvent, inst: Instrument, step: number, arpRate = 0.045) {
  const root = ev.notes[0];
  const dur = Math.max(0.03, ev.len * step * (inst.gate ?? 0.9));
  return tone(c, dest, t, {
    f: hz(root),
    dur,
    vol: inst.vol,
    wave: inst.wave,
    a: inst.a,
    d: inst.d,
    s: inst.s,
    r: inst.r,
    vib: inst.vib,
    vibRate: inst.vibRate,
    vibDelay: inst.vibDelay,
    pan: inst.pan,
    detune: inst.detune,
    arp: ev.notes.length > 1 ? ev.notes.map(n => n - root) : undefined,
    arpRate,
  });
}

/** One drum hit; `vol` scales the whole kit. */
export function playDrum(c: BaseAudioContext, dest: AudioNode, t: number, drum: Drum, vol: number) {
  switch (drum) {
    case 'k':
      tone(c, dest, t, { f: 150, to: 42, glide: 0.11, dur: 0.07, vol: 0.45 * vol, wave: 'sine', a: 0.002, r: 0.06 });
      noise(c, dest, t, { dur: 0.008, vol: 0.18 * vol, kind: 'crunch', filter: 'lowpass', freq: 1800, r: 0.015 });
      break;
    case 's':
      noise(c, dest, t, { dur: 0.02, vol: 0.32 * vol, kind: 'crunch', filter: 'highpass', freq: 1100, d: 0.09, s: 0.2, r: 0.08 });
      tone(c, dest, t, { f: 240, to: 130, glide: 0.06, dur: 0.03, vol: 0.18 * vol, wave: 'tri', r: 0.04 });
      break;
    case 'h':
      noise(c, dest, t, { dur: 0.012, vol: 0.12 * vol, kind: 'metal', filter: 'highpass', freq: 7000, r: 0.03 });
      break;
    case 'o':
      noise(c, dest, t, { dur: 0.04, vol: 0.1 * vol, kind: 'metal', filter: 'highpass', freq: 6000, d: 0.1, s: 0.5, r: 0.14 });
      break;
    case 't':
      tone(c, dest, t, { f: 190, to: 85, glide: 0.16, dur: 0.1, vol: 0.32 * vol, wave: 'tri', r: 0.08 });
      noise(c, dest, t, { dur: 0.01, vol: 0.08 * vol, kind: 'crunch', filter: 'lowpass', freq: 1200, r: 0.04 });
      break;
    case 'c':
      noise(c, dest, t, { dur: 0.05, vol: 0.16 * vol, kind: 'white', filter: 'highpass', freq: 3500, d: 0.4, s: 0.35, r: 0.9 });
      break;
  }
}

export interface Jingle {
  bpm: number;
  lead?: string;
  harm?: string;
  bass?: string;
  drums?: string;
  leadInst?: Partial<Instrument>;
  harmInst?: Partial<Instrument>;
  bassInst?: Partial<Instrument>;
  drumVol?: number;
  arpRate?: number;
}

const JINGLE_LEAD: Instrument = { wave: 'p25', vol: 0.11, gate: 0.92, d: 0.12, s: 0.75, r: 0.06, vib: 14, vibDelay: 0.18 };
const JINGLE_HARM: Instrument = { wave: 'p12', vol: 0.06, gate: 0.9, d: 0.1, s: 0.7, r: 0.06, pan: -0.2 };
const JINGLE_BASS: Instrument = { wave: 'tri', vol: 0.24, gate: 0.85, r: 0.05 };

const parsed = new Map<string, Line>();
function cachedLine(src: string, drums: boolean) {
  const key = (drums ? 'd:' : 'm:') + src;
  let line = parsed.get(key);
  if (!line) parsed.set(key, (line = parseLine(src, drums)));
  return line;
}

/** Schedules a short multi-channel tune at once; returns its duration in seconds. */
export function playJingle(c: BaseAudioContext, dest: AudioNode, t: number, j: Jingle): number {
  const step = 60 / j.bpm / 4;
  let end = t;
  const melodic: [string | undefined, Instrument][] = [
    [j.lead, { ...JINGLE_LEAD, ...j.leadInst }],
    [j.harm, { ...JINGLE_HARM, ...j.harmInst }],
    [j.bass, { ...JINGLE_BASS, ...j.bassInst }],
  ];
  for (const [src, inst] of melodic) {
    if (!src) continue;
    for (const ev of cachedLine(src, false).events) end = Math.max(end, playNote(c, dest, t + ev.at * step, ev, inst, step, j.arpRate));
  }
  if (j.drums) {
    for (const ev of cachedLine(j.drums, true).events) {
      for (const hit of ev.hits) playDrum(c, dest, t + ev.at * step, hit, j.drumVol ?? 0.6);
      end = Math.max(end, t + (ev.at + ev.len) * step);
    }
  }
  return end - t;
}
