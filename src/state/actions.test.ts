import { describe, expect, it, vi } from 'vitest';
import { cardKey } from '../game/cards';
import { dayKey } from '../game/rng';
import { claimDaily, grant } from './actions';
import { defaultSave } from './save';
import { on, store } from './store';

describe('actions', () => {
  it('reports the pulled species too when its copy levels an evolved card', () => {
    store.save = defaultSave();
    store.save.cards[cardKey(5)] = { level: 20, copies: 1, obtainedAt: 0 };
    let changed: unknown;
    const off = on('cards', keys => { changed = keys; });
    grant([{ kind: 'card', id: 4 }]);
    off();
    expect(store.save.cards[cardKey(5)].level).toBe(21);
    expect(store.save.caught[4]).toBeTruthy();
    // The Charmander tile must refresh (now registered), not only Charmeleon's.
    expect(changed).toEqual(expect.arrayContaining([cardKey(5), cardKey(4)]));
  });

  it('keeps the daily streak on the day after a DST change', () => {
    vi.stubEnv('TZ', 'America/New_York');
    try {
      // 8 March 2026 has 23 hours there: at 00:30 on the 9th, "24 hours ago" is already the 7th.
      const now = new Date(2026, 2, 9, 0, 30);
      expect(dayKey(new Date(now.getTime() - 86_400_000))).toBe('2026-03-07');
      store.save = defaultSave();
      store.save.daily = { last: '2026-03-08', streak: 3 };
      expect(claimDaily(now)?.streak).toBe(4);
    } finally {
      vi.unstubAllEnvs();
    }
  });
});
