import { describe, expect, it } from 'vitest';
import { RARE_CANDY } from '../../data/items';
import { getSpecies } from '../../data/species';
import { defaultSave, normalizeSave } from '../../state/save';
import {
  defaultTowerSave, floorLevel, floorRewards, isBossFloor, nextFloor, recordTower, towerFloor, towerUnlocked,
} from './tower';

describe('infinity tower', () => {
  it('starts at Lv. 15 and adds 2 levels per floor, with no top floor', () => {
    expect(floorLevel(1)).toBe(15);
    expect(floorLevel(2)).toBe(17);
    expect(floorLevel(43)).toBe(99);
    expect(floorLevel(500)).toBe(1013);
    expect(towerFloor(500).team.every(m => m.level === 1013)).toBe(true);
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
    expect(floorRewards(10)).toEqual([{ kind: 'coins', amount: 20 * 33 + 2000 }, { kind: 'item', item: RARE_CANDY, amount: 3 }]);
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
