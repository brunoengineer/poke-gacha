// Tiny text score format for the music and jingles. One token per event, separated by spaces; `|` marks bars.
//   c5  f#4  bb3      a note (1 step = a 16th note)       c5*4    a note lasting 4 steps
//   .   .*4           rest                                 c4+e4+g4*8  chord, played as a fast arpeggio
//   k s h o t c       drums: kick, snare, closed/open hat, tom, crash; combine with + (k+c*2)

export type Drum = 'k' | 's' | 'h' | 'o' | 't' | 'c';

export interface ScoreEvent {
  at: number;
  len: number;
  /** MIDI notes (melodic lines) — empty for drum lines. */
  notes: number[];
  hits: Drum[];
}

export interface Line {
  events: ScoreEvent[];
  length: number;
  /** Length in steps of each `|`-separated bar. */
  bars: number[];
}

const SEMI: Record<string, number> = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const NAMES = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b'];
const DRUMS = new Set<string>(['k', 's', 'h', 'o', 't', 'c']);

export function noteMidi(name: string): number {
  const m = /^([a-g])([#b]?)(\d)$/.exec(name);
  if (!m) throw new Error(`Bad note "${name}"`);
  return 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

export const noteName = (midi: number) => `${NAMES[midi % 12]}${Math.floor(midi / 12) - 1}`;

/** Transposes a note name by `semis` semitones. */
export const tr = (name: string, semis: number) => noteName(noteMidi(name) + semis);

export function parseLine(src: string, drums = false): Line {
  const events: ScoreEvent[] = [];
  const bars: number[] = [];
  let at = 0;
  let barStart = 0;
  for (const token of src.trim().split(/\s+/)) {
    if (!token) continue;
    if (token === '|') {
      bars.push(at - barStart);
      barStart = at;
      continue;
    }
    const [item, count] = token.split('*');
    const len = count === undefined ? 1 : Number(count);
    if (!Number.isInteger(len) || len < 1) throw new Error(`Bad length in "${token}"`);
    if (item !== '.') {
      const parts = item.split('+');
      if (drums) {
        if (!parts.every(p => DRUMS.has(p))) throw new Error(`Bad drum "${token}"`);
        events.push({ at, len, notes: [], hits: parts as Drum[] });
      } else {
        events.push({ at, len, notes: parts.map(noteMidi), hits: [] });
      }
    }
    at += len;
  }
  if (at > barStart) bars.push(at - barStart);
  return { events, length: at, bars };
}

export const rep = (s: string, n: number) => Array.from({ length: n }, () => s).join(' ');
