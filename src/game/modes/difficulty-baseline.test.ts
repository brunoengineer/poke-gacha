// The designed difficulty and prizes, written out on purpose: every number here was tuned by hand or asked for. If a
// change fails this file, either it's an accident (fix the change) or the design changed (update the table here, in
// the same commit, so the change is visible in review).

import { describe, expect, it } from 'vitest';
import { defaultSave } from '../../state/save';
import { REGION_IDS, type RegionId } from '../regions';
import { seeded } from '../rng';
import { LADDER_SIZE, ladderLevel, MILESTONES, milestonePreview, rankedLevel, winCoins as ladderCoins } from './competition';
import { FIRST_WIN_CANDY, gymRewards, gymTeam, REGION_GYMS, REMATCH_CANDY, REMATCH_LEVELS, REMATCH_MAX } from './gyms';
import { buildBracket, duelInfo, duelLevels, leagueFee, MAX_BONUS, placementRewards, startRun, TITLE_BONUS } from './league';
import { floorLevel, floorRewards } from './tower';
import { DIFFICULTY, levelRange, winCoins as trainingCoins } from './training';

const GYMS: Record<RegionId, [string, number, number, number][]> = {
  kanto: [
    ['brock', 15, 19, 250], ['misty', 18, 22, 500], ['surge', 24, 28, 750], ['erika', 30, 34, 1000],
    ['koga', 36, 40, 1250], ['sabrina', 42, 46, 1500], ['blaine', 48, 52, 1750], ['giovanni', 54, 58, 2500],
  ],
  johto: [
    ['falkner', 60, 64, 2500], ['bugsy', 63, 67, 2750], ['whitney', 66, 70, 3000], ['morty', 69, 73, 3250],
    ['chuck', 72, 76, 3500], ['jasmine', 75, 79, 3750], ['pryce', 78, 82, 4000], ['clair', 81, 86, 5000],
  ],
  hoenn: [
    ['roxanne', 100, 103, 5000], ['brawly', 102, 105, 5250], ['wattson', 104, 107, 5500], ['flannery', 106, 109, 5750],
    ['norman', 108, 111, 6000], ['winona', 110, 113, 6250], ['tate-liza', 112, 115, 6500], ['juan', 114, 117, 7500],
  ],
  sinnoh: [
    ['roark', 120, 123, 7500], ['gardenia', 122, 125, 7750], ['maylene', 124, 127, 8000], ['wake', 126, 129, 8250],
    ['fantina', 128, 131, 8500], ['byron', 130, 133, 8750], ['candice', 132, 135, 9000], ['volkner', 134, 137, 10000],
  ],
};

const LEAGUE_LEVELS: Record<RegionId, [number, number][]> = {
  kanto: [[60, 63], [62, 66], [64, 68], [66, 70]],
  johto: [[88, 91], [90, 94], [92, 96], [94, 98]],
  hoenn: [[114, 116], [115, 118], [117, 119], [118, 120]],
  sinnoh: [[134, 136], [135, 138], [137, 139], [138, 140]],
};

const item = (id: string, amount: number) => ({ kind: 'item', item: id, amount });
const coins = (amount: number) => ({ kind: 'coins', amount });

describe('designed difficulty', () => {
  for (const region of REGION_IDS) {
    it(`${region} gyms: leaders, levels and coins`, () => {
      expect(REGION_GYMS[region].map(g => [g.id, g.levels[0], g.levels[1], g.coins])).toEqual(GYMS[region]);
    });

    it(`${region} gyms: a first battle stays inside the designed levels`, () => {
      for (const gym of REGION_GYMS[region]) {
        const team = gymTeam(defaultSave().gyms, gym, seeded(11));
        expect(team).toHaveLength(6);
        for (const member of team) {
          expect(member.level, gym.id).toBeGreaterThanOrEqual(gym.levels[0]);
          expect(member.level, gym.id).toBeLessThanOrEqual(gym.levels[1]);
        }
      }
    });

    it(`${region} league: duel levels and fee`, () => {
      expect([0, 1, 2, 3].map(duel => duelLevels(duel, 0, region))).toEqual(LEAGUE_LEVELS[region]);
    });

    it(`${region} league: every duel of a first run stays inside the designed levels`, () => {
      const save = defaultSave();
      save.starter = 4;
      save.coins = leagueFee(region);
      save.gyms.badges = REGION_GYMS[region].map(g => g.badge);
      save.deck = ['6', '9', '3', '25', '143', '130'];
      for (const key of save.deck) save.cards[key] = { level: 50, copies: 1, obtainedAt: 0 };
      expect(startRun(save, 5, 0, region)).toBe(true);
      const run = region === 'kanto' ? save.league.run! : save.league[region]!.run!;
      const bracket = buildBracket(save.ladder.seed, run.seed, save.starter, region);
      for (const duel of [0, 1, 2, 3]) {
        const info = duelInfo(bracket, run, duel, save.starter, region);
        const [lo, hi] = LEAGUE_LEVELS[region][duel];
        expect(info.levels).toEqual([lo, hi]);
        expect(info.team).toHaveLength(6);
        for (const member of info.team) {
          expect(member.level).toBeGreaterThanOrEqual(lo);
          expect(member.level).toBeLessThanOrEqual(hi);
        }
      }
    });
  }

  it('rematches and League titles add the designed bonus', () => {
    expect([REMATCH_LEVELS, REMATCH_MAX, REMATCH_CANDY, FIRST_WIN_CANDY]).toEqual([10, 40, 3, 5]);
    expect([TITLE_BONUS, MAX_BONUS]).toEqual([5, 40]);
    expect(duelLevels(3, 40, 'sinnoh')).toEqual([178, 180]);
  });

  it('ranked ladder: +10% over the team average per place above, never below the rank level', () => {
    expect([54, 53, 52, 51, 50].map(rank => rankedLevel(rank, 55, 100))).toEqual([110, 120, 130, 140, 150]);
    expect(rankedLevel(1, 2, 10)).toBe(63); // a weak team still meets the rank's own level
    expect(rankedLevel(3, 1, 100)).toBe(110); // defending No. 1
  });

  it('ranked ladder: level by rank', () => {
    expect(LADDER_SIZE).toBe(100);
    expect([100, 75, 50, 25, 10, 1].map(ladderLevel)).toEqual([4, 19, 34, 49, 58, 63]);
  });

  it('training: level offsets around the team average', () => {
    expect(levelRange(30, 'easy')).toEqual([27, 29]);
    expect(levelRange(30, 'normal')).toEqual([29, 31]);
    expect(levelRange(30, 'hard')).toEqual([32, 35]);
    expect(levelRange(1, 'easy')).toEqual([2, 2]); // never below the minimum
  });

  it('infinity tower: +5 levels per floor', () => {
    expect([1, 2, 10, 18, 22, 26].map(floorLevel)).toEqual([15, 20, 60, 100, 120, 140]);
  });
});

