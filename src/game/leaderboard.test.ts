import { describe, expect, it } from 'vitest';
import { defaultSave, normalizeSave } from '../state/save';
import { cardPower } from './cards';
import { cleanNickname, defaultOnlineSave, readEntry, sortEntries, statsFromSave, validNickname } from './leaderboard';

describe('nicknames', () => {
  it('accepts letters of any language, numbers and a few symbols', () => {
    for (const name of ['Ash', 'Bruno Peres', 'Ana_01', 'João', 'A.B-C', 'ポケモン']) expect(validNickname(name), name).toBe(true);
  });

  it('refuses names too short, too long, or with markup', () => {
    for (const name of ['', 'ab', '  a ', 'x'.repeat(17), '<img src=x>', 'a"b', 'a&b']) expect(validNickname(name), name).toBe(false);
  });

  it('cleans extra spaces', () => {
    expect(cleanNickname('  Red   Ranger ')).toBe('Red Ranger');
  });
});

describe('published stats', () => {
  it('counts the best floor, the six strongest cards, and the species caught plus the shinies', () => {
    const save = defaultSave();
    save.tower.best = 12;
    save.caught = { 4: 1, 5: 1, 6: 1 };
    const levels: [string, number, number, boolean][] = [['6', 6, 50, false], ['9', 9, 40, false], ['3', 3, 30, false], ['25', 25, 20, false], ['19', 19, 10, false], ['16', 16, 9, false], ['10', 10, 1, false], ['6s', 6, 60, true]];
    for (const [key, , level] of levels) save.cards[key] = { level, copies: 1, obtainedAt: 0 };
    const stats = statsFromSave(save);
    expect(stats.tower).toBe(12);
    expect(stats.caught).toBe(4); // 3 species + the shiny Charizard
    const expected = levels.map(([, id, level, shiny]) => cardPower(id, level, shiny)).sort((a, b) => b - a).slice(0, 6).reduce((s, p) => s + p, 0);
    expect(stats.power).toBe(expected);
    expect(Number.isInteger(stats.power)).toBe(true);
  });

  it('skips a card this version of the game does not know', () => {
    const save = defaultSave();
    save.cards['99999'] = { level: 50, copies: 1, obtainedAt: 0 };
    save.cards['99999s'] = { level: 50, copies: 1, obtainedAt: 0 };
    const stats = statsFromSave(save);
    expect(stats.power).toBe(0);
    expect(stats.caught).toBe(0);
  });

  it('starts empty on a new save', () => {
    expect(statsFromSave(defaultSave())).toEqual({ tower: 0, power: 0, caught: 0 });
  });
});

describe('reading entries from other players', () => {
  it('keeps only well-formed values', () => {
    expect(readEntry('u1', { name: 'Misty', tower: 12, power: 900, caught: 40, updatedAt: {} })).toEqual({ uid: 'u1', name: 'Misty', tower: 12, power: 900, caught: 40 });
    expect(readEntry('u1', { name: 'Misty', tower: 'lots', power: -5, caught: Infinity })).toEqual({ uid: 'u1', name: 'Misty', tower: 0, power: 0, caught: 0 });
  });

  it('drops entries with a bad name', () => {
    expect(readEntry('u1', { name: '<script>alert(1)</script>', tower: 99 })).toBeNull();
    expect(readEntry('u1', { tower: 99 })).toBeNull();
    expect(readEntry('u1', null)).toBeNull();
    expect(readEntry('u1', 'nope')).toBeNull();
  });

  it('sorts highest first, with ties in a stable order', () => {
    const entries = [
      { uid: 'b', name: 'Bbb', tower: 5, power: 1, caught: 1 },
      { uid: 'a', name: 'Aaa', tower: 5, power: 2, caught: 1 },
      { uid: 'c', name: 'Ccc', tower: 9, power: 3, caught: 1 },
    ];
    expect(sortEntries(entries, 'tower').map(e => e.uid)).toEqual(['c', 'a', 'b']);
    expect(sortEntries(entries, 'power').map(e => e.uid)).toEqual(['c', 'a', 'b']);
  });
});

describe('saves', () => {
  it('keeps the choice across loads, and older saves have not joined', () => {
    const save = defaultSave();
    save.online = { joined: true, nickname: 'Misty' };
    expect(normalizeSave(structuredClone(save)).online).toEqual({ joined: true, nickname: 'Misty' });
    const old = defaultSave() as unknown as Record<string, unknown>;
    delete old.online;
    expect(normalizeSave(old).online).toEqual(defaultOnlineSave());
  });
});
