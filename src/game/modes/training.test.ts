import { describe, expect, it } from 'vitest';
import { RARE_CANDY } from '../../data/items';
import { getSpecies } from '../../data/species';
import { seeded } from '../rng';
import {
  averageLevel, defaultTrainingSave, DIFFICULTY, firstWinToday, FRIENDS, friendSpecies, getFriend, GIFTS, levelRange,
  LOSS_COINS, recordTraining, rivalStarter, trainingRewards, trainingTeam, winCoins,
} from './training';

describe('training roster', () => {
  it('has unique ids and enough species for a full team', () => {
    expect(new Set(FRIENDS.map(f => f.id)).size).toBe(FRIENDS.length);
    for (const friend of FRIENDS) {
      expect(friendSpecies(friend, seeded(1))).toHaveLength(6);
      for (const id of [...friend.pool, ...(friend.signature ?? [])]) expect(() => getSpecies(id)).not.toThrow();
    }
  });

  it('always brings signature Pokémon', () => {
    const joey = getFriend('joey')!;
    for (let seed = 0; seed < 20; seed++) expect(friendSpecies(joey, seeded(seed))).toContain(19);
  });

  it('gives the rival the starter that beats the player', () => {
    expect(rivalStarter(1)).toBe(4);
    expect(rivalStarter(4)).toBe(7);
    expect(rivalStarter(7)).toBe(1);
    expect(friendSpecies(getFriend('blue')!, seeded(3), 7)).toContain(1);
  });
});

describe('training scaling', () => {
  it('places opponents around the team average per difficulty', () => {
    expect(levelRange(30, 'easy')).toEqual([27, 29]);
    expect(levelRange(30, 'normal')).toEqual([29, 31]);
    expect(levelRange(30, 'hard')).toEqual([32, 35]);
    expect(levelRange(1, 'easy')).toEqual([2, 2]);
  });

  it('rolls teams inside the range and evolves them for their level', () => {
    const team = trainingTeam(getFriend('swimmer')!, 40, 'hard', seeded(7));
    expect(team).toHaveLength(6);
    for (const m of team) {
      expect(m.level).toBeGreaterThanOrEqual(42);
      expect(m.level).toBeLessThanOrEqual(45);
    }
    expect(team.map(m => m.id)).toContain(130); // Magikarp -> Gyarados
    expect(averageLevel(team)).toBeGreaterThanOrEqual(42);
  });
});

describe('training rewards', () => {
  it('pays coins by difficulty and opponent level', () => {
    expect(winCoins('easy', 10)).toBe(70);
    expect(winCoins('normal', 10)).toBe(110);
    expect(winCoins('hard', 10)).toBe(170);
  });

  it('adds a Rare Candy for the first win of the day', () => {
    const rewards = trainingRewards({ difficulty: 'easy', result: 'win', level: 10, firstWin: true, rng: seeded(1) });
    expect(rewards).toEqual([{ kind: 'coins', amount: 70 }, { kind: 'item', item: RARE_CANDY, amount: 1 }]);
  });

  it('pays a little for a loss and nothing for a forfeit', () => {
    expect(trainingRewards({ difficulty: 'hard', result: 'lose', level: 50, firstWin: true })).toEqual([{ kind: 'coins', amount: LOSS_COINS }]);
    expect(trainingRewards({ difficulty: 'hard', result: 'forfeit', level: 50, firstWin: true })).toEqual([]);
  });

  it('gives gifts at the documented rate (never on easy)', () => {
    const rng = seeded(42);
    const count = (difficulty: 'easy' | 'normal' | 'hard') => {
      let gifts = 0;
      for (let i = 0; i < 4000; i++) {
        const rewards = trainingRewards({ difficulty, result: 'win', level: 20, firstWin: false, rng });
        const gift = rewards.find(r => r.kind === 'item');
        if (gift && gift.kind === 'item') {
          expect(GIFTS).toContain(gift.item);
          gifts++;
        }
      }
      return gifts / 4000;
    };
    expect(count('easy')).toBe(0);
    expect(count('normal')).toBeCloseTo(DIFFICULTY.normal.giftChance, 1);
    expect(count('hard')).toBeCloseTo(DIFFICULTY.hard.giftChance, 1);
  });
});

describe('training records', () => {
  it('tracks wins, losses and the first win of each day', () => {
    const save = defaultTrainingSave();
    const day = new Date(2026, 10, 1, 10).getTime();
    expect(firstWinToday(save.records.joey, day)).toBe(true);
    recordTraining(save, 'joey', true, day);
    recordTraining(save, 'joey', false, day);
    expect(save.records.joey).toEqual({ wins: 1, losses: 1, lastWinAt: day });
    expect(firstWinToday(save.records.joey, day + 3_600_000)).toBe(false);
    expect(firstWinToday(save.records.joey, day + 86_400_000)).toBe(true);
  });
});