describe('designed prizes', () => {
  it('gyms: first win and rematch', () => {
    const brock = REGION_GYMS.kanto[0];
    const gyms = defaultSave().gyms;
    expect(gymRewards(gyms, brock)).toEqual([{ kind: 'badge', badge: 'boulder' }, coins(250), item('rare-candy', 5), item('great-ball', 3)]);
    gyms.badges.push('boulder');
    expect(gymRewards(gyms, brock)).toEqual([coins(125), item('rare-candy', 3)]);
  });

  it('league: the Kanto table, scaled per region, and each Champion prize', () => {
    expect([0, 1, 2, 3, 4].map(p => placementRewards(p, 'kanto'))).toEqual([
      [coins(250), item('rare-candy', 5)],
      [coins(750), item('great-ball', 5), item('rare-candy', 10)],
      [coins(1500), item('ultra-ball', 3), item('rare-candy', 20)],
      [coins(2500), item('ultra-ball', 5), item('rare-candy', 30)],
      [coins(5000), item('master-ball', 1), item('rare-candy', 40)],
    ]);
    expect(placementRewards(3, 'johto')).toEqual([coins(5000), item('ultra-ball', 10), item('rare-candy', 60)]);
    expect(placementRewards(3, 'hoenn')).toEqual([coins(7500), item('ultra-ball', 15), item('rare-candy', 90)]);
    expect(placementRewards(3, 'sinnoh')).toEqual([coins(10000), item('ultra-ball', 20), item('rare-candy', 120)]);
    expect(placementRewards(4, 'johto')).toEqual([coins(10000), item('master-ball', 1), item('rare-candy', 80)]);
    expect(placementRewards(4, 'hoenn')).toEqual([coins(15000), item('master-ball', 1), item('rare-candy', 100)]);
    expect(placementRewards(4, 'sinnoh')).toEqual([coins(20000), item('master-ball', 2), item('rare-candy', 120)]);
    expect(REGION_IDS.map(leagueFee)).toEqual([1000, 2500, 4000, 6000]);
  });

  it('ranked ladder: coins per win and the milestones', () => {
    expect([ladderCoins(4), ladderCoins(63), ladderCoins(200)]).toEqual([100, 690, 2060]);
    expect(MILESTONES.map(m => m.id)).toHaveLength(5);
    expect(milestonePreview(MILESTONES[MILESTONES.length - 1])).toEqual([item('master-ball', 1)]);
  });

  it('training: coins and candy per difficulty', () => {
    expect([trainingCoins('easy', 20), trainingCoins('normal', 20), trainingCoins('hard', 20)]).toEqual([55, 85, 140]);
    expect([DIFFICULTY.easy.candy, DIFFICULTY.normal.candy, DIFFICULTY.hard.candy]).toEqual([1, 1, 2]);
  });

  it('infinity tower: 3 Rare Candy and ₽20 per level, +₽2,000 on boss floors', () => {
    expect(floorRewards(1)).toEqual([coins(300), item('rare-candy', 3)]);
    expect(floorRewards(18)).toEqual([coins(2000), item('rare-candy', 3)]);
    expect(floorRewards(20)).toEqual([coins(2200 + 2000), item('rare-candy', 3)]);
  });
});
