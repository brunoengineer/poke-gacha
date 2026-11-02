import { describe, expect, it, vi } from 'vitest';
import { cardKey } from '../game/cards';
import { dailyGift } from '../game/economy';
import { dayKey } from '../game/rng';
import { claimDaily, grant } from './actions';
import { defaultSave } from './save';
import { on, store } from './store';

describe('actions', () => {
  it('reports the pulled species too when its copy levels an evolved card', () => {
    store.save = defaultSave();
    store.save.cards[cardKey(5)] = { level: 20, copies: 1, obtainedAt: 0 };
    store.save.evolved[4] = 1; // the player's Charmander evolved into this Charmeleon
    let changed: unknown;
    const off = on('cards', keys => { changed = keys; });
    grant([{ kind: 'card', id: 4 }]);
    off();
    expect(store.save.cards[cardKey(5)].level).toBe(21);
    expect(store.save.caught[4]).toBeTruthy();
    // The Charmander tile must refresh (now registered), not only Charmeleon's.
    expect(changed).toEqual(expect.arrayContaining([cardKey(5), cardKey(4)]));
  });

  it('gives Master Balls from the second day of a streak: 1 a day, 5 on every 7th', () => {
    expect([1, 2, 3, 6, 7, 8, 13, 14, 15].map(day => dailyGift(day).balls)).toEqual([0, 1, 1, 1, 5, 1, 1, 5, 1]);
    expect(dailyGift(7).candy).toBe(5);
    expect(dailyGift(6).candy).toBe(2);
    store.save = defaultSave();
    store.save.daily = { last: '2026-03-08', streak: 6 };
    expect(claimDaily(new Date(2026, 2, 9, 12))).toMatchObject({ streak: 7, balls: 5 });
    expect(store.save.items['master-ball']).toBe(5);
    // A missed day restarts the streak: no ball on its first day.
    store.save.daily = { last: '2026-03-01', streak: 30 };
    expect(claimDaily(new Date(2026, 2, 9, 12))).toMatchObject({ streak: 1, balls: 0 });
    expect(store.save.items['master-ball']).toBe(5);
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
