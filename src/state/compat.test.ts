// Save compatibility: every released save format must keep loading, unchanged, in every later version.
// When a release ships, add one of its saves to ./fixtures (never edit or remove the old ones).

import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasSpecies } from '../data/species';
import { parseKey } from '../game/cards';
import { addCopy } from '../game/progression';
import { migrateSave, normalizeSave, SAVE_VERSION, type SaveData } from './save';

// Read from disk on every run (an import.meta.glob would be cached by Vitest and could miss a newly added fixture).
const dir = new URL('./fixtures/', import.meta.url);
const fixtures = Object.fromEntries(readdirSync(dir).filter(file => file.endsWith('.json')).map(file =>
  [file, { default: JSON.parse(readFileSync(new URL(file, dir), 'utf8')) as Record<string, unknown> }]));

describe('released saves', () => {
  it('has fixtures to check', () => {
    expect(Object.keys(fixtures).length).toBeGreaterThan(0);
  });

  for (const [file, { default: raw }] of Object.entries(fixtures)) {
    describe(file, () => {
      const original = structuredClone(raw) as unknown as SaveData;
      const save = normalizeSave(structuredClone(raw));

      it('keeps every card, level and copy count', () => {
        expect(Object.keys(save.cards).sort()).toEqual(Object.keys(original.cards).sort());
        for (const [key, card] of Object.entries(original.cards)) expect(save.cards[key]).toMatchObject(card);
      });

      it('keeps the team, coins, items, Pokédex and progress', () => {
        expect(save.deck).toEqual(original.deck);
        expect(save.coins).toBe(original.coins);
        expect(save.items).toEqual(original.items);
        expect(save.caught).toEqual(original.caught);
        expect(save.gyms.badges).toEqual(original.gyms.badges);
        expect(save.ladder).toMatchObject(original.ladder);
        expect(save.league).toMatchObject(original.league);
        expect(save.stats).toMatchObject(original.stats);
        expect(save.starter).toBe(original.starter);
      });

      it('upgrades to the current version and stays stable when loaded again', () => {
        expect(save.v).toBe(SAVE_VERSION);
        expect(normalizeSave(structuredClone(save))).toEqual(save);
      });

      it('only references species the game still knows', () => {
        for (const key of Object.keys(save.cards)) expect(hasSpecies(parseKey(key).id)).toBe(true);
      });

      it('keeps working with the current rules', () => {
        const copy = addCopy(save, parseKey(save.deck[0]).id);
        expect(['level', 'max']).toContain(copy.kind);
      });
    });
  }
});

describe('saves from a newer version of the app', () => {
  it('keeps fields this version does not know, at any depth', () => {
    const future = {
      ...normalizeSave({}),
      v: SAVE_VERSION + 1,
      contests: { ribbons: ['cool'] },
      league: { runs: 1, best: 0, titles: 0, hoenn: { titles: 2 } },
    };
    const loaded = normalizeSave(structuredClone(future)) as SaveData & { contests?: unknown };
    expect(loaded.contests).toEqual({ ribbons: ['cool'] });
    expect((loaded.league as unknown as { hoenn: unknown }).hoenn).toEqual({ titles: 2 });
    expect(loaded.v).toBe(SAVE_VERSION + 1);
  });

  it('runs migrations in order from old versions', () => {
    expect(migrateSave({ v: 1 }).v).toBe(SAVE_VERSION);
    expect(migrateSave({}).v).toBe(SAVE_VERSION);
  });
});
