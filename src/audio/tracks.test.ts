import { describe, expect, it } from 'vitest';
import { noteMidi, noteName, parseLine, tr } from './score';
import { TRACKS } from './tracks';

describe('score format', () => {
  it('parses notes, rests, lengths, chords and drums', () => {
    expect(noteMidi('a4')).toBe(69);
    expect(noteMidi('bb3')).toBe(58);
    expect(noteMidi('f#5')).toBe(78);
    expect(noteName(61)).toBe('c#4');
    expect(tr('g2', 12)).toBe('g3');
    const line = parseLine('c5*4 . e5+g5*2 | g5*8 .*8');
    expect(line.length).toBe(23);
    expect(line.bars).toEqual([7, 16]);
    expect(line.events[1]).toMatchObject({ at: 5, len: 2, notes: [76, 79] });
    expect(parseLine('k+c*2 h', true).events[0].hits).toEqual(['k', 'c']);
    expect(() => parseLine('x5')).toThrow();
    expect(() => parseLine('q', true)).toThrow();
  });
});

describe('music tracks', () => {
  for (const [name, track] of Object.entries(TRACKS)) {
    it(`${name}: every channel has 16-step bars and the same length`, () => {
      track.loop.forEach((section, i) => {
        const lengths: number[] = [];
        for (const key of ['lead', 'harm', 'bass', 'drums'] as const) {
          const src = section[key];
          if (!src) continue;
          const line = parseLine(src, key === 'drums');
          line.bars.forEach((bar, b) => expect(bar, `${name} section ${i} ${key} bar ${b + 1}`).toBe(16));
          for (const ev of line.events) {
            for (const n of ev.notes) expect(n, `${name} ${key}`).toBeGreaterThanOrEqual(40), expect(n).toBeLessThanOrEqual(96);
          }
          lengths.push(line.length);
        }
        expect(new Set(lengths).size, `${name} section ${i} lengths ${lengths}`).toBe(1);
      });
    });
  }
});
