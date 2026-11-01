import { describe, expect, it } from 'vitest';
import { RARE_CANDY } from '../../data/items';
import { getSpecies } from '../../data/species';
import { applyRewards } from '../rewards';
import { seeded } from '../rng';
import { defaultSave } from '../../state/save';
import enBattle from '../../i18n/en/battle';
import ptBattle from '../../i18n/pt/battle';
import { canUseBanner } from '../gacha';
import {
  ALL_GYMS, BADGES, defaultGymSave, getGym, gymLevels, gymRegion, gymRewards, gymStatus, gymTeam, GYMS, JOHTO_BADGES, JOHTO_GYMS,
  johtoGymsOpen, nextGym, recordGym, regionBadges, rematchBonus,
} from './gyms';

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
      { kind: 'coins', amount: 250 },
      { kind: 'item', item: RARE_CANDY, amount: 5 },
      { kind: 'item', item: 'great-ball', amount: 3 },
    ]);
    applyRewards(save, first);
    recordGym(save.gyms, 'brock', true);
    expect(save.gyms.badges).toEqual(['boulder']);
    expect(gymRewards(save.gyms, brock)).toEqual([{ kind: 'coins', amount: 125 }, { kind: 'item', item: RARE_CANDY, amount: 3 }]);
    expect(getGym('sabrina')!.items.map(i => i.item)).toEqual(['moon-stone', 'link-cable']);
  });

  it('adds 10 levels per rematch, up to 40', () => {
    const gyms = defaultGymSave();
    const misty = getGym('misty')!;
    expect(gymLevels(gyms, misty)).toEqual([18, 22]);
    gyms.badges.push('cascade');
    recordGym(gyms, 'misty', false);
    recordGym(gyms, 'misty', true);
    expect(rematchBonus(gyms, misty)).toBe(10);
    expect(gymLevels(gyms, misty)).toEqual([28, 32]);
    for (let i = 0; i < 9; i++) recordGym(gyms, 'misty', true);
    expect(gymLevels(gyms, misty)).toEqual([58, 62]);
    expect(gyms.records.misty).toEqual({ wins: 10, losses: 1 });
  });
});

describe('johto gyms', () => {
  it('has the eight Johto gyms in order with six themed species each', () => {
    expect(JOHTO_BADGES).toEqual(['zephyr', 'hive', 'plain', 'fog', 'storm', 'mineral', 'glacier', 'rising']);
    expect(JOHTO_GYMS.map(g => g.levels)).toEqual([[60, 64], [63, 67], [66, 70], [69, 73], [72, 76], [75, 79], [78, 82], [81, 86]]);
    for (const gym of JOHTO_GYMS) {
      expect(gym.roster).toHaveLength(6);
      expect(gymRegion(gym)).toBe('johto');
      const team = gymTeam(defaultGymSave(), gym, seeded(5));
      const typed = team.filter(m => getSpecies(m.id).types.includes(gym.type)).length;
      expect(typed).toBeGreaterThanOrEqual(4);
    }
    // Aces close the team, evolved for the level when needed.
    expect(gymTeam(defaultGymSave(), getGym('whitney')!, seeded(1)).at(-1)!.id).toBe(241);
    expect(gymTeam(defaultGymSave(), getGym('bugsy')!, seeded(1)).at(-1)!.id).toBe(212); // Scyther -> Scizor
    expect(gymTeam(defaultGymSave(), getGym('jasmine')!, seeded(1)).at(-1)!.id).toBe(208); // Onix -> Steelix
    expect(gymTeam(defaultGymSave(), getGym('clair')!, seeded(1)).at(-1)!.id).toBe(230);
  });

  it('opens Falkner only with every Kanto badge, then each gym after the previous badge', () => {
    const gyms = defaultGymSave();
    expect(gymStatus(gyms, 0, 'johto')).toBe('locked');
    gyms.badges = BADGES.slice(0, 7);
    expect(johtoGymsOpen(gyms)).toBe(false);
    expect(gymStatus(gyms, 0, 'johto')).toBe('locked');
    gyms.badges = [...BADGES];
    expect(nextGym(gyms)?.id).toBe('falkner');
    expect(gymStatus(gyms, 0, 'johto')).toBe('open');
    expect(gymStatus(gyms, 1, 'johto')).toBe('locked');
    gyms.badges.push('zephyr');
    expect(gymStatus(gyms, 0, 'johto')).toBe('beaten');
    expect(gymStatus(gyms, 1, 'johto')).toBe('open');
    expect(regionBadges(gyms, 'kanto')).toBe(8);
    expect(regionBadges(gyms, 'johto')).toBe(1);
    gyms.badges.push(...JOHTO_BADGES.slice(1));
    expect(nextGym(gyms)?.id).toBe('roxanne'); // then Hoenn
  });

  it('gives the documented first-win rewards, then rematch rewards', () => {
    expect(JOHTO_GYMS.map(g => g.coins)).toEqual([2500, 2750, 3000, 3250, 3500, 3750, 4000, 5000]);
    expect(JOHTO_GYMS.map(g => g.items.map(i => `${i.item}×${i.amount}`).join(' + '))).toEqual([
      'great-ball×5', 'metal-coat×1', 'rare-candy×15', 'ultra-ball×3', 'kings-rock×1', 'metal-coat×1', 'up-grade×1',
      'dragon-scale×1 + ultra-ball×5',
    ]);
    const save = defaultSave();
    save.gyms.badges = [...BADGES];
    const clair = getGym('clair')!;
    const first = gymRewards(save.gyms, clair);
    expect(first[0]).toEqual({ kind: 'badge', badge: 'rising' });
    applyRewards(save, first);
    recordGym(save.gyms, 'clair', true);
    expect(save.items['dragon-scale']).toBe(1);
    expect(gymRewards(save.gyms, clair)).toEqual([{ kind: 'coins', amount: 2500 }, { kind: 'item', item: RARE_CANDY, amount: 3 }]);
    expect(gymLevels(save.gyms, clair)).toEqual([91, 96]);
  });

  it('keeps banner unlocks counting every badge', () => {
    const save = defaultSave();
    expect(canUseBanner(save, 'great')).toBe(false);
    save.gyms.badges = ['boulder'];
    expect(canUseBanner(save, 'great')).toBe(true);
    expect(canUseBanner(save, 'ultra')).toBe(false);
    save.gyms.badges = [...BADGES, 'zephyr'];
    expect(canUseBanner(save, 'ultra')).toBe(true);
  });

  it('has texts and badge names for every gym in both languages', () => {
    for (const bundle of [ptBattle, enBattle]) {
      for (const gym of ALL_GYMS) {
        expect(bundle.leaders[gym.id]?.city).toBeTruthy();
        expect(bundle.badgeFull[gym.badge]).toBeTruthy();
        expect(bundle.badgeName[gym.badge]).toBeTruthy();
      }
    }
  });
});

