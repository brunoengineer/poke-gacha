import { describe, expect, it } from 'vitest';
import { RARE_CANDY } from '../../data/items';
import { getSpecies } from '../../data/species';
import { defaultSave, normalizeSave } from '../../state/save';
import {
  defaultTowerSave, floorLevel, floorRewards, isBossFloor, MAX_FLOOR_LEVEL, nextFloor, recordTower, towerFloor, towerUnlocked,
} from './tower';

describe('infinity tower', () => {
  it('starts at Lv. 15 and adds 5 levels per floor up to floor 49', () => {
    expect(floorLevel(1)).toBe(15);
    expect(floorLevel(2)).toBe(20);
    expect(floorLevel(18)).toBe(100);
    expect(floorLevel(49)).toBe(255);
  });

  it('turns exponential from floor 50: +10, doubling every 30 floors', () => {
    const step = (floor: number) => floorLevel(floor) - floorLevel(floor - 1);
    expect(floorLevel(50)).toBe(265);
    expect(step(50)).toBe(10);
    expect(step(80)).toBe(20);
    expect(step(110)).toBe(40);
    expect(step(170)).toBe(160);
    expect(floorLevel(234)).toBeGreaterThan(30000);
    expect(floorLevel(233)).toBeLessThan(30000);
    expect(towerFloor(234).team.every(m => m.level === floorLevel(234))).toBe(true);
  });

  it('has no top floor, and stays a safe whole number however high', () => {
    for (let floor = 2; floor <= 3000; floor++) expect(floorLevel(floor)).toBeGreaterThanOrEqual(floorLevel(floor - 1));
    for (const floor of [1500, 5000, 1e6]) {
      expect(floorLevel(floor)).toBe(MAX_FLOOR_LEVEL);
      expect(towerFloor(floor).team.every(m => m.level === MAX_FLOOR_LEVEL)).toBe(true);
    }
  });

  it('opens after the first badge', () => {
    expect(towerUnlocked(0)).toBe(false);
    expect(towerUnlocked(1)).toBe(true);
  });

  it('always brings the same team to the same floor', () => {
    expect(towerFloor(7)).toEqual(towerFloor(7));
    expect(towerFloor(7).team).toHaveLength(6);
    expect(towerFloor(7).team.map(m => m.id)).not.toEqual(towerFloor(8).team.map(m => m.id));
  });

  it('allows legendaries only on boss floors (every 10th)', () => {
    expect([9, 10, 11, 20].map(isBossFloor)).toEqual([false, true, false, true]);
    for (let floor = 1; floor <= 60; floor++) {
      if (isBossFloor(floor)) continue;
      expect(towerFloor(floor).team.some(m => getSpecies(m.id).legendary || getSpecies(m.id).mythical)).toBe(false);
    }
  });

  it('pays 3 Rare Candy and 20 coins per level, plus 2,000 on boss floors', () => {
    expect(floorRewards(1)).toEqual([{ kind: 'coins', amount: 300 }, { kind: 'item', item: RARE_CANDY, amount: 3 }]);
    expect(floorRewards(10)).toEqual([{ kind: 'coins', amount: 20 * 60 + 2000 }, { kind: 'item', item: RARE_CANDY, amount: 3 }]);
  });

  it('pays the steep floors as when every floor added 5 levels, so prizes stay what they were', () => {
    expect(floorRewards(200)).toEqual([{ kind: 'coins', amount: 20 * 1010 + 2000 }, { kind: 'item', item: RARE_CANDY, amount: 3 }]);
    expect(floorRewards(301)[0]).toEqual({ kind: 'coins', amount: 20 * 1515 });
  });

  it('keeps progress after a loss and climbs one floor per win', () => {
    const tower = defaultTowerSave();
    expect(nextFloor(tower)).toBe(1);
    expect(recordTower(tower, false)).toBe(false);
    expect(nextFloor(tower)).toBe(1);
    expect(recordTower(tower, true)).toBe(true);
    expect(recordTower(tower, true)).toBe(true);
    expect(tower).toEqual({ best: 2, wins: 2, losses: 1 });
    expect(nextFloor(tower)).toBe(3);
  });

  it('gives older saves an empty tower', () => {
    const old = defaultSave() as unknown as Record<string, unknown>;
    delete old.tower;
    expect(normalizeSave(old).tower).toEqual(defaultTowerSave());
  });
});
