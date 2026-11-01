import { describe, expect, it } from 'vitest';
import { chooseAccountSave, defaultSave, normalizeSave } from './save';

describe('normalizeSave', () => {
  it('returns a fresh save for garbage', () => {
    expect(normalizeSave(null)).toMatchObject({ v: 1, cards: {}, deck: [] });
    expect(normalizeSave('nope').coins).toBe(defaultSave().coins);
  });

  it('fills missing fields and drops team slots for cards not owned', () => {
    const s = normalizeSave({ coins: 42.7, cards: { 4: { level: 9, copies: 9, obtainedAt: 1 } }, deck: ['4', '6'], settings: { music: false } });
    expect(s.coins).toBe(42);
    expect(s.deck).toEqual(['4']);
    expect(s.settings.music).toBe(false);
    expect(s.settings.sound).toBe(true);
    expect(s.gyms.badges).toEqual([]);
    expect(s.ladder.rating).toBe(0);
  });
});

describe('chooseAccountSave', () => {
  const at = (updatedAt: number) => ({ ...defaultSave(), updatedAt, starter: 1 });

  it('uses the newest of local and cloud', () => {
    expect(chooseAccountSave(at(5), at(9), true, null)).toMatchObject({ kind: 'use', save: { updatedAt: 9 } });
    expect(chooseAccountSave(at(9), at(5), true, null)).toMatchObject({ kind: 'use', save: { updatedAt: 9 } });
  });

  it('adopts guest progress for a brand-new account', () => {
    expect(chooseAccountSave(null, null, true, at(3))).toMatchObject({ kind: 'use', fromGuest: true });
  });

  it('aborts when the cloud is unreachable and nothing is cached', () => {
    expect(chooseAccountSave(null, null, false, at(3))).toEqual({ kind: 'abort' });
  });
});
