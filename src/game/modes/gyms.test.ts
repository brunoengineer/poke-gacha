import { describe, expect, it } from 'vitest';
import { RARE_CANDY } from '../../data/items';
import { getSpecies } from '../../data/species';
import { applyRewards } from '../rewards';
import { seeded } from '../rng';
import { defaultSave } from '../../state/save';
import { BADGES, defaultGymSave, getGym, gymLevels, gymRewards, gymStatus, gymTeam, GYMS, nextGym, recordGym, rematchBonus } from './gyms';

describe('gym roster', () => {
  it('has the eight Kanto gyms in order with six themed species each', () => {
    expect(BADGES).toEqual(['boulder', 'cascade', 'thunder', 'rainbow', 'soul', 'marsh', 'volcano', 'earth']);
    for (const gym of GYMS) {
      expect(gym.roster).toHaveLength(6);
      const team = gymTeam(defaultGymSave(), gym, seeded(5));
      // Most of the team shares the leader's type (evolved forms included).
      const typed = team.filter(m => getSpecies(m.id).types.includes(gym.type)).length;
      expect(typed).toBeGreaterThanOrEqual(4);
    }
  });

  it('evolves rosters for their level', () => {
    const team = gymTeam(defaultGymSave(), getGym('surge')!, seeded(1));
    expect(team.at(-1)!.id).toBe(26); // Pikachu -> Raichu
    for (const m of team) expect(m.level).toBeGreaterThanOrEqual(20);
  });
});

describe('gym progression', () => {
  it('unlocks each gym after the previous badge', () => {
    const gyms = defaultGymSave();
    expect(gymStatus(gyms, 0)).toBe('open');
    expect(gymStatus(gyms, 1)).toBe('locked');
    gyms.badges.push('boulder');
    expect(gymStatus(gyms, 0)).toBe('beaten');
    expect(gymStatus(gyms, 1)).toBe('open');
    expect(nextGym(gyms)?.id).toBe('misty');
  });

  it('gives the badge and first-win rewards, then rematch rewards', () => {
    const save = defaultSave();
    const brock = getGym('brock')!;
    const first = gymRewards(save.gyms, brock);
    expect(first).toEqual([
      { kind: 'badge', badge: 'boulder' },
      { kind: 'coins', amount: 500 },
      { kind: 'item', item: 'great-ball', amount: 3 },
    ]);
    applyRewards(save, first);
    recordGym(save.gyms, 'brock', true);
    expect(save.gyms.badges).toEqual(['boulder']);
    expect(gymRewards(save.gyms, brock)).toEqual([{ kind: 'coins', amount: 250 }, { kind: 'item', item: RARE_CANDY, amount: 3 }]);
    expect(getGym('sabrina')!.items.map(i => i.item)).toEqual(['moon-stone', 'link-cable']);
  });

  it('adds 10 levels per rematch, up to 40', () => {
    const gyms = defaultGymSave();
    const misty = getGym('misty')!;
    expect(gymLevels(gyms, misty)).toEqual([14, 18]);
    gyms.badges.push('cascade');
    recordGym(gyms, 'misty', false);
    recordGym(gyms, 'misty', true);
    expect(rematchBonus(gyms, misty)).toBe(10);
    expect(gymLevels(gyms, misty)).toEqual([24, 28]);
    for (let i = 0; i < 9; i++) recordGym(gyms, 'misty', true);
    expect(gymLevels(gyms, misty)).toEqual([54, 58]);
    expect(gyms.records.misty).toEqual({ wins: 10, losses: 1 });
  });
});
